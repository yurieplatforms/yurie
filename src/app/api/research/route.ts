/**
 * Deep Research API Route
 * 
 * Runs a research workflow using OpenAI Responses API + tools (web search, optional
 * code interpreter) and background mode for long-running tasks.
 *
 * Model policy: this repo pins all requests to a single model.
 * 
 * Reference: https://platform.openai.com/docs/guides/deep-research
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createOpenAIClient,
  DEFAULT_OPENAI_MODEL,
  parseAPIError,
  validateMessages,
  checkRateLimit,
  getRateLimitWaitTime,
  generateRequestId,
  logRequest,
} from '@/lib/ai/api/openai'
import { env } from '@/lib/config/env'
import type { BackgroundResponseStatus } from '@/lib/ai/api/types'

// =============================================================================
// Types
// =============================================================================

interface DeepResearchRequestBody {
  /** The research query/prompt */
  query: string
  /** Optional: Include code interpreter for data analysis */
  includeCodeInterpreter?: boolean
  /** Optional: Maximum number of tool calls (controls cost/latency) */
  maxToolCalls?: number
}

interface DeepResearchResponse {
  /** Request ID for tracking */
  requestId: string
  /** OpenAI response ID for status polling */
  responseId: string
  /** Current status */
  status: BackgroundResponseStatus
  /** Status message */
  message: string
}

// =============================================================================
// Deep Research Prompt Enhancement
// =============================================================================

/**
 * Enhance the user's research query with best practices from OpenAI's docs.
 * Deep research models expect fully-formed prompts and won't ask for clarification.
 */
function enhanceResearchPrompt(query: string): string {
  return `${query}

Research Guidelines:
- Include specific figures, trends, statistics, and measurable outcomes where available.
- Prioritize reliable, up-to-date sources: peer-reviewed research, official organizations, regulatory agencies, or reputable publications.
- Include inline citations and return all source metadata.
- Be analytical and avoid generalities.
- Format the response as a well-structured report with clear headers and sections.
- If including comparisons, use tables for clarity.`
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: Request) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  let body: DeepResearchRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', requestId },
      { status: 400 },
    )
  }

  // Validate query
  if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
    return NextResponse.json(
      { error: 'Query is required', requestId },
      { status: 400 },
    )
  }

  // Validate query as a message
  const validation = validateMessages([{ role: 'user', content: body.query }])
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, requestId },
      { status: 400 },
    )
  }

  // Check for OpenAI API key
  const apiKey = env.OPENAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'OPENAI_API_KEY is not set. Add it to your environment variables.',
        requestId,
      },
      { status: 500 },
    )
  }

  // Get user ID for rate limiting and tracking
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Continue without user ID
  }

  // Rate limiting: 5 deep research requests per user per minute (more restrictive due to cost)
  const rateLimitKey = `research:${userId || request.headers.get('x-forwarded-for') || 'anonymous'}`
  if (!checkRateLimit(rateLimitKey, 5, 0.083)) { // 0.083 = ~5 per minute refill
    const waitTime = getRateLimitWaitTime(rateLimitKey, 5, 0.083)
    return NextResponse.json(
      { 
        error: `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`,
        requestId,
        retryAfter: Math.ceil(waitTime / 1000),
      },
      { 
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(waitTime / 1000)) },
      },
    )
  }

  // Create OpenAI client with extended timeout for deep research
  // Deep research can take tens of minutes, so we use a long timeout
  const openai = createOpenAIClient({ apiKey, timeout: 3600000 }) // 1 hour timeout

  // Model is pinned (single-model policy)
  const model = DEFAULT_OPENAI_MODEL

  // Build tools array - must include at least one data source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    { type: 'web_search_preview' },
  ]

  // Optionally add code interpreter for data analysis
  if (body.includeCodeInterpreter) {
    tools.push({
      type: 'code_interpreter',
      container: { type: 'auto' },
    })
  }

  // Enhance the research prompt with best practices
  const enhancedQuery = enhanceResearchPrompt(body.query)

  try {
    console.log(`[research] Starting deep research with model: ${model}`)
    console.log(`[research] Tools: ${tools.map(t => t.type).join(', ')}`)

    // Create the deep research request in background mode
    // Background mode is strongly recommended for deep research as it can take minutes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestParams: any = {
      model,
      input: enhancedQuery,
      background: true, // Required for deep research
      tools,
      // Optionally limit tool calls to control cost/latency
      ...(body.maxToolCalls && { max_tool_calls: body.maxToolCalls }),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses as any).create(requestParams)

    console.log(`[research] Deep research started, response ID: ${response.id}`)

    // Log the request
    logRequest({
      requestId,
      model,
      timestamp: startTime,
      userId: userId ?? undefined,
      durationMs: Date.now() - startTime,
      success: true,
    })

    // Return the response ID for polling
    const result: DeepResearchResponse = {
      requestId,
      responseId: response.id,
      status: response.status || 'queued',
      message: 'Deep research started. Poll the status endpoint for updates.',
    }

    return NextResponse.json(result)

  } catch (error) {
    const errorInfo = parseAPIError(error)
    console.error(`[research] Error starting deep research:`, errorInfo)

    logRequest({
      requestId,
      model,
      timestamp: startTime,
      userId: userId ?? undefined,
      durationMs: Date.now() - startTime,
      error: errorInfo.code,
      success: false,
    })

    return NextResponse.json(
      { 
        error: errorInfo.userMessage,
        code: errorInfo.code,
        requestId,
      },
      { status: errorInfo.status || 500 },
    )
  }
}
