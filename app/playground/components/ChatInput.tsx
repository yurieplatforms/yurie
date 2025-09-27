'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Globe, ImageIcon, ArrowUp, Square, Loader2, ChevronDown } from 'lucide-react'
import { MAX_IMAGE_BYTES } from '../utils'
import { ChatInputProps } from '../types'
import { modelOptions } from '../utils'
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
  modelChoice,
  onModelChange,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSizerRef = useRef<HTMLSpanElement>(null)
  const [modelSelectorWidth, setModelSelectorWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const computeWidth = () => {
      try {
        const sizer = modelSizerRef.current
        if (!sizer) return
        const contentWidth = Math.ceil(sizer.offsetWidth)
        // left padding 12px (pl-3) + right padding for chevron 28px (pr-7) + borders 2px
        const total = contentWidth + 12 + 28 + 2
        setModelSelectorWidth(total)
      } catch {}
    }
    computeWidth()
    window.addEventListener('resize', computeWidth)
    return () => window.removeEventListener('resize', computeWidth)
  }, [modelChoice])

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
        <div className="glass-input-wrap">
          <div className="glass-input-inner">
            <PromptInput
              className="relative z-10 w-full p-0 pt-0 shadow-none !bg-transparent !border-0"
              onSubmit={handleSubmit}
            >
              <PromptInputBody>
                {/* Preview currently selected files using native list */}
                <FileList files={files} onFileRemove={onFileRemove} />
                <PromptInputTextarea
                  placeholder="Ask Yurie"
                  className="min-h-[60px] px-3 py-3 text-base leading-[1.3] sm:text-base md:text-base text-foreground/80 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                />
              </PromptInputBody>
              <PromptInputToolbar className="px-2 pb-2 pt-1">
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
                    className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)]/90 backdrop-blur-sm p-0 text-foreground/80 transition-colors hover:text-foreground cursor-pointer disabled:cursor-not-allowed"
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
                      `inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors backdrop-blur-sm ` +
                      (useWebSearch
                        ? 'border-2 border-accent bg-[var(--surface)]/90 text-accent'
                        : 'border-[var(--border-color)] bg-[var(--surface)]/90 text-foreground/80 hover:text-foreground') +
                      ' cursor-pointer disabled:cursor-not-allowed'
                    }
                    disabled={isSubmitting}
                  >
                    <Globe className="size-5" />
                    <span className="text-xs font-medium">Search</span>
                  </button>
                  <div
                    className="relative inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--surface)]/90 backdrop-blur-sm"
                    style={modelSelectorWidth ? { width: `${modelSelectorWidth}px` } : undefined}
                  >
                    <label htmlFor="model-select" className="sr-only">Model</label>
                    <select
                      id="model-select"
                      value={modelChoice}
                      onChange={(e) => onModelChange(e.target.value)}
                      disabled={isSubmitting}
                      aria-label="Model selector"
                      className={`h-9 inline-block w-full appearance-none bg-transparent pl-3 pr-7 text-xs font-medium text-foreground/80 hover:text-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed`}
                    >
                      {modelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 size-4 text-foreground/60" />
                    {/* Hidden content sizer to measure text width */}
                    <span
                      ref={modelSizerRef}
                      aria-hidden="true"
                      className="absolute left-0 top-0 invisible whitespace-nowrap text-xs font-medium"
                    >
                      {(modelOptions.find((o) => o.value === modelChoice)?.label) || modelChoice}
                    </span>
                  </div>
                </PromptInputTools>
                <div className="flex items-center gap-1">
                  {status === 'streaming' ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)]/90 backdrop-blur-sm text-foreground/80 hover:text-foreground cursor-pointer"
                      aria-label="Stop"
                      title="Stop"
                    >
                      <Square className="size-4" />
                    </button>
                  ) : status === 'submitted' ? (
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)]/90 backdrop-blur-sm text-foreground/80 opacity-80"
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
                      className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)]/90 backdrop-blur-sm text-foreground/80 hover:text-foreground cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Send"
                      title="Send"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                  )}
                </div>
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  )
}
