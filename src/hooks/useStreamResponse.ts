'use client'

/**
 * useStreamResponse Hook
 *
 * Processes Server-Sent Events (SSE) stream responses from the AI agent.
 * Handles real-time content, reasoning, tool use events, citations, and images.
 *
 * @module hooks/useStreamResponse
 */

import { useCallback, useRef } from 'react'
import type {
  ChatMessage,
  ImageContentSegment,
  ToolUseEvent,
  MessageCitation,
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
 * Accumulated state during stream processing
 */
export type StreamState = {
  /** Accumulated text content */
  content: string
  /** Accumulated reasoning/thinking content */
  reasoning: string
  /** Generated images */
  images: ImageContentSegment[]
  /** Time spent thinking in seconds */
  thinkingTime: number | undefined
  /** Tool use events (start/end) */
  toolUses: ToolUseEvent[]
  /** Citations from web search and documents */
  citations: MessageCitation[]
  /** Container ID for code execution persistence */
  containerId: string | undefined
  /** Error information if stream encountered an error */
  error: StreamError | undefined
}

/**
 * Callbacks for stream processing updates
 */
export type StreamCallbacks = {
  /** Called with updated state on each chunk */
  onUpdate: (state: StreamState) => void
  /** Called when container ID is received */
  onContainerId?: (id: string) => void
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
 * accumulates content, reasoning, tool uses, and citations.
 *
 * @returns Stream processing function and thinking timer ref
 *
 * @example
 * ```tsx
 * const { processStream, thinkingStartRef } = useStreamResponse()
 *
 * thinkingStartRef.current = Date.now()
 * const finalState = await processStream(response, {
 *   onUpdate: (state) => updateUI(state),
 *   onContainerId: (id) => saveContainerId(id),
 * })
 * ```
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
    let accumulatedImages: ImageContentSegment[] = []
    let accumulatedThinkingTime: number | undefined
    let accumulatedToolUses: ToolUseEvent[] = []
    const accumulatedCitations: MessageCitation[] = []
    let responseContainerId: string | undefined
    let accumulatedError: StreamError | undefined
    
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
              images: accumulatedImages,
              thinkingTime: accumulatedThinkingTime,
              toolUses: accumulatedToolUses,
              citations: accumulatedCitations,
              containerId: responseContainerId,
              error: accumulatedError,
            })
            continue
          }

          // Handle container ID for code execution persistence
          if (json.containerId) {
            responseContainerId = json.containerId
            callbacks.onContainerId?.(json.containerId)
            continue
          }

          const choice = json.choices?.[0]

          const deltaContent =
            choice?.delta?.content ?? choice?.message?.content ?? ''

          let deltaReasoning = ''

          // Reasoning fields (OpenRouter-compatible format)
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
          
          const deltaImages = choice?.delta?.images
          const hasImageDelta = Array.isArray(deltaImages) && deltaImages.length > 0

          // Handle tool use events
          const toolUseEvent = choice?.delta?.tool_use as ToolUseEvent | undefined
          const hasToolUse = toolUseEvent && toolUseEvent.name && toolUseEvent.status

          // Handle citations
          const deltaCitations = choice?.delta?.citations as MessageCitation[] | undefined
          const hasCitations = Array.isArray(deltaCitations) && deltaCitations.length > 0

          if (!hasContentDelta && !hasReasoningDelta && !hasImageDelta && !hasToolUse && !hasCitations) {
            continue
          }

          // Track tool use
          if (hasToolUse && toolUseEvent) {
            accumulatedToolUses = [
              ...accumulatedToolUses.filter(
                (t) =>
                  !(t.name === toolUseEvent.name && t.status === 'start' && toolUseEvent.status === 'end'),
              ),
              {
                name: toolUseEvent.name,
                status: toolUseEvent.status,
                input: toolUseEvent.input,
                result: toolUseEvent.result,
                webSearch: toolUseEvent.webSearch,
                exaSearch: toolUseEvent.exaSearch,
                exaAnswer: toolUseEvent.exaAnswer,
              },
            ]
          }

          // Track citations
          if (hasCitations && deltaCitations) {
            deltaCitations.forEach((citation) => {
              const getCitationKey = (c: MessageCitation): string => {
                if (c.type === 'web_search_result_location') return c.url
                if (c.type === 'search_result_location') return c.source
                return `${c.type}:${c.documentIndex}:${c.citedText.slice(0, 50)}`
              }
              const citationKey = getCitationKey(citation)
              const exists = accumulatedCitations.some(c => getCitationKey(c) === citationKey)
              if (!exists) {
                accumulatedCitations.push(citation)
              }
            })
          }

          // Update accumulated values
          const hadAnswerBefore = accumulatedContent.length > 0
          if (hasContentDelta) {
            accumulatedContent += deltaContent as string
          }
          if (hasReasoningDelta) {
            accumulatedReasoning += deltaReasoning
          }
          if (hasImageDelta) {
            deltaImages.forEach((img: { image_url: { url: string } }) => {
              const exists = accumulatedImages.some(
                (existing) => existing.image_url.url === img.image_url.url,
              )
              if (!exists) {
                accumulatedImages.push({
                  type: 'image_url',
                  image_url: { url: img.image_url.url },
                })
              }
            })
            // Enforce single image limit
            if (accumulatedImages.length > 1) {
              accumulatedImages = [accumulatedImages[0]]
            }
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
              images: accumulatedImages,
              thinkingTime: accumulatedThinkingTime,
              toolUses: accumulatedToolUses,
              citations: accumulatedCitations,
              containerId: responseContainerId,
              error: accumulatedError,
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
      images: accumulatedImages,
      thinkingTime: accumulatedThinkingTime,
      toolUses: accumulatedToolUses,
      citations: accumulatedCitations,
      containerId: responseContainerId,
      error: accumulatedError,
    })

    return {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      images: accumulatedImages,
      thinkingTime: accumulatedThinkingTime,
      toolUses: accumulatedToolUses,
      citations: accumulatedCitations,
      containerId: responseContainerId,
      error: accumulatedError,
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
    richContent: state.images.length > 0 ? [...state.images] : undefined,
    thinkingDurationSeconds: state.thinkingTime,
    toolUses: state.toolUses.length > 0 ? [...state.toolUses] : undefined,
    citations: state.citations.length > 0 ? [...state.citations] : undefined,
  }
}

