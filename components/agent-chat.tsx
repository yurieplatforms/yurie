'use client'

import { useRef, useState, useEffect } from 'react'
import type { UIMessage } from 'ai'
import { useRouter } from 'next/navigation'
import { getChat, saveChat, createChat } from '@/lib/history'
import type {
  ChatMessage,
  FileContentSegment,
  ImageContentSegment,
  TextContentSegment,
} from '@/lib/types'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ai/prompt-input'
import { Button } from '@/components/ui/button'
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
import {
  ArrowUp,
  CornerDownRight,
  CheckIcon,
  CopyIcon,
  Paperclip,
  Globe,
  Square,
  X,
} from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { PROMPT_SUGGESTIONS } from '@/lib/constants'
import {
  readFileAsDataURL,
  isImageFile,
  isPdfFile,
  isSupportedFile,
} from '@/lib/utils'

const initialMessages: ChatMessage[] = []

export function AgentChat({ chatId }: { chatId?: string }) {
  const router = useRouter()
  const [id, setId] = useState<string | undefined>(chatId)
  const [messages, setMessages] =
    useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [useWebSearch, setUseWebSearch] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [hasJustCopied, setHasJustCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (chatId) {
      const chat = getChat(chatId)
      if (chat) {
        setId(chatId)
        setMessages(chat.messages)
      }
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      setId(undefined)
      setMessages([])
    }
  }, [chatId, setId, setMessages])

  // Track when the current assistant response started "thinking"
  // so we can freeze a per-message "Thought for Xs" duration once
  // the final answer begins streaming.
  const thinkingStartRef = useRef<number | null>(null)

  const sendMessage = async (rawContent?: string) => {
    const source = rawContent ?? input
    const filesToSend = files
    const trimmed = source.trim()
    if ((trimmed.length === 0 && filesToSend.length === 0) || isLoading) {
      return
    }

    setError(null)

    const attachmentSummary =
      filesToSend.length > 0
        ? `\n\n[Attached files: ${filesToSend
            .map((file) => file.name)
            .join(', ')}]`
        : ''

    const contentBase =
      trimmed || 'I have attached some files for you to review.'

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
            type: 'image_url',
            image_url: {
              url: await readFileAsDataURL(file),
            },
          })),
        )
      } catch (imageError) {
        console.error(imageError)
        setError('Unable to read one of the attached images.')
        return
      }
    }

    const pdfFiles = filesToSend.filter(isPdfFile)

    let fileSegments: FileContentSegment[] = []

    if (pdfFiles.length > 0) {
      try {
        fileSegments = await Promise.all(
          pdfFiles.map(async (file) => ({
            type: 'file' as const,
            file: {
              filename: file.name,
              file_data: await readFileAsDataURL(file),
            },
          })),
        )
      } catch (fileError) {
        console.error(fileError)
        setError('Unable to read one of the attached PDFs.')
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
    }

    const assistantMessageId = crypto.randomUUID()

    // Start timing the assistant's "thinking" phase for this message.
    thinkingStartRef.current = Date.now()

    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    }

    const nextMessages = [...messages, userMessage, assistantPlaceholder]
    setMessages(nextMessages)
    setInput('')
    setFiles([])
    setIsLoading(true)

    // Initialize chat if needed
    let currentId = id
    if (!currentId) {
      const newChat = createChat(nextMessages)
      currentId = newChat.id
      setId(currentId)
      saveChat(newChat)
      router.replace(`/agent?id=${currentId}`)

      // Generate title immediately
      void fetch('/api/agent/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMessage] }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.title) {
            const latestChat = getChat(currentId!)
            if (latestChat) {
              latestChat.title = data.title
              saveChat(latestChat)
            }
          }
        })
        .catch((err) => console.error('Failed to generate title', err))
    } else {
      const chat = getChat(currentId)
      if (chat) {
        chat.messages = nextMessages
        chat.updatedAt = Date.now()
        saveChat(chat)
      }
    }

    // Track accumulated response for final save
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let accumulatedThinkingTime: number | undefined

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: nextMessages.map(
            ({ role, content, richContent }) => ({
              role,
              content: richContent ?? content,
            }),
          ),
          useWebSearch,
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

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')

      let buffer = ''
      let doneReading = false

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
            const choice = json.choices?.[0]

            const deltaContent =
              choice?.delta?.content ?? choice?.message?.content ?? ''

            let deltaReasoning = ''

            // Unified OpenRouter reasoning fields:
            // - `reasoning` plain-text field
            // - `reasoning_details` structured reasoning blocks
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

            setMessages((prev) => {
              const next = prev.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message
                }

                let content = accumulatedContent
                let suggestions: string[] | undefined

                if (accumulatedContent.includes('SUGGESTIONS:')) {
                  const parts = accumulatedContent.split('SUGGESTIONS:')
                  content = parts[0].trim()
                  suggestions = parts[1]
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.startsWith('-'))
                    .map((line) => line.slice(1).trim())
                }

                return {
                  ...message,
                  content,
                  suggestions,
                  reasoning:
                    accumulatedReasoning.length > 0
                      ? accumulatedReasoning
                      : message.reasoning,
                  thinkingDurationSeconds:
                    accumulatedThinkingTime ?? message.thinkingDurationSeconds,
                }
              })
              return next
            })
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Request was aborted, do nothing
        return
      }
      console.error(err)
      setError('Network error while contacting the agent.')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null

      // Final save and title generation
      if (currentId) {
        const chat = getChat(currentId)
        if (chat) {
          // Construct the final messages array
          const finalMessages = nextMessages.map((msg) => {
            if (msg.id === assistantMessageId) {
              let content = accumulatedContent
              let suggestions: string[] | undefined

              if (accumulatedContent.includes('SUGGESTIONS:')) {
                const parts = accumulatedContent.split('SUGGESTIONS:')
                content = parts[0].trim()
                suggestions = parts[1]
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.startsWith('-'))
                  .map((line) => line.slice(1).trim())
              }

              return {
                ...msg,
                content,
                suggestions,
                reasoning:
                  accumulatedReasoning.length > 0
                    ? accumulatedReasoning
                    : undefined,
                thinkingDurationSeconds: accumulatedThinkingTime,
              }
            }
            return msg
          })

          chat.messages = finalMessages
          chat.updatedAt = Date.now()
          saveChat(chat)
        }
      }
    }
  }

  const handleSubmit = () => {
    if (isLoading) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      return
    }
    void sendMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage(suggestion)
  }

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      const allowedFiles = newFiles.filter(isSupportedFile)

      if (allowedFiles.length !== newFiles.length) {
        setError('Only image and PDF files are supported.')
      }

      if (allowedFiles.length > 0) {
        setFiles((prev) => [...prev, ...allowedFiles])
      }

      event.target.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = ''
    }
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

  return (
    <div className="relative">
      <div className="flex flex-col gap-4 pb-32">
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

            return (
              <div key={message.id} className="flex flex-col gap-1">
                <Message from={message.role}>
                  <MessageContent from={message.role}>
                    {message.role === 'assistant' ? (
                      <>
                        {(hasReasoning || isThinkingStage) && (
                          <div className="mb-2">
                            <Reasoning
                              className="w-full"
                              isStreaming={isReasoningStreaming && hasReasoning}
                            >
                              <ReasoningTrigger
                                label={
                                  isThinkingStage ? (
                                    <Loader
                                      variant="text-shimmer"
                                      size="lg"
                                      text="Thinking"
                                    />
                                  ) : typeof thoughtSeconds === 'number' ? (
                                    <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                                      Thought for {thoughtSeconds}s
                                    </span>
                                  ) : (
                                    <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                                      Thought
                                    </span>
                                  )
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
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {message.content}
                      </p>
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
            <div className="space-y-3">
              <p className="mb-5 text-lg font-medium">
                How can I help you?
              </p>
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
                      onClick={() =>
                        handleSuggestionClick(suggestion.prompt)
                      }
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
          <p className="text-xs text-red-500 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full">
        <div className="pointer-events-auto mx-auto w-full max-w-screen-sm px-4">
          <div className="bg-white pb-4 pt-3 dark:bg-zinc-950 sm:pb-5">
            <PromptInput
              isLoading={isLoading}
              value={input}
              onValueChange={setInput}
              onSubmit={handleSubmit}
              className="w-full min-h-[96px]"
            >
              {files.length > 0 && (
                <div className="-ml-2 flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex h-8 items-center gap-2 rounded-2xl bg-zinc-900/5 px-3 text-xs text-zinc-700 dark:bg-zinc-50/10 dark:text-zinc-200"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="max-w-[140px] truncate">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="rounded-full p-1 hover:bg-zinc-900/5 dark:hover:bg-zinc-50/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <PromptInputTextarea
                placeholder="Ask anything"
                className={files.length > 0 ? 'mt-1 mb-1' : undefined}
              />
              <PromptInputActions className="justify-between">
                <div className="-ml-2 flex items-center gap-2">
                  <PromptInputAction>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setUseWebSearch((prev) => !prev)
                      }}
                      className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-2xl px-3 text-xs font-medium transition-colors ${
                        useWebSearch
                          ? 'bg-zinc-900/5 text-zinc-900 dark:bg-zinc-50/10 dark:text-zinc-50'
                          : 'text-zinc-500 hover:bg-zinc-900/5 dark:text-zinc-400 dark:hover:bg-zinc-50/10'
                      }`}
                      aria-pressed={useWebSearch}
                      aria-label="Toggle web search"
                    >
                      <Globe className="h-4 w-4" />
                      <span>Web Search</span>
                    </button>
                  </PromptInputAction>
                </div>

                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Attach files">
                    <label
                      htmlFor="file-upload"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl hover:bg-zinc-900/5 dark:hover:bg-zinc-50/10"
                    >
                      <input
                        ref={uploadInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                      />
                      <Paperclip className="h-4 w-4 text-zinc-400" />
                    </label>
                  </PromptInputAction>

                  <PromptInputAction
                    tooltip={isLoading ? 'Stop generation' : 'Send message'}
                  >
                    <Button
                      variant="default"
                      size="icon"
                      className="h-8 w-8 cursor-pointer rounded-full bg-zinc-900/5 text-zinc-900 hover:bg-zinc-900/10 dark:bg-zinc-50/10 dark:text-zinc-50 dark:hover:bg-zinc-50/20"
                      onClick={handleSubmit}
                      disabled={
                        isLoading
                          ? false
                          : input.trim().length === 0 && files.length === 0
                      }
                    >
                      {isLoading ? (
                        <Square className="h-4 w-4 fill-current" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </Button>
                  </PromptInputAction>
                </div>
              </PromptInputActions>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentChat
