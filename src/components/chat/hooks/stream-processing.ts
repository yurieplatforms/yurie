/**
 * Stream processing utilities (client)
 *
 * This module contains the heavy SSE parsing logic so the React hook wrapper can
 * remain small and easy to maintain.
 */

import type { MutableRefObject } from 'react'
import type {
  ToolUseStatus,
  ResearchProgressState,
  ResearchStage,
  ResearchSource,
} from '@/lib/types'
import type { BackgroundResponseStatus } from '@/lib/ai/api/types'

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
  type: 'chat' | 'agent' | 'research'
  /** Reason for mode selection */
  reason: string
  /** Confidence level of the classification */
  confidence: 'high' | 'medium' | 'low'
  /** Reasoning effort level being used */
  reasoningEffort: 'none' | 'low' | 'medium' | 'high' | 'xhigh'
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
  /** Research progress state for research mode */
  researchProgress: ResearchProgressState | undefined
  /** Whether the stream is complete */
  isComplete: boolean
}

/**
 * Callbacks for stream processing updates
 */
export type StreamCallbacks = {
  /** Called with updated state on each chunk */
  onUpdate: (state: StreamState) => void
  /** Called when the server emits a background-mode status/id update */
  onBackground?: (background: {
    responseId: string
    status: BackgroundResponseStatus
    message?: string
  }) => void
}

export async function processAgentSSEStream(options: {
  response: Response
  callbacks: StreamCallbacks
  thinkingStartRef: MutableRefObject<number | null>
}): Promise<StreamState> {
  const { response, callbacks, thinkingStartRef } = options

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

  // Research progress tracking
  let researchProgress: ResearchProgressState | undefined
  const researchSources: ResearchSource[] = []
  const searchQueries: string[] = []
  let researchStartTime: number | undefined

  let lastUpdateTime = 0
  const THROTTLE_MS = 50

  const emitUpdate = (isComplete: boolean) => {
    callbacks.onUpdate({
      content: accumulatedContent,
      reasoning: accumulatedReasoning,
      thinkingTime: accumulatedThinkingTime,
      error: accumulatedError,
      activeToolUse,
      toolUseHistory,
      mode: accumulatedMode,
      researchProgress,
      isComplete,
    })
  }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = JSON.parse(dataPart)

        // Handle SSE error events from the server
        if (json.error) {
          accumulatedError = {
            type: json.error.type ?? 'unknown_error',
            message: json.error.message ?? 'An unexpected error occurred',
            retryable: json.error.retryable ?? false,
            retryAfterMs: json.error.retryAfterMs,
          }

          if (researchProgress) {
            researchProgress = {
              ...researchProgress,
              stage: 'failed' as ResearchStage,
              currentActivity: 'Research failed',
            }
          }

          emitUpdate(false)
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

          if (json.mode.type === 'research') {
            researchStartTime = Date.now()
            researchProgress = {
              stage: 'starting',
              sourcesFound: 0,
              sourcesAnalyzed: 0,
              sources: [],
              searchQueries: [],
              startTime: researchStartTime,
            }
          }

          emitUpdate(false)
          continue
        }

        // Handle tool use events
        if (json.tool_use) {
          const toolEvent = json.tool_use as ToolUseStatus

          if (
            toolEvent.status === 'completed' ||
            toolEvent.status === 'failed' ||
            toolEvent.status === 'error'
          ) {
            toolUseHistory.push(toolEvent)
            activeToolUse = null

            if (researchProgress && toolEvent.tool.toLowerCase().includes('search')) {
              researchProgress = {
                ...researchProgress,
                stage: 'analyzing' as ResearchStage,
                currentActivity: 'Analyzing search results...',
              }
            }
          } else {
            activeToolUse = toolEvent

            if (researchProgress) {
              const toolName = toolEvent.tool.toLowerCase()
              if (toolName.includes('search')) {
                researchProgress = {
                  ...researchProgress,
                  stage: 'searching' as ResearchStage,
                  currentActivity: toolEvent.details || 'Searching the web...',
                }

                if (toolEvent.details && !searchQueries.includes(toolEvent.details)) {
                  searchQueries.push(toolEvent.details)
                  researchProgress.searchQueries = [...searchQueries]
                }
              }
            }
          }

          emitUpdate(false)
          continue
        }

        // Handle tool result events (returned data from tool execution)
        if (json.tool_result) {
          if (researchProgress) {
            const result = json.tool_result
            const toolName = (result.tool || result.name || '').toLowerCase()

            if (toolName.includes('search') && result.success !== false) {
              let newSourceCount = 1

              try {
                const output =
                  typeof result.output === 'string'
                    ? JSON.parse(result.output)
                    : result.output

                if (output?.results && Array.isArray(output.results)) {
                  newSourceCount = output.results.length

                  for (const source of output.results) {
                    if (
                      source.url &&
                      !researchSources.find((s) => s.url === source.url)
                    ) {
                      researchSources.push({
                        url: source.url,
                        title: source.title,
                        status: 'found' as const,
                      })
                    }
                  }
                }
              } catch {
                // ignore parse errors
              }

              researchProgress = {
                ...researchProgress,
                sourcesFound: researchProgress.sourcesFound + newSourceCount,
                sources: [...researchSources],
                stage: 'analyzing' as ResearchStage,
                currentActivity: `Analyzing ${researchProgress.sourcesFound + newSourceCount} sources...`,
              }

              emitUpdate(false)
            }
          }
          continue
        }

        // Background mode events (optional UI)
        if (json.background) {
          const responseId = json.background.responseId
          const status = json.background.status as BackgroundResponseStatus | undefined

          if (typeof responseId === 'string' && responseId.length > 0 && status) {
            callbacks.onBackground?.({
              responseId,
              status,
              message:
                typeof json.background.message === 'string'
                  ? json.background.message
                  : undefined,
            })
          }
          continue
        }

        // Research stage events
        if (json.research_stage) {
          const { stage, activity } = json.research_stage
          if (researchProgress && stage) {
            researchProgress = {
              ...researchProgress,
              stage: stage as ResearchStage,
              currentActivity: activity,
            }
            emitUpdate(false)
          }
          continue
        }

        // Research sources event (citations)
        if (json.research_sources && Array.isArray(json.research_sources)) {
          if (researchProgress) {
            for (const source of json.research_sources) {
              if (source.url && !researchSources.find((s) => s.url === source.url)) {
                researchSources.push({
                  url: source.url,
                  title: source.title,
                  status: 'analyzed' as const,
                })
              }
            }

            researchProgress = {
              ...researchProgress,
              sourcesFound: researchSources.length,
              sourcesAnalyzed: researchSources.length,
              sources: [...researchSources],
            }

            emitUpdate(false)
          }
          continue
        }

        // Generated image events
        if (json.generated_image) {
          const { base64, prompt } = json.generated_image
          accumulatedContent += `\n\n![${prompt}](data:image/png;base64,${base64})\n\n`
          emitUpdate(false)
          continue
        }

        const choice = json.choices?.[0]

        const deltaContent = choice?.delta?.content ?? choice?.message?.content ?? ''

        let deltaReasoning = ''

        const directReasoning = choice?.delta?.reasoning
        if (typeof directReasoning === 'string' && directReasoning.length > 0) {
          deltaReasoning += directReasoning
        } else {
          const reasoningDetails = choice?.delta?.reasoning_details
          if (Array.isArray(reasoningDetails)) {
            for (const detail of reasoningDetails) {
              if (detail?.type === 'reasoning.text' && typeof detail.text === 'string') {
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

        const hasContentDelta = typeof deltaContent === 'string' && deltaContent.length > 0
        const hasReasoningDelta = typeof deltaReasoning === 'string' && deltaReasoning.length > 0

        if (!hasContentDelta && !hasReasoningDelta) {
          continue
        }

        const hadAnswerBefore = accumulatedContent.length > 0

        if (hasContentDelta) {
          accumulatedContent += deltaContent as string
        }

        if (hasReasoningDelta) {
          accumulatedReasoning += deltaReasoning
        }

        if (
          !hadAnswerBefore &&
          hasContentDelta &&
          thinkingStartRef.current !== null &&
          accumulatedThinkingTime == null
        ) {
          const elapsed = Math.floor((Date.now() - thinkingStartRef.current) / 1000)
          accumulatedThinkingTime = Math.max(0, elapsed)
        }

        if (
          researchProgress &&
          accumulatedContent.length > 0 &&
          researchProgress.stage !== 'synthesizing' &&
          researchProgress.stage !== 'completed'
        ) {
          researchProgress = {
            ...researchProgress,
            stage: 'synthesizing' as ResearchStage,
            currentActivity: 'Synthesizing research findings...',
          }
        }

        const now = Date.now()
        if (now - lastUpdateTime > THROTTLE_MS) {
          lastUpdateTime = now
          emitUpdate(false)
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (researchProgress && accumulatedContent.length > 0) {
    researchProgress = {
      ...researchProgress,
      stage: 'completed' as ResearchStage,
      sourcesAnalyzed: researchProgress.sourcesFound,
      currentActivity: undefined,
    }
  }

  // Clear active tool use when done
  activeToolUse = null

  emitUpdate(true)

  return {
    content: accumulatedContent,
    reasoning: accumulatedReasoning,
    thinkingTime: accumulatedThinkingTime,
    error: accumulatedError,
    activeToolUse: null,
    toolUseHistory,
    mode: accumulatedMode,
    researchProgress,
    isComplete: true,
  }
}

