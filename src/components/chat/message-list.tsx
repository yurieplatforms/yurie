'use client'

import type { ChatMessage } from '@/lib/types'
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  StatusShimmer,
} from '@/components/ai/reasoning'
import { CornerDownRight, CheckIcon, CopyIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MessageListProps = {
  messages: ChatMessage[]
  isLoading: boolean
  hasJustCopied: boolean
  onCopyMessage: (content: string) => void
  onSuggestionClick: (suggestion: string) => void
}

export function MessageList({
  messages,
  isLoading,
  hasJustCopied,
  onCopyMessage,
  onSuggestionClick,
}: MessageListProps) {
  return (
    <>
      {messages.map((message, index) => {
        const isAssistant = message.role === 'assistant'
        const isLastMessage = index === messages.length - 1
        const isActiveAssistant = isAssistant && isLastMessage
        const hasReasoning =
          typeof message.reasoning === 'string' &&
          message.reasoning.trim().length > 0
        const thoughtSeconds = message.thinkingDurationSeconds
        const hasAnswerStarted = message.content.length > 0
        const isReasoningStreaming = isActiveAssistant && isLoading
        const isThinkingStage = isReasoningStreaming && !hasAnswerStarted
        const isStreamingPlaceholder =
          isAssistant && isLoading && message.content.length === 0

        return (
          <div key={message.id} className="flex flex-col gap-1">
            <Message from={message.role}>
              <MessageContent from={message.role}>
                {message.role === 'assistant' ? (
                  <AssistantMessageContent
                    message={message}
                    hasReasoning={hasReasoning}
                    isThinkingStage={isThinkingStage}
                    isReasoningStreaming={isReasoningStreaming}
                    isActiveAssistant={isActiveAssistant}
                    isLoading={isLoading}
                    thoughtSeconds={thoughtSeconds}
                    isStreamingPlaceholder={isStreamingPlaceholder}
                  />
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </MessageContent>
            </Message>

            {message.role === 'assistant' &&
              !isStreamingPlaceholder &&
              !isLoading &&
              isLastMessage &&
              message.content.trim().length > 0 && (
                <MessageActions>
                  <button
                    type="button"
                    onClick={() => onCopyMessage(message.content)}
                    className={`cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${
                      hasJustCopied ? 'scale-95' : ''
                    }`}
                    aria-label="Copy message"
                    title="Copy message"
                  >
                    {hasJustCopied ? (
                      <CheckIcon size={14} />
                    ) : (
                      <CopyIcon size={14} />
                    )}
                  </button>
                </MessageActions>
              )}

            {message.role === 'assistant' &&
              message.suggestions &&
              message.suggestions.length > 0 &&
              !isLoading &&
              isLastMessage && (
                <SuggestionsList
                  suggestions={message.suggestions}
                  onSuggestionClick={onSuggestionClick}
                />
              )}
          </div>
        )
      })}
    </>
  )
}

type AssistantMessageContentProps = {
  message: ChatMessage
  hasReasoning: boolean
  isThinkingStage: boolean
  isReasoningStreaming: boolean
  isActiveAssistant: boolean
  isLoading: boolean
  thoughtSeconds: number | undefined
  isStreamingPlaceholder: boolean
}

function AssistantMessageContent({
  message,
  hasReasoning,
  isThinkingStage,
  isReasoningStreaming,
  isActiveAssistant,
  isLoading,
  thoughtSeconds,
  isStreamingPlaceholder,
}: AssistantMessageContentProps) {
  const hasActiveToolUse = message.activeToolUse && (
    message.activeToolUse.status === 'in_progress' || 
    message.activeToolUse.status === 'searching'
  )
  const showThinkingSection = hasReasoning || isThinkingStage || hasActiveToolUse

  return (
    <>
      {showThinkingSection && (
        <div className="mb-2">
          <Reasoning
            className="w-full"
            isStreaming={isReasoningStreaming && hasReasoning}
            isLoading={isActiveAssistant && isLoading}
          >
            <ReasoningTrigger
              isLoading={isActiveAssistant && isLoading}
              activeToolUse={isActiveAssistant ? message.activeToolUse : null}
              thinkingLabel={
                isThinkingStage && !hasActiveToolUse ? (
                  <StatusShimmer>Thinking</StatusShimmer>
                ) : undefined
              }
              label={
                !isThinkingStage && !hasActiveToolUse && typeof thoughtSeconds === 'number' ? (
                  <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                    Thought for{' '}
                    {thoughtSeconds >= 60
                      ? `${Math.floor(thoughtSeconds / 60)}m ${thoughtSeconds % 60}s`
                      : `${thoughtSeconds}s`}
                  </span>
                ) : !isThinkingStage && !hasActiveToolUse ? (
                  <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                    Thought
                  </span>
                ) : undefined
              }
            />
            <ReasoningContent>
              {hasReasoning ? (
                <MessageResponse className="italic text-zinc-500 dark:text-zinc-400 prose-headings:text-zinc-500 dark:prose-headings:text-zinc-400 prose-strong:text-zinc-500 dark:prose-strong:text-zinc-400">
                  {message.reasoning}
                </MessageResponse>
              ) : null}
            </ReasoningContent>
          </Reasoning>
        </div>
      )}

      {message.content && !isStreamingPlaceholder && (
        <MessageResponse>{message.content}</MessageResponse>
      )}

      {message.richContent && message.richContent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4">
          {message.richContent.map((segment, i) => {
            if (segment.type === 'image_url') {
              return (
                <img
                  key={i}
                  src={segment.image_url.url}
                  alt="Generated image"
                  className="max-w-full rounded-2xl"
                />
              )
            }
            return null
          })}
        </div>
      )}
    </>
  )
}

type SuggestionsListProps = {
  suggestions: string[]
  onSuggestionClick: (suggestion: string) => void
}

function SuggestionsList({
  suggestions,
  onSuggestionClick,
}: SuggestionsListProps) {
  return (
    <div className="mt-2 flex flex-col space-y-1">
      {suggestions.map((suggestion, i) => (
        <button
          key={`${suggestion}-${i}`}
          type="button"
          onClick={() => onSuggestionClick(suggestion)}
          className={cn(
            'group relative w-full cursor-pointer rounded-2xl px-3.5 py-2.5 text-left text-base font-normal transition-all duration-[var(--transition-base)]',
            'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
          )}
          data-id={`${suggestion}-${i}`}
        >
          <div className="flex items-center gap-3">
            <CornerDownRight className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-100" />
            <span className="text-zinc-700 transition-colors group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100">
              {suggestion}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
