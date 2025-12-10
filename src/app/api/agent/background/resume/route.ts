/**
 * Background Response Resume API
 * 
 * Resume streaming a background response from a specific sequence number.
 * Reference: https://platform.openai.com/docs/guides/background
 * 
 * This allows clients to reconnect to a background stream after a connection drop.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, generateRequestId } from '@/lib/ai/api/openai'
import { backgroundResponseStore } from '@/lib/ai/api/background'
import { updateBackgroundTaskStatus } from '@/lib/ai/api/background-tasks'
import { env } from '@/lib/config/env'
import type { BackgroundResponseStatus } from '@/lib/ai/api/types'

interface ResumeRequestBody {
  responseId: string
  startingAfter?: number
}

export async function POST(request: Request) {
  const requestId = generateRequestId()
  let body: ResumeRequestBody
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', requestId },
      { status: 400 },
    )
  }
  
  const { responseId, startingAfter } = body
  
  if (!responseId) {
    return NextResponse.json(
      { error: 'responseId is required', requestId },
      { status: 400 },
    )
  }
  
  // Verify user authentication
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Continue without user ID
  }
  
  // Check local store for authorization and cursor info
  const storedResponse = backgroundResponseStore.getByResponseId(responseId)
  
  // Verify the response belongs to this user
  if (storedResponse && storedResponse.userId !== userId) {
    return NextResponse.json(
      { error: 'Unauthorized to resume this response', requestId },
      { status: 403 },
    )
  }
  
  const apiKey = env.OPENAI_API_KEY
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set', requestId },
      { status: 500 },
    )
  }
  
  const openai = createOpenAIClient({ apiKey, timeout: 120000 })
  
  // Determine starting position
  // Use provided startingAfter, or fall back to stored cursor
  const cursor = startingAfter ?? storedResponse?.cursor?.sequenceNumber ?? 0
  
  console.log(`[background/resume] Resuming response ${responseId} from sequence ${cursor}`)
  
  try {
    // Create a streaming response that resumes from the cursor
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let isClosed = false
        
        const safeEnqueue = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(encoder.encode(data))
            } catch {
              isClosed = true
            }
          }
        }
        
        try {
          // Retrieve the response with streaming enabled
          // Note: Full SDK support for stream resumption is coming soon per OpenAI docs
          // For now, we can retrieve the response and stream remaining content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const response = await (openai.responses as any).retrieve(responseId)
          
          // If response is already complete, send the output
          if (response.status === 'completed' || response.status === 'incomplete') {
            // Update database with final status
            const supabase = await createClient()
            await updateBackgroundTaskStatus(
              supabase, 
              responseId, 
              response.status as BackgroundResponseStatus,
              response.output_text
            )
            
            // Send status update
            safeEnqueue(`data: ${JSON.stringify({
              background: {
                responseId,
                status: response.status,
                message: response.status === 'completed' ? 'Request completed' : 'Request completed (truncated)',
              }
            })}\n\n`)
            
            // Send any remaining output text
            if (response.output_text) {
              safeEnqueue(`data: ${JSON.stringify({
                choices: [{
                  delta: { content: response.output_text }
                }]
              })}\n\n`)
            }
            
            safeEnqueue('data: [DONE]\n\n')
          } else if (response.status === 'failed' || response.status === 'cancelled') {
            // Update database with final status
            const supabase = await createClient()
            await updateBackgroundTaskStatus(
              supabase, 
              responseId, 
              response.status as BackgroundResponseStatus
            )
            
            // Send error status
            safeEnqueue(`data: ${JSON.stringify({
              error: {
                type: response.status,
                message: response.error?.message || `Response ${response.status}`,
              }
            })}\n\n`)
            safeEnqueue('data: [DONE]\n\n')
          } else {
            // Response is still in progress - poll until complete
            // Note: This is a simplified implementation until SDK supports stream resume
            let pollResponse = response
            
            while (pollResponse.status === 'queued' || pollResponse.status === 'in_progress') {
              // Send status update
              safeEnqueue(`data: ${JSON.stringify({
                background: {
                  responseId,
                  status: pollResponse.status,
                  message: pollResponse.status === 'queued' ? 'Waiting in queue...' : 'Processing...',
                }
              })}\n\n`)
              
              // Wait before polling again
              await new Promise(resolve => setTimeout(resolve, 2000))
              
              // Poll for update
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pollResponse = await (openai.responses as any).retrieve(responseId)
            }
            
            // Update database with final status
            const supabase = await createClient()
            await updateBackgroundTaskStatus(
              supabase, 
              responseId, 
              pollResponse.status as BackgroundResponseStatus,
              pollResponse.output_text
            )
            
            // Send final status and output
            safeEnqueue(`data: ${JSON.stringify({
              background: {
                responseId,
                status: pollResponse.status,
                message: pollResponse.status === 'completed' ? 'Request completed' : 
                         pollResponse.status === 'failed' ? 'Request failed' : 'Request finished',
              }
            })}\n\n`)
            
            if (pollResponse.output_text) {
              safeEnqueue(`data: ${JSON.stringify({
                choices: [{
                  delta: { content: pollResponse.output_text }
                }]
              })}\n\n`)
            }
            
            safeEnqueue('data: [DONE]\n\n')
          }
        } catch (err) {
          console.error('[background/resume] Streaming error:', err)
          
          safeEnqueue(`data: ${JSON.stringify({
            error: {
              type: 'streaming_error',
              message: err instanceof Error ? err.message : 'Failed to resume stream',
            }
          })}\n\n`)
          safeEnqueue('data: [DONE]\n\n')
        } finally {
          if (!isClosed) {
            isClosed = true
            controller.close()
          }
        }
      },
    })
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[background/resume] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to resume response',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
