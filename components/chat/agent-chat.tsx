'use client'

import { useRef, useState, useCallback } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useChat } from '@/hooks/useChat'
import { useStreamResponse, buildMessageFromStreamState, type StreamState } from '@/hooks/useStreamResponse'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'
import type {
  ChatMessage,
  FileContentSegment,
  ImageContentSegment,
  TextContentSegment,
  WebSearchUserLocation,
} from '@/lib/types'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
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
import {
  CornerDownRight,
  CheckIcon,
  CopyIcon,
} from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { PROMPT_SUGGESTIONS } from '@/lib/constants'
import { readFileAsDataURL, isImageFile, isPdfFile } from '@/lib/utils'
import {
  isTextFile,
  resizeImageForVision,
  validateFile,
} from '@/lib/files'

export function AgentChat({ chatId }: { chatId?: string }) {
  const { user } = useAuth()
  const [hasJustCopied, setHasJustCopied] = useState(false)

  // Use custom hooks for chat state and stream processing
  const {
    id,
    messages,
    isLoading,
    error,
    containerId,
    abortControllerRef,
    setMessages,
    setIsLoading,
    setError,
    setContainerId,
    initializeChat,
    updateChat,
    generateTitle,
  } = useChat({ chatId })

  const { processStream, thinkingStartRef } = useStreamResponse()

  const sendMessage = useCallback(async (rawContent: string, filesToSend: File[] = []) => {
    const content = rawContent
    const useWebSearch = true

    const trimmed = content.trim()
    if ((trimmed.length === 0 && filesToSend.length === 0) || isLoading) {
      return
    }

    setError(null)

    // Validate all files before processing
    for (const file of filesToSend) {
      const validation = await validateFile(file)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }
      if (validation.warnings) {
        validation.warnings.forEach((warning) => console.log(`[vision] ${warning}`))
      }
    }

    const attachmentSummary =
      filesToSend.length > 0
        ? `\n\n[Attached files: ${filesToSend.map((file) => file.name).join(', ')}]`
        : ''

    const contentBase = trimmed || 'I have attached some files for you to review.'

    const textSegment: TextContentSegment = {
      type: 'text',
      text: `${contentBase}${attachmentSummary}`,
    }

    const imageFiles = filesToSend.filter(isImageFile)

    let imageSegments: ImageContentSegment[] = []

    if (imageFiles.length > 0) {
      try {
        imageSegments = await Promise.all(
          imageFiles.map(async (file) => ({
            type: 'image_url' as const,
            image_url: {
              url: await resizeImageForVision(file),
            },
          })),
        )
      } catch (imageError) {
        console.error(imageError)
        setError('Unable to process one of the attached images.')
        return
      }
    }

    // Handle PDF and text files as document segments
    const pdfFiles = filesToSend.filter(isPdfFile)
    const textFiles = filesToSend.filter(isTextFile)
    const documentFiles = [...pdfFiles, ...textFiles]

    let fileSegments: FileContentSegment[] = []

    if (documentFiles.length > 0) {
      try {
        fileSegments = await Promise.all(
          documentFiles.map(async (file) => ({
            type: 'file' as const,
            file: {
              filename: file.name,
              file_data: await readFileAsDataURL(file),
            },
          })),
        )
      } catch (fileError) {
        console.error(fileError)
        setError('Unable to read one of the attached documents.')
        return
      }
    }

    const richContentSegments =
      imageSegments.length > 0 || fileSegments.length > 0
        ? [textSegment, ...imageSegments, ...fileSegments]
        : undefined

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textSegment.text,
      richContent: richContentSegments,
      name: user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? 'User',
    }

    const assistantMessageId = crypto.randomUUID()

    // Start timing the assistant's "thinking" phase
    thinkingStartRef.current = Date.now()

    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      name: 'Yurie',
    }

    const nextMessages = [...messages, userMessage, assistantPlaceholder]
    setMessages(nextMessages)
    setIsLoading(true)

    // Initialize chat if needed
    let currentId = id
    if (!currentId) {
      currentId = await initializeChat(nextMessages)
      generateTitle(currentId, userMessage)
    } else {
      await updateChat(currentId, nextMessages)
    }

    abortControllerRef.current = new AbortController()

    const now = new Date()
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const date = now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Build user location for localized web search results
    const userLocation: WebSearchUserLocation = {
      type: 'approximate',
      timezone: timeZone,
    }
    
    const timezoneCountryMap: Record<string, string> = {
      'America': 'US',
      'US': 'US',
      'Canada': 'CA',
      'Europe': 'EU',
      'Asia': 'APAC',
      'Australia': 'AU',
      'Pacific': 'APAC',
    }
    const timezoneParts = timeZone.split('/')
    if (timezoneParts.length >= 1) {
      const region = timezoneParts[0]
      if (timezoneCountryMap[region]) {
        userLocation.country = timezoneCountryMap[region]
      }
      if (timezoneParts.length >= 2) {
        userLocation.region = timezoneParts[1].replace(/_/g, ' ')
      }
    }

    let finalStreamState: StreamState | null = null

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content, richContent }) => ({
            role,
            content: richContent ?? content,
          })),
          useWebSearch,
          userContext: { time, date, timeZone },
          containerId,
          userLocation,
        }),
      })

      if (!response.ok || !response.body) {
        let message = 'Something went wrong talking to the agent.'
        try {
          const data = (await response.json()) as { error?: string }
          message = data.error ?? message
        } catch {
          // ignore
        }
        setError(message)
        return
      }

      // Process the stream using the hook
      finalStreamState = await processStream(response, {
        onUpdate: (state) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg

              const { content, suggestions } = parseSuggestions(state.content)

              return {
                ...msg,
                content,
                suggestions,
                reasoning: state.reasoning.length > 0 ? state.reasoning : msg.reasoning,
                richContent: state.images.length > 0 ? [...state.images] : msg.richContent,
                thinkingDurationSeconds: state.thinkingTime ?? msg.thinkingDurationSeconds,
                toolUses: state.toolUses.length > 0 ? [...state.toolUses] : msg.toolUses,
                citations: state.citations.length > 0 ? [...state.citations] : msg.citations,
              }
            }),
          )
        },
        onContainerId: (newContainerId) => {
          setContainerId(newContainerId)
        },
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }
      console.error(err)
      setError('Network error while contacting the agent.')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null

      // Final save
      if (currentId && finalStreamState) {
        const finalMessages = nextMessages.map((msg) => {
          if (msg.id === assistantMessageId) {
            return buildMessageFromStreamState(msg, finalStreamState!)
          }
          return msg
        })

        await updateChat(currentId, finalMessages, finalStreamState.containerId)
      }
    }
  }, [
    isLoading, messages, id, containerId, user,
    setError, setMessages, setIsLoading, setContainerId,
    initializeChat, updateChat, generateTitle,
    abortControllerRef, thinkingStartRef, processStream,
  ])

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage(suggestion)
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setHasJustCopied(true)
        setTimeout(() => setHasJustCopied(false), 2000)
      })
      .catch(() => {
        // ignore clipboard errors
      })
  }

  const greetingText = 'hi there! ready to dive in?'

  return (
    <div className="relative h-full">
      <div className="flex h-full flex-col gap-4 pb-24">
        <div className="space-y-3">
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
                                    <Loader
                                      variant="text-shimmer"
                                      size="lg"
                                      text="Thinking"
                                    />
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
                                      <Loader
                                        variant="text-shimmer"
                                        size="sm"
                                        text=""
                                      />
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
                        onClick={() => handleCopyMessage(message.content)}
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
                  !isLoading && (
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
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={`${suggestion}-${i}`}
                            type="button"
                            onClick={() => handleSuggestionClick(suggestion)}
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
                  )}
              </div>
            )
          })}

          {!isLoading && messages.length === 0 && (
            <div className="mt-auto space-y-3">
              <div className="mb-5 text-lg font-medium">{greetingText}</div>
              <div className="flex flex-col space-y-0">
                <AnimatedBackground
                  enableHover
                  className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
                  transition={{
                    type: 'spring',
                    bounce: 0,
                    duration: 0.2,
                  }}
                >
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.prompt}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                      className="-mx-3 w-full cursor-pointer rounded-xl px-3 py-3 text-left"
                      data-id={suggestion.title}
                    >
                      <div className="flex flex-col space-y-1">
                        <h4 className="font-normal dark:text-zinc-100">
                          {suggestion.title}
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          {suggestion.prompt}
                        </p>
                      </div>
                    </button>
                  ))}
                </AnimatedBackground>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
        <div className="pointer-events-auto bg-white dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-screen-sm px-4 pb-4 pt-3 sm:pb-5">
            <PromptInputBox
              isLoading={isLoading}
              onSend={sendMessage}
              className="w-full"
              placeholder="What's on your mind?"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentChat
