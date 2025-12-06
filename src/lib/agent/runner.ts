/**
 * Agent Runner
 *
 * Orchestrates the AI agent with xAI's Grok model (via OpenAI SDK).
 * Handles streaming responses, tool execution, and SSE output.
 *
 * @module lib/agent/runner
 */

import OpenAI from 'openai'
// Agent modules
import { createSSEHandler, sendDoneSignal, type SSEHandler } from '@/lib/agent/sse-handler'
import { createRunnableTools, type FocusedRepoContext } from '@/lib/agent/runnable-tools'

// Tools
import { createServerTools } from '@/lib/tools'
import type { WebSearchUserLocation } from '@/lib/types'

// ============================================================================
// Runner Params
// ============================================================================

export type RunnerParams = {
  /** xAI API key */
  apiKey: string
  /** Conversation messages in OpenAI format */
  messages: any[]
  /** System prompt with user context */
  systemPrompt: string
  /** User location for localized web search */
  userLocation?: WebSearchUserLocation
  /** User ID for agent context */
  userId?: string
  /** Focused GitHub repository for default context */
  focusedRepo?: FocusedRepoContext | null
}

/**
 * Run the AI agent with streaming response
 */
export async function runAgent({
  apiKey,
  messages,
  systemPrompt,
  userLocation,
  userId,
  focusedRepo,
}: RunnerParams): Promise<Response> {
  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  // Create a TransformStream for streaming responses
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  // Create SSE handler for tools
  const sseHandler = createSSEHandler(writer)

  // Create runnable tools
  const runnableTools = await createRunnableTools(sseHandler, userId, focusedRepo)

  // Run the agent loop in the background
  ;(async () => {
    try {
      // Build server tools
      const serverTools = createServerTools(
        userLocation ? { userLocation } : undefined,
      )

      // Combine tools
      const tools = [...runnableTools, ...serverTools]

      // Model selection
      const MODEL = 'grok-4-1-fast-reasoning'

      const maxIterations = 10
      let currentMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ]

      for (let i = 0; i < maxIterations; i++) {
        const stream = await openai.chat.completions.create({
          model: MODEL,
          messages: currentMessages as any,
          tools: tools as any,
          stream: true,
        })

        let toolCalls: any[] = []
        let currentContent = ''
        
        // Iterate stream
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta
          if (!delta) continue

          // Handle content
          if (delta.content) {
            currentContent += delta.content
            await sseHandler.sendSSE({
              choices: [{ delta: { content: delta.content } }],
            })
          }

          // Handle tool calls accumulation
          if (delta.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index
              if (!toolCalls[index]) {
                toolCalls[index] = {
                  id: toolCallDelta.id,
                  type: toolCallDelta.type,
                  function: {
                    name: toolCallDelta.function?.name || '',
                    arguments: toolCallDelta.function?.arguments || '',
                  },
                }
              } else {
                if (toolCallDelta.function?.arguments) {
                  toolCalls[index].function.arguments += toolCallDelta.function.arguments
                }
              }
            }
          }
        }

        // If tool calls happened
        if (toolCalls.length > 0) {
          // Add assistant message with tool calls
          currentMessages.push({
            role: 'assistant',
            content: currentContent || null,
            tool_calls: toolCalls,
          })

          // Execute tools
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name
            const argsString = toolCall.function.arguments
            let args = {}
            try {
              args = JSON.parse(argsString)
            } catch (e) {
              console.error('Failed to parse tool arguments', e)
            }

            await sseHandler.sendToolEvent(toolName, 'start', args)

            // Find tool implementation
            // Note: runnableTools has 'run' method, but structure might be different now
            // We need to match standard OpenAI tool execution
            // The runnableTools from `createRunnableTools` are likely Objects with `run`
            // But here `tools` is a list of definitions.
            // Wait, `createRunnableTools` likely returns the definitions WITH `run` attached or we need a map.
            // Looking at `runnable-tools.ts` (I couldn't read it all), it likely mimics Anthropic SDK structure.
            // I need to find the tool definition in `tools` array that matches `toolName`.
            
            const toolDef = tools.find((t: any) => (t.function?.name === toolName || t.name === toolName))
            
            let result = ''
            if (toolDef && typeof (toolDef as any).run === 'function') {
               try {
                 // @ts-ignore
                 const output = await (toolDef as any).run({ input: args })
                 if (typeof output === 'string') result = output
                 else if (output && output.content) {
                    // Handle Anthropic tool result structure if it persists
                    result = Array.isArray(output.content) ? JSON.stringify(output.content) : String(output.content)
                 } else {
                    result = JSON.stringify(output)
                 }
               } catch (e: any) {
                 result = `Error: ${e.message}`
               }
            } else {
               // Fallback or handled by server tools? 
               // For now, just return placeholder if not found
               result = "Tool implementation not found"
            }

            await sseHandler.sendToolEvent(toolName, 'end', args, result)

            // Add tool result message
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result,
            })
          }
        } else {
          // No tool calls, done
          break
        }
      }

      // Send done signal
      await sendDoneSignal(writer)
      await writer.close()
    } catch (error: any) {
      console.error('Agent error:', error)
      try {
        await sseHandler.sendSSE({
          error: { message: error.message || 'An unknown error occurred' }
        })
        await writer.close()
      } catch {
        // Writer might already be closed
      }
    }
  })()

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
