/**
 * Agent streaming response implementation
 *
 * Encapsulates the full SSE streaming loop (including background mode + tool calls)
 * so the Next.js route handler can stay small.
 */

import type OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatToolName, type ClassificationResult, type RequestMode } from '@/lib/ai/agent'
import {
  getOpenAIConfigForMode,
  getRecommendedServiceTier,
  logRequest,
  parseAPIError,
  shouldUseBackgroundMode,
  withBackgroundMode,
  withServiceTier,
} from '@/lib/ai/api/openai'
import {
  StreamCursor,
  backgroundResponseStore,
  getStatusMessage,
  isTerminalStatus,
} from '@/lib/ai/api/background'
import {
  createBackgroundTask,
  updateBackgroundTaskSequence,
  updateBackgroundTaskStatus,
} from '@/lib/ai/api/background-tasks'
import { createLatencyTracker } from '@/lib/ai/api/latency'
import { handleToolCalls } from '@/lib/ai/integrations/composio/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenAIInputMessage = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenAITool = any

export type AgentStreamOptions = {
  requestId: string
  startTime: number
  openai: OpenAI

  /** Authenticated user ID (required for Composio tool execution) */
  userId: string | null
  /** Supabase client for background task persistence */
  supabase: SupabaseClient | null

  chatId?: string
  messageId?: string

  systemPrompt: string
  openAIMessages: OpenAIInputMessage[]
  tools?: OpenAITool[]

  mode: RequestMode
  classification: ClassificationResult
  researchMode: boolean
  /** If true, force the built-in image generation tool */
  imageGenMode?: boolean

  messageCount: number
}

export function createAgentSSEResponse(options: AgentStreamOptions): Response {
  const {
    requestId,
    startTime,
    openai,
    userId,
    supabase,
    chatId,
    messageId,
    systemPrompt,
    openAIMessages,
    tools,
    mode,
    classification,
    researchMode,
    imageGenMode = false,
    messageCount,
  } = options

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false

      const latencyTracker = createLatencyTracker()

      const safeEnqueue = (data: string) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          isClosed = true
        }
      }

      // Determine service tier for this request
      // Reference: https://platform.openai.com/docs/guides/priority-processing
      const projectKey = userId ?? 'anonymous'
      const { tier: serviceTier, reason: tierReason } = getRecommendedServiceTier(
        projectKey,
        {
          isUserFacing: true, // Agent chat is always user-facing
        },
      )
      console.log(`[agent] Service tier: ${serviceTier} (${tierReason})`)

      const effectiveMode: 'chat' | 'agent' | 'research' = researchMode ? 'research' : mode
      const { model: selectedModel, reasoningEffort } = getOpenAIConfigForMode(
        effectiveMode,
      )

      // Background mode configuration
      // Reference: https://platform.openai.com/docs/guides/background
      const useBackground = imageGenMode
        ? false
        : shouldUseBackgroundMode({
            mode: effectiveMode,
            hasTools: Boolean(tools && tools.length > 0),
            estimatedComplexity:
              reasoningEffort === 'xhigh'
                ? 'high'
                : reasoningEffort === 'medium'
                  ? 'medium'
                  : 'low',
            messageCount,
          })

      // Stream cursor for tracking resumable stream position
      const streamCursor = new StreamCursor()

      console.log(`[agent] Background mode: ${useBackground}`)

      try {
        // Send mode indicator to frontend for UI feedback
        safeEnqueue(
          `data: ${JSON.stringify({
            mode: {
              type: effectiveMode,
              reason: researchMode
                ? 'User enabled research mode'
                : imageGenMode
                  ? 'Image generation mode (forced)'
                  : classification.reason,
              confidence: researchMode || imageGenMode ? 'high' : classification.confidence,
              reasoningEffort,
              backgroundMode: useBackground,
            },
          })}\n\n`,
        )

        // Agentic loop - continue until we get a text response (no more tool calls)
        // In chat mode, we typically only do one iteration
        // In agent mode, we loop until all tool calls are resolved
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let toolResultsInput: any[] | null = null
        const maxToolIterations = effectiveMode === 'chat' ? 3 : 10
        let iteration = 0
        const maxTotalIterations = maxToolIterations + 1

        while (iteration < maxTotalIterations) {
          iteration++
          const isFinalIteration = iteration > maxToolIterations
          console.log(
            `[agent] Iteration ${iteration}${isFinalIteration ? ' (final - tools disabled)' : ''}`,
          )

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const baseParams: any = {
            model: selectedModel,
            instructions: systemPrompt,
            stream: true,
            // No max_output_tokens set - use model's maximum output capacity
            store: true, // Enable prompt caching (also required for background mode)
          }

          // Add tools only if we have them AND we haven't exceeded max tool iterations
          // After maxToolIterations, disable tools to force a final text response
          if (tools && tools.length > 0 && !isFinalIteration) {
            baseParams.tools = tools
            baseParams.parallel_tool_calls = true
          }

          // If the UI requested image generation mode, force the image_generation tool.
          if (imageGenMode && iteration === 1 && tools && tools.length > 0 && !isFinalIteration) {
            baseParams.tool_choice = { type: 'image_generation' }
          }

          // GPT-5.2 reasoning policy is centralized in getOpenAIConfigForMode()
          baseParams.reasoning = { effort: reasoningEffort }

          // Add service tier for priority processing
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let requestParams: any = withServiceTier(baseParams, serviceTier)

          // Enable background mode for agent tasks to avoid timeouts
          if (useBackground) {
            requestParams = withBackgroundMode(requestParams, { stream: true })
          }

          if (toolResultsInput) {
            requestParams.input = [...openAIMessages, ...toolResultsInput]
          } else {
            requestParams.input = openAIMessages
          }

          const response = await openai.responses.create(requestParams)

          // Track function calls - map by item_id to capture name before arguments
          const functionCallsMap: Map<
            string,
            { name: string; arguments?: string; call_id?: string }
          > = new Map()

          let hasTextContent = false
          let currentResponseId: string | null = null
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let currentOutput: any = null

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for await (const event of response as any) {
            if (isClosed) break

            // Track sequence number for stream resumption (background mode)
            if (useBackground && event.sequence_number !== undefined) {
              streamCursor.update(event)
            }

            // Skip tool call argument deltas (not user-visible text)
            if (
              event.type === 'response.content_part.delta' ||
              event.type === 'response.content_part.added' ||
              event.type === 'response.function_call_arguments.delta'
            ) {
              continue
            }

            // Capture response ID for continuation and background tracking
            if (
              event.type === 'response.created' ||
              event.type === 'response.in_progress'
            ) {
              currentResponseId = event.response?.id ?? currentResponseId

              if (useBackground && event.response?.id) {
                streamCursor.update(event)

                // Register background response for tracking (first iteration only)
                if (iteration === 1) {
                  backgroundResponseStore.register(
                    requestId,
                    event.response.id,
                    userId,
                    streamCursor,
                  )

                  // Persist background task to database for page refresh survival
                  if (userId && chatId && messageId && supabase) {
                    createBackgroundTask(supabase, {
                      userId,
                      chatId,
                      messageId,
                      responseId: event.response.id,
                      taskType: 'agent',
                    }).catch((err) => {
                      console.error(
                        '[agent] Failed to persist background task:',
                        err,
                      )
                    })
                  }

                  // Send background response ID to frontend for potential resumption
                  safeEnqueue(
                    `data: ${JSON.stringify({
                      background: {
                        responseId: event.response.id,
                        status: 'in_progress',
                        message: getStatusMessage('in_progress'),
                      },
                    })}\n\n`,
                  )
                }
              }
            }

            // Handle background mode status updates
            if (useBackground && event.type === 'response.completed') {
              const status = event.response?.status
              if (status && isTerminalStatus(status)) {
                backgroundResponseStore.updateStatus(requestId, status)

                // Update database with final status
                if (currentResponseId && supabase) {
                  updateBackgroundTaskStatus(supabase, currentResponseId, status)
                    .catch((err) => {
                      console.error(
                        '[agent] Failed to update background task status:',
                        err,
                      )
                    })
                }

                // Send final status to frontend
                safeEnqueue(
                  `data: ${JSON.stringify({
                    background: {
                      responseId: currentResponseId,
                      status,
                      message: getStatusMessage(status),
                    },
                  })}\n\n`,
                )
              }
            }

            // Update sequence number in database for potential stream resumption
            if (
              useBackground &&
              event.sequence_number !== undefined &&
              currentResponseId &&
              supabase
            ) {
              // Debounce DB updates - only update every 10 sequence numbers
              if (event.sequence_number % 10 === 0) {
                updateBackgroundTaskSequence(
                  supabase,
                  currentResponseId,
                  event.sequence_number,
                ).catch(() => {
                  /* ignore */
                })
              }
            }

            // Handle reasoning summary text streaming
            if (event.type === 'response.reasoning_summary_text.delta') {
              const reasoningDelta = event.delta
              if (reasoningDelta && typeof reasoningDelta === 'string') {
                safeEnqueue(
                  `data: ${JSON.stringify({
                    choices: [
                      {
                        delta: { reasoning: reasoningDelta },
                      },
                    ],
                  })}\n\n`,
                )
              }
              continue
            }

            if (event.type === 'response.reasoning_summary_text.done') {
              continue
            }

            // Handle text content streaming
            if (event.type === 'response.output_text.delta') {
              const content = event.delta
              if (content) {
                const trimmedContent = content.trim()
                const looksLikeToolJson =
                  trimmedContent.startsWith('{"tool"') ||
                  trimmedContent.startsWith('{"function"') ||
                  trimmedContent.startsWith('{"name"') ||
                  (trimmedContent.startsWith('{') &&
                    trimmedContent.includes('"owner"') &&
                    trimmedContent.includes('"repo"'))

                if (looksLikeToolJson) {
                  console.log(
                    '[agent] Filtering out tool-like JSON from text stream',
                  )
                  continue
                }

                latencyTracker.onFirstToken()
                latencyTracker.onToken()

                if (researchMode && !hasTextContent) {
                  safeEnqueue(
                    `data: ${JSON.stringify({
                      research_stage: {
                        stage: 'synthesizing',
                        activity: 'Crafting response...',
                      },
                    })}\n\n`,
                  )
                }

                hasTextContent = true
                safeEnqueue(
                  `data: ${JSON.stringify({
                    choices: [
                      {
                        delta: { content },
                      },
                    ],
                  })}\n\n`,
                )
              }
            }

            // Handle text completion event for annotations/citations
            if (event.type === 'response.output_text.done') {
              const annotations = event.annotations
              if (researchMode && annotations && Array.isArray(annotations)) {
                const sources: Array<{ url: string; title?: string }> = []
                const seenUrls = new Set<string>()

                for (const annotation of annotations) {
                  if (
                    annotation.type === 'url_citation' &&
                    annotation.url &&
                    !seenUrls.has(annotation.url)
                  ) {
                    seenUrls.add(annotation.url)
                    sources.push({
                      url: annotation.url,
                      title: annotation.title || undefined,
                    })
                  }
                }

                if (sources.length > 0) {
                  console.log(
                    `[agent] Found ${sources.length} sources from text annotations`,
                  )
                  safeEnqueue(
                    `data: ${JSON.stringify({ research_sources: sources })}\n\n`,
                  )
                }
              }
            }

            // Handle web search tool use events
            if (event.type === 'response.web_search_call.in_progress') {
              safeEnqueue(
                `data: ${JSON.stringify({
                  tool_use: {
                    tool: 'Web search',
                    status: 'in_progress',
                    details: 'Searching...',
                  },
                })}\n\n`,
              )

              if (researchMode) {
                safeEnqueue(
                  `data: ${JSON.stringify({
                    research_stage: {
                      stage: 'searching',
                      activity: 'Searching the web...',
                    },
                  })}\n\n`,
                )
              }
            }

            if (event.type === 'response.web_search_call.searching') {
              safeEnqueue(
                `data: ${JSON.stringify({
                  tool_use: {
                    tool: 'Web search',
                    status: 'searching',
                    details: 'Looking up results...',
                  },
                })}\n\n`,
              )

              if (researchMode) {
                safeEnqueue(
                  `data: ${JSON.stringify({
                    research_stage: {
                      stage: 'searching',
                      activity: 'Browsing web sources...',
                    },
                  })}\n\n`,
                )
              }
            }

            if (event.type === 'response.web_search_call.completed') {
              safeEnqueue(
                `data: ${JSON.stringify({
                  tool_use: {
                    tool: 'Web search',
                    status: 'completed',
                    details: 'Done',
                  },
                })}\n\n`,
              )

              if (researchMode) {
                safeEnqueue(
                  `data: ${JSON.stringify({
                    research_stage: {
                      stage: 'analyzing',
                      activity: 'Analyzing search results...',
                    },
                  })}\n\n`,
                )
              }
            }

            // Handle image generation output
            if (event.type === 'response.output_item.done') {
              const item = event.item
              if (item?.type === 'image_generation_call' && item.result) {
                const displayName = 'Image Generation'

                safeEnqueue(
                  `data: ${JSON.stringify({
                    tool_use: {
                      tool: displayName,
                      status: 'completed',
                      details: 'Image generated',
                    },
                  })}\n\n`,
                )

                safeEnqueue(
                  `data: ${JSON.stringify({
                    generated_image: {
                      base64: item.result,
                      prompt: item.revised_prompt || 'Generated image',
                    },
                  })}\n\n`,
                )
              }
            }

            // Capture function call item when it's added (this has the function name)
            if (event.type === 'response.output_item.added') {
              const item = event.item
              if (item?.type === 'function_call' && item?.name) {
                functionCallsMap.set(item.id, {
                  name: item.name,
                  call_id: item.call_id,
                })

                const displayName = formatToolName(item.name)
                safeEnqueue(
                  `data: ${JSON.stringify({
                    tool_use: {
                      tool: displayName,
                      status: 'in_progress',
                      details: `${displayName}...`,
                    },
                  })}\n\n`,
                )
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
                safeEnqueue(
                  `data: ${JSON.stringify({
                    tool_use: {
                      tool: displayName,
                      status: 'executing',
                      details: `Running ${displayName.toLowerCase()}...`,
                    },
                  })}\n\n`,
                )
              } else {
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

              // Extract and send sources from annotations (for research mode)
              if (researchMode && currentOutput && Array.isArray(currentOutput)) {
                const sources: Array<{ url: string; title?: string }> = []
                const seenUrls = new Set<string>()

                for (const outputItem of currentOutput) {
                  if (outputItem.type === 'message' && outputItem.content) {
                    for (const content of outputItem.content) {
                      if (content.annotations && Array.isArray(content.annotations)) {
                        for (const annotation of content.annotations) {
                          if (
                            annotation.type === 'url_citation' &&
                            annotation.url &&
                            !seenUrls.has(annotation.url)
                          ) {
                            seenUrls.add(annotation.url)
                            sources.push({
                              url: annotation.url,
                              title: annotation.title || undefined,
                            })
                          }
                        }
                      }
                    }
                  }
                }

                if (sources.length > 0) {
                  console.log(
                    `[agent] Found ${sources.length} sources from annotations`,
                  )
                  safeEnqueue(
                    `data: ${JSON.stringify({ research_sources: sources })}\n\n`,
                  )
                }
              }
            }
          }

          const pendingFunctionCalls = Array.from(functionCallsMap.values())

          if (hasTextContent && pendingFunctionCalls.length === 0) {
            console.log('[agent] Got text response, completing')
            break
          }

          if (isFinalIteration) {
            if (hasTextContent) {
              console.log('[agent] Final iteration complete with text response')
            } else {
              console.log(
                '[agent] Final iteration complete, but no text response received',
              )
              safeEnqueue(
                `data: ${JSON.stringify({
                  choices: [
                    {
                      delta: {
                        content:
                          "I've gathered the information but ran out of processing steps. Please try a more specific question or break down your request into smaller parts.",
                      },
                    },
                  ],
                })}\n\n`,
              )
            }
            break
          }

          // Execute Composio function calls (if any)
          if (pendingFunctionCalls.length > 0 && userId && currentOutput) {
            try {
              console.log(
                '[agent] Executing tool calls:',
                pendingFunctionCalls.map((c) => c.name).join(', '),
              )

              const toolResults = await handleToolCalls(userId, currentOutput)

              // Build tool results input for next iteration
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const toolInputItems: any[] = []

              if (currentOutput && Array.isArray(currentOutput)) {
                for (const outputItem of currentOutput) {
                  if (
                    outputItem.type === 'function_call' ||
                    outputItem.type === 'reasoning' ||
                    outputItem.type === 'message'
                  ) {
                    toolInputItems.push(outputItem)
                  }
                }
              }

              if (toolResults && toolResults.length > 0) {
                for (let i = 0; i < toolResults.length; i++) {
                  const result = toolResults[i]
                  const functionCall = pendingFunctionCalls[i]

                  safeEnqueue(
                    `data: ${JSON.stringify({
                      tool_result: {
                        tool: result.name ?? functionCall?.name ?? 'function',
                        success: result.success ?? true,
                        output: result.output ?? result.result,
                      },
                    })}\n\n`,
                  )

                  toolInputItems.push({
                    type: 'function_call_output',
                    call_id: functionCall?.call_id || result.call_id,
                    output:
                      typeof result.output === 'string'
                        ? result.output
                        : JSON.stringify(result.output ?? result.result ?? ''),
                  })
                }

                const completedTools = pendingFunctionCalls
                  .map((c) => formatToolName(c.name))
                  .join(', ')
                safeEnqueue(
                  `data: ${JSON.stringify({
                    tool_use: {
                      tool: completedTools,
                      status: 'completed',
                      details: 'Done',
                    },
                  })}\n\n`,
                )
              }

              toolResultsInput = toolInputItems
              console.log(
                '[agent] Continuing with tool results:',
                toolInputItems.length,
                'items',
              )
            } catch (toolError) {
              console.error('[agent] Tool execution error:', toolError)
              const failedTools = pendingFunctionCalls
                .map((c) => formatToolName(c.name))
                .join(', ')
              safeEnqueue(
                `data: ${JSON.stringify({
                  tool_use: {
                    tool: failedTools,
                    status: 'error',
                    details:
                      toolError instanceof Error
                        ? toolError.message
                        : 'Something went wrong',
                  },
                })}\n\n`,
              )
              break
            }
          } else if (pendingFunctionCalls.length === 0) {
            console.log('[agent] No function calls or text, breaking')
            break
          }
        }

        const latencyMetrics = latencyTracker.getMetrics()
        console.log(
          `[agent] Mode: ${mode}, Latency: TTFT=${latencyMetrics.ttft}ms, Total=${latencyMetrics.totalDuration}ms`,
        )

        logRequest({
          requestId,
          model: selectedModel,
          timestamp: startTime,
          userId: userId ?? undefined,
          durationMs: latencyMetrics.totalDuration,
          serviceTier,
          success: true,
        })

        safeEnqueue('data: [DONE]\n\n')
      } catch (err) {
        const errorInfo = parseAPIError(err)
        console.error(
          `[agent] Streaming error (${errorInfo.code}):`,
          errorInfo.message,
        )

        logRequest({
          requestId,
          model: selectedModel,
          timestamp: startTime,
          userId: userId ?? undefined,
          durationMs: Date.now() - startTime,
          serviceTier,
          error: errorInfo.code,
          success: false,
        })

        safeEnqueue(
          `data: ${JSON.stringify({
            error: {
              type: errorInfo.code,
              message: errorInfo.userMessage,
              retryable: errorInfo.isRetryable,
              requestId,
            },
          })}\n\n`,
        )

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
      Connection: 'keep-alive',
    },
  })
}
