import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/app/supabase/server'

// Agent modules
import { buildSystemPrompt } from '@/lib/agent/system-prompt'
import { convertToAnthropicContent } from '@/lib/agent/message-converter'
import { createSSEHandler, sendDoneSignal } from '@/lib/agent/sse-handler'
import { createRunnableTools } from '@/lib/agent/runnable-tools'
import { createMemoryTool } from '@/lib/agent/memory-tool-config'
import {
  processCitations,
  processWebFetchResult,
  processWebSearchResult,
  type RawCitation,
  type WebFetchResultContent,
  type WebSearchResultContent,
} from '@/lib/agent/stream-processor'

// API types
import type { AgentRequestBody } from '@/lib/api/types'

// User context
import {
  getUserPersonalizationContext,
  getUserName,
  formatMemoriesForPrompt,
} from '@/lib/agent/user-context'

// Tools
import { createServerTools } from '@/lib/tools'
import { createMemoryToolHandler } from '@/lib/tools/memory'

export async function POST(request: Request) {
  let body: AgentRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'Request must include at least one message' },
      { status: 400 },
    )
  }

  const { messages, userContext, userLocation } = body

  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'ANTHROPIC_API_KEY is not set. Add it to your environment variables.',
      },
      { status: 500 },
    )
  }

  // Fetch user personalization context if user is authenticated
  let userName: string | null = null
  let memoriesPrompt = ''
  let userId: string | undefined
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      userId = user.id
      const personalizationContext = await getUserPersonalizationContext(supabase, user.id)
      userName = getUserName(personalizationContext)
      memoriesPrompt = formatMemoriesForPrompt(personalizationContext)
    }
  } catch (e) {
    // Silently continue without personalization if it fails
    console.error('[agent] Failed to fetch user personalization', e)
  }

  // Build system prompt with user context
  const systemPrompt = buildSystemPrompt({
    userName,
    userContext,
    memoriesPrompt,
  })

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: convertToAnthropicContent(msg.content),
  }))

  try {
    const anthropic = new Anthropic({ apiKey })

    // Create a TransformStream for streaming responses
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // Create SSE handler for tools
    const sseHandler = createSSEHandler(writer)

    // Create runnable tools with SSE access
    const runnableTools = createRunnableTools(sseHandler)

    // Run the tool runner in the background
    ;(async () => {
      try {
        // Build server tools with user location for localized web search results
        const serverTools = createServerTools(
          userLocation ? { userLocation } : undefined
        )

        // Create memory tool handler for authenticated users
        const supabaseForMemory = await createClient()
        const memoryToolHandler = userId 
          ? createMemoryToolHandler(supabaseForMemory, userId)
          : null

        // Create memory tool using the extracted factory
        const memoryTool = createMemoryTool(sseHandler, memoryToolHandler)

        const runnerOptions: Parameters<typeof anthropic.beta.messages.toolRunner>[0] = {
          model: 'claude-opus-4-5-20251101',
          max_tokens: 16384,
          system: systemPrompt,
          messages: anthropicMessages,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [...runnableTools, memoryTool, ...serverTools] as any,
          stream: true,
          max_iterations: 10,
          // Enable extended thinking for enhanced reasoning
          thinking: {
            type: 'enabled',
            budget_tokens: 10000,
          },
          // Betas
          betas: [
            'advanced-tool-use-2025-11-20',
            'fine-grained-tool-streaming-2025-05-14',
            'web-fetch-2025-09-10',
            'context-management-2025-06-27',
            'structured-outputs-2025-11-13',
            'interleaved-thinking-2025-05-14',
          ],
          // Context editing
          context_management: {
            edits: [
              {
                type: 'clear_tool_uses_20250919',
                trigger: { type: 'input_tokens', value: 100000 },
                keep: { type: 'tool_uses', value: 5 },
                clear_at_least: { type: 'input_tokens', value: 10000 },
                exclude_tools: ['memory'],
              },
            ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        }

        const runner = anthropic.beta.messages.toolRunner(runnerOptions)

        // Track active tool calls for max_tokens handling
        let activeToolName: string | null = null
        let activeToolInput: Record<string, unknown> | null = null

        for await (const messageStream of runner) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for await (const event of messageStream as AsyncIterable<any>) {
            await handleStreamEvent(event, sseHandler, {
              activeToolName,
              activeToolInput,
              setActiveToolName: (name) => { activeToolName = name },
              setActiveToolInput: (input) => { activeToolInput = input },
            })
          }
        }

        // Send done signal
        await sendDoneSignal(writer)
        await writer.close()
      } catch (error) {
        console.error('[agent] Tool runner error', error)
        try {
          await sseHandler.sendSSE({
            error: {
              message: error instanceof Error ? error.message : 'Unknown error in tool runner',
            },
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
  } catch (error) {
    console.error('[agent] Unexpected error', error)

    return NextResponse.json(
      { error: 'Unexpected error while contacting Claude' },
      { status: 500 },
    )
  }
}

// ============================================================================
// Stream Event Handler
// ============================================================================

type StreamContext = {
  activeToolName: string | null
  activeToolInput: Record<string, unknown> | null
  setActiveToolName: (name: string | null) => void
  setActiveToolInput: (input: Record<string, unknown> | null) => void
}

async function handleStreamEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  event: any,
  sseHandler: ReturnType<typeof createSSEHandler>,
  context: StreamContext,
) {
  const { activeToolName, activeToolInput, setActiveToolName, setActiveToolInput } = context

  if (event.type === 'content_block_start') {
    const block = event.content_block

    if (block.type === 'tool_use') {
      setActiveToolName(block.name)
      await sseHandler.sendToolEvent(block.name, 'start')
    } else if (block.type === 'server_tool_use') {
      const serverBlock = block as unknown as { name: string; id: string; input?: Record<string, unknown> }
      setActiveToolName(serverBlock.name)
      setActiveToolInput(serverBlock.input || null)
      await sseHandler.sendToolEvent(serverBlock.name, 'start', serverBlock.input)
    }

    // Handle web fetch results
    if (block?.type === 'web_fetch_tool_result') {
      await processWebFetchResult(block.content as WebFetchResultContent, sseHandler)
    }

    // Handle web search results
    if (block?.type === 'web_search_tool_result') {
      await processWebSearchResult(
        block.content as WebSearchResultContent[],
        activeToolInput,
        sseHandler
      )
    }
  } else if (event.type === 'content_block_stop') {
    setActiveToolName(null)
    setActiveToolInput(null)
  } else if (event.type === 'content_block_delta') {
    const delta = event.delta

    // Handle thinking_delta for extended thinking
    if ('thinking' in delta && delta.thinking) {
      await sseHandler.sendSSE({
        choices: [{ delta: { reasoning: delta.thinking } }],
      })
    }

    // Handle input_json_delta
    if ('partial_json' in delta && activeToolName) {
      try {
        const partialJson = (delta as { partial_json: string }).partial_json
        if (partialJson) {
          try {
            const parsed = JSON.parse(partialJson)
            if (parsed.query) {
              setActiveToolInput({ ...(activeToolInput || {}), query: parsed.query })
            }
          } catch {
            // Partial JSON not yet parseable
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }

    if ('text' in delta && delta.text) {
      await sseHandler.sendSSE({
        choices: [{ delta: { content: delta.text } }],
      })
    }

    // Handle citations using extracted processor
    const anyDelta = delta as { citations?: RawCitation[] }
    if (anyDelta.citations && Array.isArray(anyDelta.citations)) {
      const allCitations = processCitations(anyDelta.citations)

      if (allCitations.length > 0) {
        await sseHandler.sendSSE({
          choices: [{ delta: { citations: allCitations } }],
        })
      }
    }
  } else if (event.type === 'message_stop') {
    const message = event as unknown as { message?: { stop_reason?: string } }
    const stopReason = message.message?.stop_reason

    if (stopReason === 'max_tokens' && activeToolName) {
      console.warn(`[agent] max_tokens reached during tool "${activeToolName}"`)
      await sseHandler.sendSSE({
        choices: [{ delta: { content: '\n\n*Note: Response was truncated due to length limits.*' } }],
      })
    }

    if (stopReason === 'pause_turn') {
      console.log('[agent] pause_turn received - SDK will continue automatically')
      await sseHandler.sendSSE({
        choices: [{ delta: { pause_turn: true } }],
      })
    }
  }
}
