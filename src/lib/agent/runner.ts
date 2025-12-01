/**
 * Agent Runner
 *
 * Orchestrates the AI agent with Anthropic's Claude model.
 * Handles streaming responses, tool execution, and SSE output.
 *
 * Implements extended thinking and effort parameter best practices:
 * @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking
 * @see https://platform.claude.com/docs/en/build-with-claude/effort
 *
 * Implements web search with prompt caching for multi-turn conversations:
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 * @see https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 *
 * @module lib/agent/runner
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// Agent modules
import { createSSEHandler, sendDoneSignal } from '@/lib/agent/sse-handler'
import {
  parseAnthropicError,
  createSSEErrorPayload,
  logAnthropicError,
} from '@/lib/agent/errors'
import { createRunnableTools } from '@/lib/agent/runnable-tools'
import { createMemoryTool } from '@/lib/agent/memory-tool-config'
import {
  processCitations,
  processWebFetchResult,
  processWebSearchResult,
  type WebFetchResultContent,
  type WebSearchResultContent,
} from '@/lib/agent/stream-processor'

// Types
import type {
  StreamEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  MessageStopEvent,
  ToolUseContentBlock,
  ServerToolUseContentBlock,
  RawCitation,
  EffortLevel,
} from '@/lib/agent/types'

// Tools
import { createServerTools } from '@/lib/tools'
import { createMemoryToolHandler } from '@/lib/tools/memory'
import type { WebSearchUserLocation } from '@/lib/types'

// ============================================================================
// Extended Thinking Configuration
// ============================================================================

/**
 * Extended thinking budget configuration based on Anthropic best practices.
 *
 * - Minimum budget: 1,024 tokens
 * - Recommended starting point for complex tasks: 16k+ tokens
 * - For thinking budgets above 32k, batch processing is recommended
 *
 * The budget_tokens is a target, not a strict limit—actual usage may vary.
 *
 * @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking#working-with-thinking-budgets
 */
const THINKING_CONFIG = {
  /** Default budget for standard tasks */
  DEFAULT_BUDGET: 10000,
  /** Budget for complex reasoning tasks (recommended 16k+) */
  COMPLEX_TASK_BUDGET: 16000,
  /** Minimum allowed budget */
  MIN_BUDGET: 1024,
  /** Threshold above which batch processing is recommended */
  BATCH_THRESHOLD: 32000,
} as const

// ============================================================================
// Prompt Caching Configuration
// ============================================================================

/**
 * Minimum number of messages to enable caching.
 *
 * Caching is most beneficial for multi-turn conversations where
 * previous context (including web search results) can be reused.
 *
 * @see https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 */
const CACHING_CONFIG = {
  /** Minimum messages before enabling cache_control */
  MIN_MESSAGES_FOR_CACHING: 2,
} as const

/**
 * Adds cache_control breakpoint to the last user message for prompt caching.
 *
 * This enables caching of previous conversation context including:
 * - Previous web search results (encrypted_content)
 * - Previous tool results and assistant responses
 * - Document content (PDFs, text files)
 *
 * @param messages - Array of messages to process
 * @returns Messages with cache_control added to the last user message
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#prompt-caching
 */
function addCacheControlToMessages(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  if (messages.length < CACHING_CONFIG.MIN_MESSAGES_FOR_CACHING) {
    return messages
  }

  // Find the last user message index
  let lastUserIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIndex = i
      break
    }
  }

  if (lastUserIndex === -1) {
    return messages
  }

  // Clone messages and add cache_control to last user message
  return messages.map((msg, index) => {
    if (index === lastUserIndex) {
      // Handle both string and array content
      if (typeof msg.content === 'string') {
        return {
          ...msg,
          content: [
            {
              type: 'text' as const,
              text: msg.content,
              cache_control: { type: 'ephemeral' as const },
            },
          ],
        }
      } else if (Array.isArray(msg.content)) {
        // Add cache_control to the last cacheable content block (not thinking blocks)
        const content = [...msg.content]
        // Find the last cacheable block (text, image, document, or tool_result)
        for (let i = content.length - 1; i >= 0; i--) {
          const block = content[i]
          if ('type' in block && (block.type === 'text' || block.type === 'image' || block.type === 'document' || block.type === 'tool_result')) {
            content[i] = {
              ...block,
              cache_control: { type: 'ephemeral' as const },
            } as typeof block
            break
          }
        }
        return { ...msg, content }
      }
    }
    return msg
  })
}

/**
 * Parameters for running the agent
 */
export type RunnerParams = {
  /** Anthropic API key */
  apiKey: string
  /** Conversation messages in Anthropic format */
  messages: Anthropic.MessageParam[]
  /** System prompt with user context */
  systemPrompt: string
  /** User location for localized web search */
  userLocation?: WebSearchUserLocation
  /** User ID for memory tool access */
  userId?: string
  /**
   * Effort level for controlling token usage.
   *
   * **Note: Only supported by Claude Opus 4.5 models.**
   * This parameter is ignored for Sonnet and other models.
   *
   * - `high`: Maximum capability (default)
   * - `medium`: Balanced approach
   * - `low`: Most efficient
   *
   * @default 'high'
   * @see https://platform.claude.com/docs/en/build-with-claude/effort
   */
  effort?: EffortLevel
  /**
   * Custom thinking budget in tokens.
   * Must be >= 1024 and < max_tokens.
   *
   * @default 16000
   * @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking#working-with-thinking-budgets
   */
  thinkingBudget?: number
}

/**
 * Run the AI agent with streaming response
 *
 * Creates a streaming SSE response that sends real-time updates
 * as the agent thinks, uses tools, and generates content.
 *
 * Implements Anthropic best practices for extended thinking and effort:
 * - Extended thinking with interleaved thinking for tool use
 * - Configurable effort levels for token efficiency
 * - Proper thinking budget management
 *
 * @param params - Agent configuration and input
 * @returns SSE Response stream
 *
 * @example
 * ```ts
 * // Basic usage with defaults (high effort, 16k thinking budget)
 * const response = await runAgent({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   systemPrompt: 'You are a helpful assistant.',
 * })
 *
 * // Speed-optimized for simple tasks
 * const fastResponse = await runAgent({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   messages: [{ role: 'user', content: 'What is 2+2?' }],
 *   systemPrompt: 'You are a helpful assistant.',
 *   effort: 'low',
 *   thinkingBudget: 4000,
 * })
 * ```
 *
 * @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking
 * @see https://platform.claude.com/docs/en/build-with-claude/effort
 */
export async function runAgent({
  apiKey,
  messages,
  systemPrompt,
  userLocation,
  userId,
  effort = 'high',
  thinkingBudget = THINKING_CONFIG.COMPLEX_TASK_BUDGET,
}: RunnerParams): Promise<Response> {
  const anthropic = new Anthropic({ apiKey })

  // Validate thinking budget per Anthropic guidelines
  const validatedBudget = Math.max(thinkingBudget, THINKING_CONFIG.MIN_BUDGET)
  if (validatedBudget > THINKING_CONFIG.BATCH_THRESHOLD) {
    console.warn(
      `[agent] Thinking budget ${validatedBudget} exceeds ${THINKING_CONFIG.BATCH_THRESHOLD}. ` +
        'Consider using batch processing for long-running requests.',
    )
  }

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
        userLocation ? { userLocation } : undefined,
      )

      // Create memory tool handler for authenticated users
      const supabaseForMemory = await createClient()
      const memoryToolHandler = userId
        ? createMemoryToolHandler(supabaseForMemory, userId)
        : null

      // Create memory tool using the extracted factory
      const memoryTool = createMemoryTool(sseHandler, memoryToolHandler)

      // The tools array contains mixed types from different sources (runnable, memory, server)
      // Since these are beta features, we need to cast the tools array
      const tools = [...runnableTools, memoryTool, ...serverTools] as Anthropic.Tool[]

      // Model selection
      // Note: Effort parameter is ONLY supported by Claude Opus 4.5
      // @see https://platform.claude.com/docs/en/build-with-claude/effort
      const MODEL = 'claude-opus-4-5-20251101'
      const isOpusModel = MODEL.includes('opus')

      // Build beta headers list
      const betas = [
        'advanced-tool-use-2025-11-20',
        'fine-grained-tool-streaming-2025-05-14',
        'web-fetch-2025-09-10',
        'context-management-2025-06-27',
        // Note: structured-outputs-2025-11-13 was removed because it adds a `parsed` field
        // to text content blocks which causes "Extra inputs are not permitted" errors
        // when the SDK sends tool results back in multi-turn conversations
        // Required for extended thinking with tool use
        // Enables Claude to think between tool calls for more sophisticated reasoning
        // @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking#interleaved-thinking
        'interleaved-thinking-2025-05-14',
        // Only add effort beta header for Opus models
        // @see https://platform.claude.com/docs/en/build-with-claude/effort
        ...(isOpusModel ? ['effort-2025-11-24'] : []),
      ]

      // Apply prompt caching to messages for multi-turn conversation optimization
      // This caches previous context including web search results
      // @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#prompt-caching
      const cachedMessages = addCacheControlToMessages(messages)

      const runnerOptions: Parameters<
        typeof anthropic.beta.messages.toolRunner
      >[0] = {
        model: MODEL,
        // max_tokens must be greater than budget_tokens for thinking
        // Using 32k to allow for larger thinking budgets + response
        max_tokens: 32000,
        system: systemPrompt,
        messages: cachedMessages,
        tools,
        stream: true,
        max_iterations: 10,
        /**
         * Extended Thinking Configuration
         *
         * Enables Claude's enhanced reasoning capabilities for complex tasks.
         * Claude creates `thinking` content blocks with internal reasoning
         * before crafting the final response.
         *
         * Best practices:
         * - Start with larger budgets (16k+) for complex tasks
         * - For budgets above 32k, use batch processing
         * - budget_tokens is a target, not strict limit
         * - Thinking is incompatible with temperature/top_k modifications
         *
         * @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking
         */
        thinking: {
          type: 'enabled',
          budget_tokens: validatedBudget,
        },
        /**
         * Effort Parameter (Beta) - ONLY for Claude Opus 4.5
         *
         * Controls how eager Claude is about spending tokens.
         * Affects all tokens: text responses, tool calls, and thinking.
         *
         * - high: Maximum capability (default)
         * - medium: Balanced token savings
         * - low: Most efficient, some capability reduction
         *
         * Note: This parameter is ignored for non-Opus models.
         * @see https://platform.claude.com/docs/en/build-with-claude/effort
         */
        ...(isOpusModel && { output_config: { effort } }),
        // Beta features
        betas,
        // Context editing - beta feature not fully typed in SDK
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
        },
      }

      const runner = anthropic.beta.messages.toolRunner(runnerOptions)

      // Track active tool calls for max_tokens handling
      let activeToolName: string | null = null
      let activeToolInput: Record<string, unknown> | null = null

      for await (const messageStream of runner) {
        for await (const event of messageStream as AsyncIterable<StreamEvent>) {
          await handleStreamEvent(event, sseHandler, {
            activeToolName,
            activeToolInput,
            setActiveToolName: (name) => {
              activeToolName = name
            },
            setActiveToolInput: (input) => {
              activeToolInput = input
            },
          })
        }
      }

      // Send done signal
      await sendDoneSignal(writer)
      await writer.close()
    } catch (error) {
      // Parse the error to get structured information
      const agentError = parseAnthropicError(error)
      logAnthropicError('agent', error, agentError)

      try {
        // Send structured error event via SSE
        await sseHandler.sendSSE(createSSEErrorPayload(agentError))
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
  event: StreamEvent,
  sseHandler: ReturnType<typeof createSSEHandler>,
  context: StreamContext,
) {
  const {
    activeToolName,
    activeToolInput,
    setActiveToolName,
    setActiveToolInput,
  } = context

  if (event.type === 'content_block_start') {
    const startEvent = event as ContentBlockStartEvent
    const block = startEvent.content_block

    if (block.type === 'tool_use') {
      const toolBlock = block as ToolUseContentBlock
      setActiveToolName(toolBlock.name)
      await sseHandler.sendToolEvent(toolBlock.name, 'start')
    } else if (block.type === 'server_tool_use') {
      const serverBlock = block as ServerToolUseContentBlock
      setActiveToolName(serverBlock.name)
      setActiveToolInput(serverBlock.input || null)
      await sseHandler.sendToolEvent(serverBlock.name, 'start', serverBlock.input)
    }

    // Handle web fetch results
    if (block.type === 'web_fetch_tool_result') {
      const webFetchBlock = block as { type: 'web_fetch_tool_result'; content: unknown }
      await processWebFetchResult(
        webFetchBlock.content as WebFetchResultContent,
        sseHandler,
      )
    }

    // Handle web search results
    if (block.type === 'web_search_tool_result') {
      const webSearchBlock = block as { type: 'web_search_tool_result'; content: unknown[] }
      await processWebSearchResult(
        webSearchBlock.content as WebSearchResultContent[],
        activeToolInput,
        sseHandler,
      )
    }
  } else if (event.type === 'content_block_stop') {
    setActiveToolName(null)
    setActiveToolInput(null)
  } else if (event.type === 'content_block_delta') {
    const deltaEvent = event as ContentBlockDeltaEvent
    const delta = deltaEvent.delta as Record<string, unknown>

    // Handle thinking_delta for extended thinking
    if (delta.thinking && typeof delta.thinking === 'string') {
      await sseHandler.sendSSE({
        choices: [{ delta: { reasoning: delta.thinking } }],
      })
    }

    // Handle input_json_delta
    if (delta.partial_json && activeToolName) {
      try {
        const partialJson = delta.partial_json as string
        if (partialJson) {
          try {
            const parsed = JSON.parse(partialJson) as Record<string, unknown>
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

    if (delta.text && typeof delta.text === 'string') {
      await sseHandler.sendSSE({
        choices: [{ delta: { content: delta.text } }],
      })
    }

    // Handle citations using extracted processor
    if (Array.isArray(delta.citations)) {
      const allCitations = processCitations(delta.citations as RawCitation[])

      if (allCitations.length > 0) {
        await sseHandler.sendSSE({
          choices: [{ delta: { citations: allCitations } }],
        })
      }
    }
  } else if (event.type === 'message_stop') {
    const stopEvent = event as MessageStopEvent
    const stopReason = stopEvent.message?.stop_reason

    if (stopReason === 'max_tokens' && activeToolName) {
      console.warn(`[agent] max_tokens reached during tool "${activeToolName}"`)
      await sseHandler.sendSSE({
        choices: [
          {
            delta: {
              content: '\n\n*Note: Response was truncated due to length limits.*',
            },
          },
        ],
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
