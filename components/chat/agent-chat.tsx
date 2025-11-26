'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getChat, saveChat, createChat } from '@/lib/history'
import { useAuth } from '@/components/providers/auth-provider'
import type {
  ChatMessage,
  FileContentSegment,
  ImageContentSegment,
  TextContentSegment,
  ToolUseEvent,
  WebSearchUserLocation,
  MessageCitation,
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
import {
  readFileAsDataURL,
  isImageFile,
  isPdfFile,
  isTextFile,
  resizeImageForVision,
  validateFile,
} from '@/lib/utils'

const initialMessages: ChatMessage[] = []

export function AgentChat({ chatId }: { chatId?: string }) {
  const router = useRouter()
  const { user } = useAuth()

  const [id, setId] = useState<string | undefined>(chatId)
  const [messages, setMessages] =
    useState<ChatMessage[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasJustCopied, setHasJustCopied] = useState(false)
  // Container ID for code execution persistence across messages
  const [containerId, setContainerId] = useState<string | undefined>(undefined)

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    async function loadChat() {
      if (chatId) {
        const chat = await getChat(chatId, user?.id)
        if (chat) {
          setId(chatId)
          setMessages(chat.messages)
          // Restore container ID for code execution persistence
          setContainerId(chat.containerId)
        }
      } else {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }
        setId(undefined)
        setMessages([])
        setContainerId(undefined)
      }
    }
    loadChat()
  }, [chatId, user])

  // Track when the current assistant response started "thinking"
  // so we can freeze a per-message "Thought for Xs" duration once
  // the final answer begins streaming.
  const thinkingStartRef = useRef<number | null>(null)

  const sendMessage = async (rawContent: string, filesToSend: File[] = []) => {
    const content = rawContent;
    const useWebSearch = true;

    const trimmed = content.trim()
    if ((trimmed.length === 0 && filesToSend.length === 0) || isLoading) {
      return
    }

    setError(null)

    // Validate all files before processing
    // See: https://platform.claude.com/docs/en/build-with-claude/vision
    for (const file of filesToSend) {
      const validation = await validateFile(file)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }
      // Log warnings if any (e.g., image will be resized)
      if (validation.warnings) {
        validation.warnings.forEach((warning) => console.log(`[vision] ${warning}`))
      }
    }

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
        // Resize images for optimal Claude vision performance
        // Best practice: Resize to max 1568px to improve time-to-first-token
        // See: https://platform.claude.com/docs/en/build-with-claude/vision#evaluate-image-size
        imageSegments = await Promise.all(
          imageFiles.map(async (file) => ({
            type: 'image_url',
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

    // Start timing the assistant's "thinking" phase for this message.
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
      const newChat = createChat(nextMessages)
      currentId = newChat.id
      setId(currentId)
      await saveChat(newChat, user?.id)
      router.replace(`/?id=${currentId}`)

      // Generate title immediately
      void fetch('/api/agent/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [userMessage] }),
      })
        .then((res) => res.json())
        .then(async (data) => {
          if (data.title) {
            const latestChat = await getChat(currentId!, user?.id)
            if (latestChat) {
              latestChat.title = data.title
              await saveChat(latestChat, user?.id)
            }
          }
        })
        .catch((err) => console.error('Failed to generate title', err))
    } else {
      const chat = await getChat(currentId, user?.id)
      if (chat) {
        chat.messages = nextMessages
        chat.updatedAt = Date.now()
        await saveChat(chat, user?.id)
      }
    }

    // Track accumulated response for final save
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let accumulatedImages: ImageContentSegment[] = []
    let accumulatedThinkingTime: number | undefined
    let accumulatedToolUses: ToolUseEvent[] = []
    const accumulatedCitations: MessageCitation[] = []
    let responseContainerId: string | undefined

    abortControllerRef.current = new AbortController()

    const now = new Date()
    const time = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    const date = now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Build user location for localized web search results
    // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
    const userLocation: WebSearchUserLocation = {
      type: 'approximate',
      timezone: timeZone,
    }
    
    // Try to extract country from timezone (e.g., "America/New_York" -> US)
    // This is a best-effort approach based on IANA timezone naming
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
      // Use the city part as region if available
      if (timezoneParts.length >= 2) {
        userLocation.region = timezoneParts[1].replace(/_/g, ' ')
      }
    }

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
          userContext: {
            time,
            date,
            timeZone,
          },
          // Pass container ID for code execution persistence
          containerId,
          // Pass user location for localized web search results
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

            // Handle container ID for code execution persistence
            if (json.containerId) {
              responseContainerId = json.containerId
              setContainerId(json.containerId)
              continue
            }

            const choice = json.choices?.[0]

            const deltaContent =
              choice?.delta?.content ?? choice?.message?.content ?? ''

            let deltaReasoning = ''

            // Reasoning fields (OpenRouter-compatible format):
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
            
            const deltaImages = choice?.delta?.images
            const hasImageDelta = Array.isArray(deltaImages) && deltaImages.length > 0

            // Handle tool use events
            const toolUseEvent = choice?.delta?.tool_use as ToolUseEvent | undefined
            const hasToolUse = toolUseEvent && toolUseEvent.name && toolUseEvent.status

            // Handle citations from web search and search results
            // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#citations
            // See: https://platform.claude.com/docs/en/build-with-claude/search-results#citation-fields
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
                  // Include code execution details if present
                  codeExecution: toolUseEvent.codeExecution,
                  // Include web search details if present
                  webSearch: toolUseEvent.webSearch,
                },
              ]
            }

            // Track citations from web search, search results, and documents
            if (hasCitations && deltaCitations) {
              deltaCitations.forEach((citation) => {
                // Generate a unique key based on citation type
                const getCitationKey = (c: MessageCitation): string => {
                  if (c.type === 'web_search_result_location') return c.url
                  if (c.type === 'search_result_location') return c.source
                  // Document citations: use type + documentIndex + citedText as key
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
              // Enforce single image limit as per user requirement
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
                  richContent:
                    accumulatedImages.length > 0
                      ? [...accumulatedImages]
                      : message.richContent,
                  thinkingDurationSeconds:
                    accumulatedThinkingTime ?? message.thinkingDurationSeconds,
                  toolUses:
                    accumulatedToolUses.length > 0
                      ? [...accumulatedToolUses]
                      : message.toolUses,
                  // Include web search citations
                  citations:
                    accumulatedCitations.length > 0
                      ? [...accumulatedCitations]
                      : message.citations,
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
        const chat = await getChat(currentId, user?.id)
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
                richContent:
                  accumulatedImages.length > 0 ? [...accumulatedImages] : undefined,
                thinkingDurationSeconds: accumulatedThinkingTime,
                toolUses:
                  accumulatedToolUses.length > 0 ? [...accumulatedToolUses] : undefined,
                // Include web search citations
                citations:
                  accumulatedCitations.length > 0 ? [...accumulatedCitations] : undefined,
              }
            }
            return msg
          })

          chat.messages = finalMessages
          chat.updatedAt = Date.now()
          // Save container ID for code execution persistence
          if (responseContainerId) {
            chat.containerId = responseContainerId
          }
          await saveChat(chat, user?.id)
        }
      }
    }
  }

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

                        {message.richContent &&
                          message.richContent.length > 0 && (
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

                        {/* Display citations from documents, web search, and search results */}
                        {message.citations &&
                          message.citations.length > 0 &&
                          !isStreamingPlaceholder && (
                            <CitationsFooter citations={message.citations} />
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
            <div className="mt-auto space-y-3">
              <div className="mb-5 text-lg font-medium">
                {greetingText}
              </div>
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
        <div className="pointer-events-auto bg-white dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-screen-sm px-4 pb-4 pt-3 sm:pb-5">
            <PromptInputBox
              isLoading={isLoading}
              onSend={sendMessage}
              className="w-full"
              placeholder="Message Yurie"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentChat
