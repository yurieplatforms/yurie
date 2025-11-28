'use client'

import type { ChatMessage } from '@/lib/types'
import { Loader } from '@/components/ai/loader'
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
} from '@/components/ai/reasoning'
import { CitationsFooter } from '@/components/ai/citations'
import { CornerDownRight, CheckIcon, CopyIcon } from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/animated-background'

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
        const hasToolUses =
          Array.isArray(message.toolUses) && message.toolUses.length > 0

        return (
          <div key={message.id} className="flex flex-col gap-1">
            <Message from={message.role}>
              <MessageContent from={message.role}>
                {message.role === 'assistant' ? (
                  <AssistantMessageContent
                    message={message}
                    hasReasoning={hasReasoning}
                    isThinkingStage={isThinkingStage}
                    hasToolUses={hasToolUses}
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
  hasToolUses: boolean
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
  hasToolUses,
  isReasoningStreaming,
  isActiveAssistant,
  isLoading,
  thoughtSeconds,
  isStreamingPlaceholder,
}: AssistantMessageContentProps) {
  return (
    <>
      {(hasReasoning || isThinkingStage || hasToolUses) && (
        <div className="mb-2">
          <Reasoning
            className="w-full"
            isStreaming={isReasoningStreaming && hasReasoning}
            toolUses={message.toolUses}
            isLoading={isActiveAssistant && isLoading}
          >
            <ReasoningTrigger
              toolUses={message.toolUses}
              isLoading={isActiveAssistant && isLoading}
              thinkingLabel={
                isThinkingStage ? (
                  <Loader variant="text-shimmer" size="lg" text="Thinking" />
                ) : undefined
              }
              label={
                !isThinkingStage && typeof thoughtSeconds === 'number' ? (
                  <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                    Thought for{' '}
                    {thoughtSeconds >= 60
                      ? `${Math.floor(thoughtSeconds / 60)}m ${thoughtSeconds % 60}s`
                      : `${thoughtSeconds}s`}
                  </span>
                ) : !isThinkingStage ? (
                  <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                    Thought
                  </span>
                ) : undefined
              }
            />
            <ReasoningContent>
              {hasReasoning ? (
                <MessageResponse className="italic">
                  {message.reasoning}
                </MessageResponse>
              ) : (
                isThinkingStage && (
                  <span className="inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Loader variant="text-shimmer" size="sm" text="" />
                  </span>
                )
              )}
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
                  className="max-w-full rounded-lg"
                />
              )
            }
            return null
          })}
        </div>
      )}

      {message.citations &&
        message.citations.length > 0 &&
        !isStreamingPlaceholder && (
          <CitationsFooter citations={message.citations} />
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
    <div className="mt-2 flex flex-col space-y-0">
      <AnimatedBackground
        enableHover
        className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
        transition={{
          type: 'spring',
          bounce: 0,
          duration: 0.2,
        }}
      >
        {suggestions.map((suggestion, i) => (
          <button
            key={`${suggestion}-${i}`}
            type="button"
            onClick={() => onSuggestionClick(suggestion)}
            className="-mx-3 w-full cursor-pointer rounded-xl px-3 py-3 text-left group"
            data-id={`${suggestion}-${i}`}
          >
            <div className="flex items-center gap-3">
              <CornerDownRight className="h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
              <span className="text-base font-normal text-zinc-700 dark:text-zinc-300">
                {suggestion}
              </span>
            </div>
          </button>
        ))}
      </AnimatedBackground>
    </div>
  )
}

