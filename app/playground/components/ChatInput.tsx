'use client'

import { useCallback, useRef } from 'react'
import { Globe, ImageIcon, ArrowUp, Square, Loader2 } from 'lucide-react'
import { MAX_IMAGE_BYTES } from '../utils'
import { ChatInputProps } from '../types'
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { FileList } from './FileComponents'

export function ChatInput({
  onSend,
  onSubmitWithMessage,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  stop,
  status,
  useWebSearch,
  onUseWebSearchToggle,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim())
    const hasAttachments = Boolean(files?.length)

    if (!(hasText || hasAttachments)) {
      return
    }

    if (onSubmitWithMessage) {
      onSubmitWithMessage(message.text || '', files || [])
    } else if (onSend) {
      onSend()
    }
  }, [onSend, onSubmitWithMessage, files])

  const handleStop = useCallback(() => {
    if (status === 'streaming' || status === 'submitted') {
      stop()
    }
  }, [status, stop])

  return (
    <div className="relative flex w-full flex-col gap-4">
      <div className="relative order-2 pb-3 sm:pb-4 md:order-1">
        <PromptInput
          className="relative z-10 w-full p-0 pt-0 shadow-none bg-[var(--color-background)]"
          onSubmit={handleSubmit}
          // Using native file input; disable PromptInput's attachment handling
        >
          <PromptInputBody>
            {/* Preview currently selected files using native list */}
            <FileList files={files} onFileRemove={onFileRemove} />
            <PromptInputTextarea
              placeholder="Ask Yurie"
              className="min-h-[60px] px-3 py-3 text-base leading-[1.3] sm:text-base md:text-base text-foreground/80 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            />
          </PromptInputBody>
          <PromptInputToolbar>
            <PromptInputTools>
              {/* Hidden native image input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? [])
                  const filtered = selected.filter((f) => {
                    const mime = (f.type || '').toLowerCase()
                    const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg'
                    const isPng = mime === 'image/png'
                    const withinLimit = f.size <= MAX_IMAGE_BYTES
                    return (isJpeg || isPng) && withinLimit
                  })
                  if (filtered.length > 0) onFileUpload(filtered)
                  if (e.target) e.target.value = ''
                }}
                className="sr-only"
                aria-label="Add images"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add images"
                title="Add images"
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-0 text-foreground/80 transition-colors hover:text-foreground cursor-pointer disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                <ImageIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={onUseWebSearchToggle}
                aria-pressed={useWebSearch}
                aria-label="Web search"
                title="Web search"
                className={
                  `inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ` +
                  (useWebSearch
                    ? 'border-2 border-accent bg-[var(--surface)] text-accent'
                    : 'border-[var(--border-color)] bg-[var(--surface)] text-foreground/80 hover:text-foreground') +
                  ' cursor-pointer disabled:cursor-not-allowed'
                }
                disabled={isSubmitting}
              >
                <Globe className="size-5" />
                <span className="text-xs font-medium">Search</span>
              </button>
              {/* Model selector removed; forced to grok-4-fast-reasoning */}
            </PromptInputTools>
            {status === 'streaming' ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] text-foreground/80 hover:text-foreground cursor-pointer"
                aria-label="Stop"
                title="Stop"
              >
                <Square className="size-4" />
              </button>
            ) : status === 'submitted' ? (
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] text-foreground/80 opacity-80"
                aria-label="Sending"
                title="Sending"
                disabled
              >
                <Loader2 className="size-4 animate-spin" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] text-foreground/80 hover:text-foreground cursor-pointer disabled:cursor-not-allowed"
                aria-label="Send"
                title="Send"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  )
}
