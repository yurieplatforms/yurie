/**
 * Background Response Cancel API
 * 
 * Cancel an in-progress background response.
 * Reference: https://platform.openai.com/docs/guides/background
 * 
 * Note: Cancelling is idempotent - subsequent calls return the final Response object.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, generateRequestId } from '@/lib/ai/api/openai'
import { backgroundResponseStore, getStatusMessage } from '@/lib/ai/api/background'
import { env } from '@/lib/config/env'
import type { BackgroundCancelRequestBody, BackgroundStatusResponse } from '@/lib/ai/api/types'

export async function POST(request: Request) {
  const requestId = generateRequestId()
  let body: BackgroundCancelRequestBody
  
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', requestId },
      { status: 400 },
    )
  }
  
  const { responseId } = body
  
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
  
  // Check local store for authorization
  const storedResponse = backgroundResponseStore.getByResponseId(responseId)
  
  // Verify the response belongs to this user
  if (storedResponse && storedResponse.userId !== userId) {
    return NextResponse.json(
      { error: 'Unauthorized to cancel this response', requestId },
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
  
  const openai = createOpenAIClient({ apiKey, timeout: 30000 })
  
  try {
    // Cancel the response via OpenAI API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cancelledResponse = await (openai.responses as any).cancel(responseId)
    
    // Update local store
    if (storedResponse) {
      backgroundResponseStore.updateStatus(storedResponse.requestId, 'cancelled')
    }
    
    console.log(`[background/cancel] Cancelled response: ${responseId}`)
    
    const response: BackgroundStatusResponse = {
      status: cancelledResponse.status || 'cancelled',
      requestId: storedResponse?.requestId,
      responseId,
      outputText: cancelledResponse.output_text,
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('[background/cancel] Error cancelling response:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to cancel response',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

