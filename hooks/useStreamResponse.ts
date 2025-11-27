'use client'

import { useCallback, useRef } from 'react'
import type {
  ChatMessage,
  ImageContentSegment,
  ToolUseEvent,
  MessageCitation,
} from '@/lib/types'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'

export type StreamState = {
  content: string
  reasoning: string
  images: ImageContentSegment[]
  thinkingTime: number | undefined
  toolUses: ToolUseEvent[]
  citations: MessageCitation[]
  containerId: string | undefined
}

export type StreamCallbacks = {
  onUpdate: (state: StreamState) => void
  onContainerId?: (id: string) => void
}

export type UseStreamResponseReturn = {
  processStream: (
    response: Response,
    callbacks: StreamCallbacks,
  ) => Promise<StreamState>
  thinkingStartRef: React.MutableRefObject<number | null>
}

/**
 * Hook for processing SSE stream responses from the agent
 */
export function useStreamResponse(): UseStreamResponseReturn {
  const thinkingStartRef = useRef<number | null>(null)

  const processStream = useCallback(async (
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<StreamState> => {
    const reader = response.body!.getReader()
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
                codeExecution: toolUseEvent.codeExecution,
                webSearch: toolUseEvent.webSearch,
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
          callbacks.onUpdate({
            content: accumulatedContent,
            reasoning: accumulatedReasoning,
            images: accumulatedImages,
            thinkingTime: accumulatedThinkingTime,
            toolUses: accumulatedToolUses,
            citations: accumulatedCitations,
            containerId: responseContainerId,
          })
        } catch {
          // ignore malformed chunks
        }
      }
    }

    return {
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      images: accumulatedImages,
      thinkingTime: accumulatedThinkingTime,
      toolUses: accumulatedToolUses,
      citations: accumulatedCitations,
      containerId: responseContainerId,
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

