'use client'

/**
 * useStreamResponse Hook
 *
 * Thin React wrapper around the SSE stream parser.
 */

import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { ChatMessage } from '@/lib/types'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'
import {
  processAgentSSEStream,
  type StreamCallbacks,
  type StreamState,
} from './stream-processing'

export type {
  StreamCallbacks,
  StreamError,
  StreamMode,
  StreamState,
} from './stream-processing'

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
  thinkingStartRef: MutableRefObject<number | null>
}

export function useStreamResponse(): UseStreamResponseReturn {
  const thinkingStartRef = useRef<number | null>(null)

  const processStream = useCallback(
    async (response: Response, callbacks: StreamCallbacks) => {
      return processAgentSSEStream({ response, callbacks, thinkingStartRef })
    },
    [thinkingStartRef],
  )

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
    toolUseHistory:
      state.toolUseHistory.length > 0 ? state.toolUseHistory : undefined,
    mode: state.mode
      ? {
          type: state.mode.type,
          reason: state.mode.reason,
          confidence: state.mode.confidence,
        }
      : undefined,
    researchProgress: state.researchProgress,
  }
}
