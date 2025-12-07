import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Agent modules
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { convertToOpenAIContent } from '@/lib/agent/message-converter'

// API types
import type { AgentRequestBody } from '@/lib/api/types'

// Production utilities
import {
  createOpenAIClient,
  parseAPIError,
  validateMessages,
  checkRateLimit,
  getRateLimitWaitTime,
  generateRequestId,
  logRequest,
  getRecommendedServiceTier,
  withServiceTier,
} from '@/lib/api/openai'

// Latency optimization utilities
import { createLatencyTracker } from '@/lib/api/latency'

// User context
import {
  getUserPersonalizationContext,
  getUserName,
} from '@/lib/agent/user-context'
import { env } from '@/lib/config/env'

// Composio integration
import { getComposioClient, handleToolCalls } from '@/lib/composio/client'
import { isUserConnected } from '@/lib/composio/auth'

/**
 * Format tool names for display (e.g., "GMAIL_FETCH_EMAILS" -> "Gmail fetch emails")
 */
function formatToolName(name: string): string {
  if (!name) return 'Tool'
  
  // Handle web_search specially
  if (name === 'web_search') return 'Web search'
  
  // Remove common prefixes like GMAIL_, SLACK_, etc.
  const withoutPrefix = name.replace(/^(GMAIL|SLACK|GITHUB|NOTION|GOOGLE)_/i, '')
  
  // Convert SCREAMING_SNAKE_CASE to Title case
  return withoutPrefix
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
}

export async function POST(request: Request) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  let body: AgentRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', requestId },
      { status: 400 },
    )
  }

  // Validate input messages
  const validation = validateMessages(body.messages || [])
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, requestId },
      { status: 400 },
    )
  }

  const { messages, userContext, selectedTools = [] } = body

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

  // Create OpenAI client with production defaults (timeout, etc.)
  const openai = createOpenAIClient({ apiKey, timeout: 120000 })

  // Fetch user personalization context if user is authenticated
  let userName: string | null = null
  let userPreferences: { birthday?: string | null; location?: string | null; timezone?: string | null } = {}
  let focusedRepo: {
    owner: string
    name: string
    fullName: string
    description: string | null
    htmlUrl: string
    private: boolean
    language: string | null
    defaultBranch: string
  } | null = null
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const personalizationContext = await getUserPersonalizationContext(supabase, user.id)
      userName = getUserName(personalizationContext)
      
      // Extract user preferences from profile
      if (personalizationContext.profile) {
        userPreferences = {
          birthday: personalizationContext.profile.birthday,
          location: personalizationContext.profile.location,
          timezone: personalizationContext.profile.timezone,
        }
      }
      
      // Get focused GitHub repo if set
      const githubFocusedRepo = user.user_metadata?.github_focused_repo as {
        owner: string
        name: string
        fullName: string
        description: string | null
        htmlUrl: string
        private: boolean
        language: string | null
        defaultBranch: string
      } | undefined
      if (githubFocusedRepo) {
        focusedRepo = githubFocusedRepo
        console.log(`[agent] Using focused GitHub repo: ${githubFocusedRepo.fullName}`)
      }
    }
  } catch (e) {
    // Silently continue without personalization if it fails
    console.error('[agent] Failed to fetch user personalization', e)
  }

  // Fetch Gmail tools from Composio if Gmail is selected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gmailTools: any[] = []
  let userId: string | null = null
  
  try {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    userId = authUser?.id ?? null
  } catch {
    // Continue without user ID
  }

  // Rate limiting: 10 requests per user, refill 1 per second
  const rateLimitKey = userId || request.headers.get('x-forwarded-for') || 'anonymous'
  if (!checkRateLimit(rateLimitKey, 10, 1)) {
    const waitTime = getRateLimitWaitTime(rateLimitKey, 10, 1)
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
  
  if (selectedTools.includes('gmail') && userId) {
    try {
      // Check if user is connected to Gmail
      const connected = await isUserConnected(userId)
      
      if (connected) {
        console.log('[agent] Fetching Gmail tools from Composio for user:', userId)
        const composio = getComposioClient('responses')
        gmailTools = await composio.tools.get(userId, {
          tools: ['GMAIL_SEND_EMAIL', 'GMAIL_FETCH_EMAILS', 'GMAIL_CREATE_EMAIL_DRAFT'],
        })
        console.log('[agent] Loaded Gmail tools:', gmailTools.length)
      } else {
        console.log('[agent] User not connected to Gmail, skipping Gmail tools')
      }
    } catch (error) {
      console.error('[agent] Failed to fetch Gmail tools:', error)
    }
  }

  // Build enabled capabilities list
  const enabledCapabilities: string[] = []
  if (gmailTools.length > 0) {
    enabledCapabilities.push('gmail')
  }

  // Build system prompt with user context and preferences
  const systemPrompt = buildSystemPrompt({
    userName,
    userContext,
    userPreferences,
    enabledCapabilities,
  })

  // Convert messages to OpenAI format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openAIMessages: any[] = messages.map((msg) => {
    const role = msg.role === 'user' ? 'user' : 'assistant'
    return {
      role,
      content: convertToOpenAIContent(msg.content, role),
    }
  })

  try {
    // Build tools array with web search and any Composio tools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{ type: 'web_search' }]
    
    // Add Gmail tools if available
    if (gmailTools.length > 0) {
      tools.push(...gmailTools)
      console.log('[agent] Using tools:', tools.map(t => t.type || t.function?.name || 'unknown').join(', '))
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let isClosed = false
        
        // Latency tracking for monitoring
        const latencyTracker = createLatencyTracker()
        
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
          // Agentic loop - continue until we get a text response (no more tool calls)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let toolResultsInput: any[] | null = null
          let maxIterations = 10 // Safety limit
          let iteration = 0
          
          // Determine service tier for this request
          // Reference: https://platform.openai.com/docs/guides/priority-processing
          const projectKey = userId ?? 'anonymous'
          const { tier: serviceTier, reason: tierReason } = getRecommendedServiceTier(projectKey, {
            isUserFacing: true, // Agent chat is always user-facing
          })
          console.log(`[agent] Service tier: ${serviceTier} (${tierReason})`)
          
          while (iteration < maxIterations) {
            iteration++
            console.log(`[agent] Iteration ${iteration}`)
            
            // Build input for this iteration
            // Latency optimization: https://platform.openai.com/docs/guides/latency-optimization
            // Priority processing: https://platform.openai.com/docs/guides/priority-processing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const baseParams: any = {
              model: 'gpt-5.1-2025-11-13',
              instructions: systemPrompt,
              tools,
              stream: true,
              // GPT-5.1 reasoning config: 'high' for most thorough reasoning
              // Options: 'none' (fastest), 'low', 'medium', 'high' (most thorough)
              reasoning: { effort: 'high' },
              // Latency optimizations
              max_output_tokens: 4096, // Limit output tokens for faster responses
              parallel_tool_calls: true, // Execute multiple tool calls in parallel
              store: true, // Enable prompt caching for repeated requests
            }
            
            // Add service tier for priority processing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const requestParams: any = withServiceTier(baseParams, serviceTier)
            
            if (toolResultsInput) {
              // Continue with tool results - append to original messages
              requestParams.input = [...openAIMessages, ...toolResultsInput]
            } else {
              // First iteration - use original messages
              requestParams.input = openAIMessages
            }
            
            const response = await openai.responses.create(requestParams)
            
            // Track function calls - map by item_id to capture name before arguments
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const functionCallsMap: Map<string, { name: string; arguments?: string; call_id?: string }> = new Map()
            let hasTextContent = false
            let currentResponseId: string | null = null
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let currentOutput: any = null
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for await (const event of response as any) {
              if (isClosed) break
              
              // Capture response ID for continuation
              if (event.type === 'response.created' || event.type === 'response.in_progress') {
                currentResponseId = event.response?.id ?? currentResponseId
              }
              
              // Handle text content streaming
              if (event.type === 'response.output_text.delta') {
                const content = event.delta
                if (content) {
                  // Track time to first token for latency monitoring
                  latencyTracker.onFirstToken()
                  latencyTracker.onToken()
                  
                  hasTextContent = true
                  const data = {
                    choices: [{
                      delta: { content }
                    }]
                  }
                  safeEnqueue(`data: ${JSON.stringify(data)}\n\n`)
                }
              }
              
              // Handle web search tool use events
              if (event.type === 'response.web_search_call.in_progress') {
                safeEnqueue(`data: ${JSON.stringify({
                  tool_use: { tool: 'Web search', status: 'in_progress', details: 'Searching...' }
                })}\n\n`)
              }
              
              if (event.type === 'response.web_search_call.searching') {
                safeEnqueue(`data: ${JSON.stringify({
                  tool_use: { tool: 'Web search', status: 'searching', details: 'Looking up results...' }
                })}\n\n`)
              }
              
              if (event.type === 'response.web_search_call.completed') {
                safeEnqueue(`data: ${JSON.stringify({
                  tool_use: { tool: 'Web search', status: 'completed', details: 'Done' }
                })}\n\n`)
              }
              
              // Capture function call item when it's added (this has the function name)
              if (event.type === 'response.output_item.added') {
                const item = event.item
                if (item?.type === 'function_call' && item?.name) {
                  functionCallsMap.set(item.id, { name: item.name, call_id: item.call_id })
                  const displayName = formatToolName(item.name)
                  safeEnqueue(`data: ${JSON.stringify({
                    tool_use: { tool: displayName, status: 'in_progress', details: `${displayName}...` }
                  })}\n\n`)
                }
              }
              
              // Handle function call arguments completion
              if (event.type === 'response.function_call_arguments.done') {
                const itemId = event.item_id
                const existingCall = functionCallsMap.get(itemId)
                if (existingCall) {
                  existingCall.arguments = event.arguments
                  existingCall.call_id = event.call_id || existingCall.call_id
                  const displayName = formatToolName(existingCall.name)
                  safeEnqueue(`data: ${JSON.stringify({
                    tool_use: { tool: displayName, status: 'executing', details: `Running ${displayName.toLowerCase()}...` }
                  })}\n\n`)
                } else {
                  // Fallback if we didn't catch the output_item.added event
                  functionCallsMap.set(itemId || event.call_id, {
                    name: event.name || 'function',
                    arguments: event.arguments,
                    call_id: event.call_id,
                  })
                }
              }
              
              // Capture response completion data
              if (event.type === 'response.completed' || event.type === 'response.done') {
                currentResponseId = event.response?.id ?? currentResponseId
                currentOutput = event.response?.output ?? event.output
              }
            }
            
            // Convert map to array for processing
            const pendingFunctionCalls = Array.from(functionCallsMap.values())
            
            // If we got text content and no pending function calls, we're done
            if (hasTextContent && pendingFunctionCalls.length === 0) {
              console.log('[agent] Got text response, completing')
              break
            }
            
            // Execute function calls if any
            if (pendingFunctionCalls.length > 0 && userId && currentOutput) {
              try {
                console.log('[agent] Executing tool calls:', pendingFunctionCalls.map(c => c.name).join(', '))
                
                const toolResults = await handleToolCalls(userId, currentOutput)
                
                // Build tool results input for next iteration
                // Format: all output items (reasoning + function_call) + function_call_output items with results
                // Note: When reasoning is enabled, we MUST include reasoning items alongside function_call items
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const toolInputItems: any[] = []
                
                // Add ALL items from the response output (reasoning, function_call, message, etc.)
                // OpenAI requires reasoning items to be included with their associated function_call items
                if (currentOutput && Array.isArray(currentOutput)) {
                  for (const item of currentOutput) {
                    // Include reasoning, function_call, and any other items the model produced
                    if (item.type === 'function_call' || item.type === 'reasoning' || item.type === 'message') {
                      toolInputItems.push(item)
                    }
                  }
                }
                
                // Add the function call results
                if (toolResults && toolResults.length > 0) {
                  for (let i = 0; i < toolResults.length; i++) {
                    const result = toolResults[i]
                    const functionCall = pendingFunctionCalls[i]
                    
                    // Stream the result to the client
                    safeEnqueue(`data: ${JSON.stringify({
                      tool_result: {
                        tool: result.name ?? functionCall?.name ?? 'function',
                        success: result.success ?? true,
                        output: result.output ?? result.result,
                      }
                    })}\n\n`)
                    
                    // Build the function_call_output item for the API
                    toolInputItems.push({
                      type: 'function_call_output',
                      call_id: functionCall?.call_id || result.call_id,
                      output: typeof result.output === 'string' 
                        ? result.output 
                        : JSON.stringify(result.output ?? result.result ?? ''),
                    })
                  }
                  
                  const completedTools = pendingFunctionCalls.map(c => formatToolName(c.name)).join(', ')
                  safeEnqueue(`data: ${JSON.stringify({
                    tool_use: { tool: completedTools, status: 'completed', details: 'Done' }
                  })}\n\n`)
                }
                
                // Set tool results input for next iteration
                toolResultsInput = toolInputItems
                console.log('[agent] Continuing with tool results:', toolInputItems.length, 'items')
                
              } catch (toolError) {
                console.error('[agent] Tool execution error:', toolError)
                const failedTools = pendingFunctionCalls.map(c => formatToolName(c.name)).join(', ')
                safeEnqueue(`data: ${JSON.stringify({
                  tool_use: { tool: failedTools, status: 'error', details: toolError instanceof Error ? toolError.message : 'Something went wrong' }
                })}\n\n`)
                break
              }
            } else if (pendingFunctionCalls.length === 0) {
              // No function calls and no text - something unexpected, break
              console.log('[agent] No function calls or text, breaking')
              break
            }
          }
          
          // Get latency metrics and log successful request
          const latencyMetrics = latencyTracker.getMetrics()
          console.log(`[agent] Latency: TTFT=${latencyMetrics.ttft}ms, Total=${latencyMetrics.totalDuration}ms`)
          
          logRequest({
            requestId,
            model: 'gpt-5.1-2025-11-13',
            timestamp: startTime,
            userId: userId ?? undefined,
            durationMs: latencyMetrics.totalDuration,
            serviceTier,
            success: true,
          })
          
          safeEnqueue('data: [DONE]\n\n')
        } catch (err) {
          // Parse error using production utility
          const errorInfo = parseAPIError(err)
          console.error(`[agent] Streaming error (${errorInfo.code}):`, errorInfo.message)
          
          // Log failed request
          logRequest({
            requestId,
            model: 'gpt-5.1-2025-11-13',
            timestamp: startTime,
            userId: userId ?? undefined,
            durationMs: Date.now() - startTime,
            serviceTier,
            error: errorInfo.code,
            success: false,
          })
          
          const errorData = { 
            error: { 
              type: errorInfo.code, // Frontend expects 'type' not 'code'
              message: errorInfo.userMessage,
              retryable: errorInfo.isRetryable,
              requestId,
            } 
          }
          safeEnqueue(`data: ${JSON.stringify(errorData)}\n\n`)
          // Send [DONE] after error so frontend knows stream is complete
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
    console.error('[agent] Unexpected error', error)

    return NextResponse.json(
      { error: 'Unexpected error while contacting agent' },
      { status: 500 },
    )
  }
}
