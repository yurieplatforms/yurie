/**
 * Background Response Status API
 * 
 * Check the status of a background response.
 * Reference: https://platform.openai.com/docs/guides/background
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, generateRequestId } from '@/lib/ai/api/openai'
import { backgroundResponseStore, isTerminalStatus } from '@/lib/ai/api/background'
import { env } from '@/lib/config/env'
import type { BackgroundStatusRequestBody, BackgroundStatusResponse } from '@/lib/ai/api/types'

export async function POST(request: Request) {
  const requestId = generateRequestId()
  let body: BackgroundStatusRequestBody
  
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
  
  // Check local store first for quick lookup
  const storedResponse = backgroundResponseStore.getByResponseId(responseId)
  
  // Verify the response belongs to this user
  if (storedResponse && storedResponse.userId !== userId) {
    return NextResponse.json(
      { error: 'Unauthorized to access this response', requestId },
      { status: 403 },
    )
  }
  
  // If we have a terminal status in store, return it
  if (storedResponse && isTerminalStatus(storedResponse.status)) {
    const response: BackgroundStatusResponse = {
      status: storedResponse.status,
      requestId: storedResponse.requestId,
      responseId,
    }
    return NextResponse.json(response)
  }
  
  // Otherwise, poll OpenAI for current status
  const apiKey = env.OPENAI_API_KEY
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set', requestId },
      { status: 500 },
    )
  }
  
  const openai = createOpenAIClient({ apiKey, timeout: 30000 })
  
  try {
    // Retrieve the response from OpenAI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openaiResponse = await (openai.responses as any).retrieve(responseId)
    
    // Update local store if we have it tracked
    if (storedResponse && openaiResponse.status) {
      backgroundResponseStore.updateStatus(storedResponse.requestId, openaiResponse.status)
    }
    
    const response: BackgroundStatusResponse = {
      status: openaiResponse.status,
      requestId: storedResponse?.requestId,
      responseId,
      outputText: openaiResponse.output_text,
      error: openaiResponse.error,
      usage: openaiResponse.usage,
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('[background/status] Error retrieving response:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve response status',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

/**
 * GET endpoint for checking status with query param
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const responseId = searchParams.get('responseId')
  
  if (!responseId) {
    return NextResponse.json(
      { error: 'responseId query parameter is required' },
      { status: 400 },
    )
  }
  
  // Create a mock request body and forward to POST
  const body: BackgroundStatusRequestBody = { responseId }
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  })
  
  return POST(mockRequest)
}


