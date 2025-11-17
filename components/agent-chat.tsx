'use client'

import { useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/prompt-kit/loader'
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  ArrowUp,
  CheckIcon,
  CopyIcon,
  Paperclip,
  Globe,
  Square,
  X,
} from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/animated-background'

type Role = UIMessage['role']

type TextContentSegment = {
  type: 'text'
  text: string
}

type ImageContentSegment = {
  type: 'image_url'
  image_url: {
    url: string
  }
}

type FileContentSegment = {
  type: 'file'
  file: {
    filename: string
    file_data: string
  }
}

type MessageContentSegment =
  | TextContentSegment
  | ImageContentSegment
  | FileContentSegment

type ChatMessage = {
  id: string
  role: Role
  content: string
  richContent?: MessageContentSegment[]
}

const readFileAsDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
        return
      }
      reject(new Error('Failed to read file as data URL'))
    }
    reader.onerror = () => {
      reject(
        reader.error ?? new Error('An unknown error occurred while reading'),
      )
    }
    reader.readAsDataURL(file)
  })

const isImageFile = (file: File) => file.type?.startsWith('image/')

const isPdfFile = (file: File) =>
  file.type === 'application/pdf' ||
  file.name.toLowerCase().endsWith('.pdf')

const isSupportedFile = (file: File) => isImageFile(file) || isPdfFile(file)

const createId = () => Math.random().toString(36).slice(2)

const initialMessages: ChatMessage[] = []

const promptSuggestions = [
  {
    title: 'Reconstruct a forgotten turning point',
    prompt:
      'Choose a seemingly minor historical decision and argue how it quietly redirected technology, culture, or geopolitics.',
  },
  {
    title: 'Audit the science behind a legend',
    prompt:
      'Take any mythic ability or artifact and outline what physics, biology, or engineering breakthroughs it would really demand.',
  },
  {
    title: 'Storyboard an unlikely collab',
    prompt:
      'Pair two entertainers from different eras or genres and sketch the performance they’d co-create, including cultural context.',
  },
  {
    title: 'Decode hidden math in pop culture',
    prompt:
      'Spot a film, song, or game that secretly leans on math or science ideas and unpack how those concepts drive the story.',
  },
  {
    title: 'Spec tomorrow’s museum exhibit',
    prompt:
      'Design an immersive exhibit that lets visitors feel one pivotal discovery through artifacts, experiments, and media.',
  },
]

export function AgentChat() {
  const [messages, setMessages] =
    useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [useWebSearch, setUseWebSearch] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [hasJustCopied, setHasJustCopied] = useState(false)

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
      id: createId(),
      role: 'user',
      content: textSegment.text,
      richContent: richContentSegments,
    }

    const assistantMessageId = createId()

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

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
          const data = await response.json()
          message = (data as any)?.error ?? message
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
            const delta =
              json.choices?.[0]?.delta?.content ??
              json.choices?.[0]?.message?.content ??
              ''

            if (typeof delta !== 'string' || delta.length === 0) {
              continue
            }

            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content: message.content + delta,
                    }
                  : message,
              ),
            )
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      console.error(err)
      setError('Network error while contacting the agent.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = () => {
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
            const isStreamingPlaceholder =
              isAssistant && isLoading && message.content.length === 0
            const isLastMessage = index === messages.length - 1

            return (
              <div key={message.id} className="flex flex-col gap-1">
                <Message from={message.role}>
                  <MessageContent from={message.role}>
                    {isStreamingPlaceholder ? (
                      <p className="whitespace-pre-wrap">
                        <span className="inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                          <Loader
                            variant="text-shimmer"
                            size="lg"
                            text="Thinking…"
                          />
                        </span>
                      </p>
                    ) : message.role === 'assistant' ? (
                      <MessageResponse>{message.content}</MessageResponse>
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
                  {promptSuggestions.map((suggestion) => (
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
                placeholder="Ask me anything..."
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
                      disabled={isLoading && input.trim().length === 0}
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


