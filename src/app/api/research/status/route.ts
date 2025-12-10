/**
 * Deep Research Status API
 * 
 * Poll the status of a deep research request and retrieve results when complete.
 * 
 * Reference: https://platform.openai.com/docs/guides/deep-research
 * Reference: https://platform.openai.com/docs/guides/background
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, generateRequestId, parseAPIError } from '@/lib/ai/api/openai'
import { isTerminalStatus } from '@/lib/ai/api/background'
import { env } from '@/lib/config/env'
import type { BackgroundResponseStatus } from '@/lib/ai/api/types'

// =============================================================================
// Types
// =============================================================================

interface ResearchStatusRequestBody {
  /** The OpenAI response ID to check */
  responseId: string
}

interface WebSearchAction {
  type: 'search' | 'open_page' | 'find_in_page'
  query?: string
  url?: string
}

interface WebSearchCall {
  id: string
  type: 'web_search_call'
  status: string
  action: WebSearchAction
}

interface Annotation {
  url: string
  title: string
  start_index: number
  end_index: number
}

interface ResearchStatusResponse {
  /** Request tracking ID */
  requestId: string
  /** OpenAI response ID */
  responseId: string
  /** Current status */
  status: BackgroundResponseStatus
  /** Human-readable status message */
  message: string
  /** The research output (when completed) */
  outputText?: string
  /** Source annotations/citations */
  annotations?: Annotation[]
  /** Web searches performed */
  webSearches?: WebSearchCall[]
  /** Error details (if failed) */
  error?: {
    code: string
    message: string
  }
  /** Token usage */
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusMessage(status: BackgroundResponseStatus): string {
  switch (status) {
    case 'queued':
      return 'Research request is queued for processing...'
    case 'in_progress':
      return 'Researching and analyzing sources...'
    case 'completed':
      return 'Research completed successfully'
    case 'failed':
      return 'Research request failed'
    case 'cancelled':
      return 'Research request was cancelled'
    case 'incomplete':
      return 'Research completed but response was truncated'
    default:
      return 'Unknown status'
  }
}

/**
 * Extract annotations from the response output
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAnnotations(output: any[]): Annotation[] {
  const annotations: Annotation[] = []
  
  for (const item of output) {
    if (item.type === 'message' && item.content) {
      for (const content of item.content) {
        if (content.type === 'output_text' && content.annotations) {
          annotations.push(...content.annotations)
        }
      }
    }
  }
  
  return annotations
}

/**
 * Extract web search calls from the response output
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractWebSearchCalls(output: any[]): WebSearchCall[] {
  return output
    .filter(item => item.type === 'web_search_call')
    .map(item => ({
      id: item.id,
      type: item.type,
      status: item.status,
      action: item.action,
    }))
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: Request) {
  const requestId = generateRequestId()
  let body: ResearchStatusRequestBody

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

  // Verify user authentication (optional but recommended)
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Continue without user ID
  }

  // Check for OpenAI API key
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

    const status: BackgroundResponseStatus = openaiResponse.status

    // Build the response
    const result: ResearchStatusResponse = {
      requestId,
      responseId,
      status,
      message: getStatusMessage(status),
    }

    // If completed, include the output
    if (isTerminalStatus(status)) {
      if (openaiResponse.output_text) {
        result.outputText = openaiResponse.output_text
      }

      if (openaiResponse.output && Array.isArray(openaiResponse.output)) {
        result.annotations = extractAnnotations(openaiResponse.output)
        result.webSearches = extractWebSearchCalls(openaiResponse.output)
      }

      if (openaiResponse.error) {
        result.error = openaiResponse.error
      }

      if (openaiResponse.usage) {
        result.usage = openaiResponse.usage
      }
    }

    console.log(`[research/status] Response ${responseId}: ${status}`)

    return NextResponse.json(result)

  } catch (error) {
    const errorInfo = parseAPIError(error)
    console.error(`[research/status] Error retrieving response:`, errorInfo)

    return NextResponse.json(
      { 
        error: errorInfo.userMessage,
        code: errorInfo.code,
        requestId,
        responseId,
      },
      { status: errorInfo.status || 500 },
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

  // Forward to POST handler
  const body: ResearchStatusRequestBody = { responseId }
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  })

  return POST(mockRequest)
}
