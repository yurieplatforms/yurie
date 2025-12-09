'use client'

/**
 * useStreamResponse Hook
 *
 * Processes Server-Sent Events (SSE) stream responses from the AI agent.
 * Handles real-time content, reasoning, and tool use.
 *
 * @module hooks/useStreamResponse
 */

import { useCallback, useRef } from 'react'
import type {
  ChatMessage,
  ToolUseStatus,
} from '@/lib/types'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'

/**
 * SSE error information from the server
 */
export type StreamError = {
  /** Error type identifier */
  type: string
  /** User-friendly error message */
  message: string
  /** Whether the error is retryable */
  retryable: boolean
  /** Suggested retry delay in milliseconds */
  retryAfterMs?: number
}

/**
 * Processing mode information from the server
 */
export type StreamMode = {
  /** Processing mode: 'chat' for simple queries, 'agent' for complex tasks */
  type: 'chat' | 'agent'
  /** Reason for mode selection */
  reason: string
  /** Confidence level of the classification */
  confidence: 'high' | 'medium' | 'low'
  /** Reasoning effort level being used */
  reasoningEffort: 'none' | 'low' | 'medium' | 'high'
}

/**
 * Accumulated state during stream processing
 */
export type StreamState = {
  /** Accumulated text content */
  content: string
  /** Accumulated reasoning/thinking content */
  reasoning: string
  /** Time spent thinking in seconds */
  thinkingTime: number | undefined
  /** Error information if stream encountered an error */
  error: StreamError | undefined
  /** Active tool use status */
  activeToolUse: ToolUseStatus | null
  /** History of completed tool uses */
  toolUseHistory: ToolUseStatus[]
  /** Processing mode information */
  mode: StreamMode | undefined
}

/**
 * Callbacks for stream processing updates
 */
export type StreamCallbacks = {
  /** Called with updated state on each chunk */
  onUpdate: (state: StreamState) => void
}

/**
 * Return type for the useStreamResponse hook
 */
export type UseStreamResponseReturn = {
  /** Process an SSE stream response */
  processStream: (
    response: Response,
    callbacks: StreamCallbacks,
  ) => Promise<StreamState>
  /** Ref to track when thinking started (for duration calculation) */
  thinkingStartRef: React.MutableRefObject<number | null>
}

/**
 * Hook for processing SSE stream responses from the agent
 *
 * Reads the response body as a stream, parses SSE events, and
 * accumulates content and reasoning.
 *
 * @returns Stream processing function and thinking timer ref
 */
export function useStreamResponse(): UseStreamResponseReturn {
  const thinkingStartRef = useRef<number | null>(null)

  const processStream = useCallback(async (
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<StreamState> => {
    if (!response.body) {
      throw new Error('Response body is null - cannot process stream')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')

    let buffer = ''
    let doneReading = false

    // Accumulated state
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let accumulatedThinkingTime: number | undefined
    let accumulatedError: StreamError | undefined
    let accumulatedMode: StreamMode | undefined
    let activeToolUse: ToolUseStatus | null = null
    const toolUseHistory: ToolUseStatus[] = []
    
    let lastUpdateTime = 0
    const THROTTLE_MS = 50

    while (!doneReading) {
      const { value, done } = await reader.read()
      if (done) {
        doneReading = true
        break
      }

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine.startsWith('data:')) continue

        const dataPart = trimmedLine.slice('data:'.length).trim()
        if (dataPart === '' || dataPart === '[DONE]') {
          continue
        }

        try {
          const json = JSON.parse(dataPart)

          // Handle SSE error events from the server
          if (json.error) {
            accumulatedError = {
              type: json.error.type ?? 'unknown_error',
              message: json.error.message ?? 'An unexpected error occurred',
              retryable: json.error.retryable ?? false,
              retryAfterMs: json.error.retryAfterMs,
            }
            callbacks.onUpdate({
              content: accumulatedContent,
              reasoning: accumulatedReasoning,
              thinkingTime: accumulatedThinkingTime,
              error: accumulatedError,
              activeToolUse,
              toolUseHistory,
              mode: accumulatedMode,
            })
            continue
          }

          // Handle mode event (sent at start of stream)
          if (json.mode) {
            accumulatedMode = {
              type: json.mode.type,
              reason: json.mode.reason,
              confidence: json.mode.confidence,
              reasoningEffort: json.mode.reasoningEffort,
            }
            callbacks.onUpdate({
              content: accumulatedContent,
              reasoning: accumulatedReasoning,
              thinkingTime: accumulatedThinkingTime,
              error: accumulatedError,
              activeToolUse,
              toolUseHistory,
              mode: accumulatedMode,
            })
            continue
          }

          // Handle tool use events
          if (json.tool_use) {
            const toolEvent = json.tool_use as ToolUseStatus
            
            if (toolEvent.status === 'completed' || toolEvent.status === 'failed') {
              // Move to history
              toolUseHistory.push(toolEvent)
              activeToolUse = null
            } else {
              // Update active tool
              activeToolUse = toolEvent
            }
            
            // Immediately notify of tool use updates
            callbacks.onUpdate({
              content: accumulatedContent,
              reasoning: accumulatedReasoning,
              thinkingTime: accumulatedThinkingTime,
              error: accumulatedError,
              activeToolUse,
              toolUseHistory,
              mode: accumulatedMode,
            })
            continue
          }

          // Handle generated image events
          if (json.generated_image) {
            const { base64, prompt } = json.generated_image
            // Append markdown image to content
            accumulatedContent += `\n\n![${prompt}](data:image/png;base64,${base64})\n\n`
            
            callbacks.onUpdate({
              content: accumulatedContent,
              reasoning: accumulatedReasoning,
              thinkingTime: accumulatedThinkingTime,
              error: accumulatedError,
              activeToolUse,
              toolUseHistory,
              mode: accumulatedMode,
            })
            continue
          }

          const choice = json.choices?.[0]

          const deltaContent =
            choice?.delta?.content ?? choice?.message?.content ?? ''

          let deltaReasoning = ''

          // Reasoning fields (OpenRouter-compatible format) or reasoning_details
          const directReasoning = choice?.delta?.reasoning
          if (
            typeof directReasoning === 'string' &&
            directReasoning.length > 0
          ) {
            deltaReasoning += directReasoning
          } else {
            const reasoningDetails = choice?.delta?.reasoning_details
            if (Array.isArray(reasoningDetails)) {
              for (const detail of reasoningDetails) {
                if (
                  detail?.type === 'reasoning.text' &&
                  typeof detail.text === 'string'
                ) {
                  deltaReasoning += detail.text
                } else if (
                  detail?.type === 'reasoning.summary' &&
                  typeof detail.summary === 'string'
                ) {
                  deltaReasoning += detail.summary
                }
              }
            }
          }

          const hasContentDelta =
            typeof deltaContent === 'string' && deltaContent.length > 0
          const hasReasoningDelta =
            typeof deltaReasoning === 'string' && deltaReasoning.length > 0
          
          if (!hasContentDelta && !hasReasoningDelta) {
            continue
          }

          // Update accumulated values
          const hadAnswerBefore = accumulatedContent.length > 0
          if (hasContentDelta) {
            accumulatedContent += deltaContent as string
          }
          if (hasReasoningDelta) {
            accumulatedReasoning += deltaReasoning
          }

          // Thinking time logic
          if (
            !hadAnswerBefore &&
            hasContentDelta &&
            thinkingStartRef.current !== null &&
            accumulatedThinkingTime == null
          ) {
            const elapsed = Math.floor(
              (Date.now() - thinkingStartRef.current) / 1000,
            )
            accumulatedThinkingTime = Math.max(0, elapsed)
          }

          // Notify of update
          const now = Date.now()
          if (now - lastUpdateTime > THROTTLE_MS) {
            lastUpdateTime = now
            callbacks.onUpdate({
              content: accumulatedContent,
              reasoning: accumulatedReasoning,
              thinkingTime: accumulatedThinkingTime,
              error: accumulatedError,
              activeToolUse,
              toolUseHistory,
              mode: accumulatedMode,
            })
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }

    // Final update to ensure we have the latest state
    callbacks.onUpdate({
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      thinkingTime: accumulatedThinkingTime,
      error: accumulatedError,
      activeToolUse: null, // Clear active tool use when done
      toolUseHistory,
      mode: accumulatedMode,
    })

    return {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      thinkingTime: accumulatedThinkingTime,
      error: accumulatedError,
      activeToolUse: null,
      toolUseHistory,
      mode: accumulatedMode,
    }
  }, [])

  return {
    processStream,
    thinkingStartRef,
  }
}

/**
 * Build the final message from stream state
 */
export function buildMessageFromStreamState(
  baseMessage: ChatMessage,
  state: StreamState,
): ChatMessage {
  const { content, suggestions } = parseSuggestions(state.content)

  return {
    ...baseMessage,
    content,
    suggestions,
    reasoning: state.reasoning.length > 0 ? state.reasoning : undefined,
    thinkingDurationSeconds: state.thinkingTime,
    activeToolUse: state.activeToolUse,
    toolUseHistory: state.toolUseHistory.length > 0 ? state.toolUseHistory : undefined,
    mode: state.mode ? {
      type: state.mode.type,
      reason: state.mode.reason,
      confidence: state.mode.confidence,
    } : undefined,
  }
}
