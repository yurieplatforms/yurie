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
  MessageAction,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import { ArrowUp, CopyIcon, Paperclip, Square, X } from 'lucide-react'

type Role = UIMessage['role']

type ChatMessage = {
  id: string
  role: Role
  content: string
}

const createId = () => Math.random().toString(36).slice(2)

const initialMessages: ChatMessage[] = []

const promptSuggestions = [
  'Help me break down a complex task into clear steps.',
  'Debug this code and explain what was wrong.',
  'Brainstorm ideas for improving this product experience.',
]

export function AgentChat() {
  const [messages, setMessages] =
    useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [hasJustCopied, setHasJustCopied] = useState(false)

  const sendMessage = async (rawContent?: string) => {
    const source = rawContent ?? input
    const trimmed = source.trim()
    if ((trimmed.length === 0 && files.length === 0) || isLoading) {
      return
    }

    setError(null)

    const attachmentSummary =
      files.length > 0
        ? `\n\n[Attached files: ${files
            .map((file) => file.name)
            .join(', ')}]`
        : ''

    const contentBase =
      trimmed || 'I have attached some files for you to review.'

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: `${contentBase}${attachmentSummary}`,
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
          messages: nextMessages.map(({ role, content }) => ({
            role,
            content,
          })),
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
      setFiles((prev) => [...prev, ...newFiles])
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
        setTimeout(() => setHasJustCopied(false), 300)
      })
      .catch(() => {
        // ignore clipboard errors
      })
  }

  return (
    <div className="relative flex flex-col">
      <div className="flex-1">
        <div className="flex flex-col gap-4 pb-4">
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
                          <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <Loader
                              variant="text-shimmer"
                              size="sm"
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
                    isLastMessage &&
                    message.content.trim().length > 0 && (
                      <MessageActions>
                        <MessageAction
                          label="Copy message"
                          onClick={() => handleCopyMessage(message.content)}
                          className={
                            hasJustCopied
                              ? 'scale-90 bg-zinc-900/5 dark:bg-zinc-50/10'
                              : ''
                          }
                        >
                          <CopyIcon className="h-3 w-3" />
                        </MessageAction>
                      </MessageActions>
                    )}
                </div>
              )
            })}

            {!isLoading && messages.length === 0 && (
              <div className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                <p className="font-medium text-zinc-600 dark:text-zinc-300">
                  Try one of these prompts:
                </p>
                <div className="flex flex-wrap gap-2">
                  {promptSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="group relative inline-flex shrink-0 items-center gap-[1px] rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-black transition-colors duration-200 hover:bg-zinc-950 hover:text-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {suggestion}
                    </button>
                  ))}
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
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 border-t border-zinc-100 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
        <PromptInput
          isLoading={isLoading}
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          className="w-full"
        >
          {files.length > 0 && (
            <div className="-ml-2 flex flex-wrap gap-2 pb-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-3xl bg-zinc-900/5 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-50/10 dark:text-zinc-200"
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

          <PromptInputTextarea placeholder="Ask me anything..." />
          <PromptInputActions>
            <PromptInputAction tooltip="Attach files">
              <label
                htmlFor="file-upload"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl hover:bg-zinc-900/5 dark:hover:bg-zinc-50/10"
              >
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
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
                className="h-8 w-8 rounded-full bg-zinc-300 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800"
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
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}

export default AgentChat


