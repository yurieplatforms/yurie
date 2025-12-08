'use client'

import type { ChatMessage, MessageContentSegment } from '@/lib/types'
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
import { CornerDownRight, CheckIcon, CopyIcon, FileTextIcon } from 'lucide-react'
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
          <div key={message.id} className="flex flex-col gap-2">
            <Message from={message.role}>
              {message.role === 'user' ? (
                <UserMessageContent message={message} />
              ) : (
                <MessageContent from={message.role}>
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
                </MessageContent>
              )}
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

type UserMessageContentProps = {
  message: ChatMessage
}

function UserMessageContent({ message }: UserMessageContentProps) {
  // Extract attachments from richContent
  const attachments = message.richContent?.filter(
    (segment): segment is Exclude<MessageContentSegment, { type: 'text' }> =>
      segment.type !== 'text'
  ) || []

  const hasAttachments = attachments.length > 0
  const hasText = message.content?.trim()

  return (
    <div className="flex flex-col gap-3 items-end">
      {/* Attachment previews - outside bubble */}
      {hasAttachments && (
        <div className="flex flex-wrap gap-2 justify-end">
          {attachments.map((attachment, index) => (
            <AttachmentPreview key={index} attachment={attachment} />
          ))}
        </div>
      )}

      {/* Text content - inside bubble */}
      {hasText && (
        <div className={cn(
          "w-fit rounded-[var(--radius-xl)] px-5 py-3.5 shadow-sm",
          "bg-[var(--color-muted)] text-[var(--color-foreground)]",
          "dark:bg-[var(--color-surface-hover)] dark:text-[var(--color-foreground)]"
        )}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      )}
    </div>
  )
}

type AttachmentPreviewProps = {
  attachment: Exclude<MessageContentSegment, { type: 'text' }>
}

function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  if (attachment.type === 'image_url') {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
        <img
          src={attachment.image_url.url}
          alt="Attached image"
          className="max-h-48 max-w-full rounded-[var(--radius-lg)] object-cover"
        />
      </div>
    )
  }

  if (attachment.type === 'url_image') {
    return (
      <div className="relative overflow-hidden rounded-[var(--radius-lg)]">
        <img
          src={attachment.url_image.url}
          alt={attachment.url_image.alt || 'Attached image'}
          className="max-h-48 max-w-full rounded-[var(--radius-lg)] object-cover"
        />
      </div>
    )
  }

  if (attachment.type === 'file') {
    // For PDFs and other files, show a file icon with name (same style as chat bubble)
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--color-muted)] px-4 py-2.5 shadow-sm dark:bg-[var(--color-surface-hover)]">
        <FileTextIcon className="h-4 w-4 shrink-0 text-[var(--color-foreground)]/70" />
        <span className="max-w-[200px] truncate text-base text-[var(--color-foreground)]">
          {attachment.file.filename}
        </span>
      </div>
    )
  }

  if (attachment.type === 'url_document') {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--color-muted)] px-4 py-2.5 shadow-sm dark:bg-[var(--color-surface-hover)]">
        <FileTextIcon className="h-4 w-4 shrink-0 text-[var(--color-foreground)]/70" />
        <span className="max-w-[200px] truncate text-base text-[var(--color-foreground)]">
          {attachment.url_document.title || 'Document'}
        </span>
      </div>
    )
  }

  return null
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
                  <span className="text-base font-normal text-[var(--color-muted-foreground)]">
                    Thought for{' '}
                    {thoughtSeconds >= 60
                      ? `${Math.floor(thoughtSeconds / 60)}m ${thoughtSeconds % 60}s`
                      : `${thoughtSeconds}s`}
                  </span>
                ) : !isThinkingStage && !hasActiveToolUse ? (
                  <span className="text-base font-normal text-[var(--color-muted-foreground)]">
                    Thought
                  </span>
                ) : undefined
              }
            />
            <ReasoningContent>
              {hasReasoning ? (
                <MessageResponse className="italic text-[var(--color-muted-foreground)] prose-headings:text-[var(--color-muted-foreground)] prose-strong:text-[var(--color-muted-foreground)]">
                  {message.reasoning}
                </MessageResponse>
              ) : null}
            </ReasoningContent>
          </Reasoning>
        </div>
      )}

      {message.content && !isStreamingPlaceholder && (
        message.isError ? (
          <p className="text-red-500 dark:text-red-400">{message.content}</p>
        ) : (
          <MessageResponse>{message.content}</MessageResponse>
        )
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
            'group relative w-full cursor-pointer rounded-[var(--radius-xl)] px-3.5 py-2.5 text-left text-base font-normal transition-all duration-[var(--transition-base)]',
            'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
          )}
          data-id={`${suggestion}-${i}`}
        >
          <div className="flex items-center gap-3">
            <CornerDownRight className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)] transition-colors group-hover:text-[var(--color-foreground)]" />
            <span className="text-[var(--color-muted-foreground)] transition-colors group-hover:text-[var(--color-foreground)]">
              {suggestion}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
