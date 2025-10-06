'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Globe, ArrowUp, Square, Paperclip, Microscope, X } from 'lucide-react'
import { Loader } from '@/components/ai-elements/loader'
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_AUDIO_BYTES } from '../utils'
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
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const prevNonResearchModelRef = useRef<string | null>(null)
  const [isResearchHovered, setIsResearchHovered] = useState(false)
  const [isWebHovered, setIsWebHovered] = useState(false)
  const isResearchMode = (() => {
    try {
      // Research mode now maps to xAI Grok 4 with Live Search
      return String(modelChoice || '').toLowerCase() === 'x-ai/grok-4-0709'
    } catch {
      return false
    }
  })()
  const allowAudio = (() => {
    try {
      return /^openrouter\/google\/gemini-2\.5-pro$/i.test(modelChoice)
    } catch {
      return false
    }
  })()
  const allowImages = (() => {
    try {
      const m = String(modelChoice || '').toLowerCase()
      if (m === 'openrouter/qwen/qwen3-max') return false
      if (m === 'openrouter/qwen/qwen-plus-2025-07-28:thinking') return false
      if (m === 'openrouter/openai/gpt-5') return false
      if (m === 'openrouter/openai/gpt-oss-120b') return false
      return true
    } catch {
      return true
    }
  })()
  const allowFiles = (() => {
    try {
      const m = String(modelChoice || '').toLowerCase()
      if (m === 'x-ai/grok-4-0709') return false
      if (m === 'x-ai/grok-4-fast-reasoning') return false
      return true
    } catch {
      return true
    }
  })()
  const allowAttachments = allowFiles || allowImages

  const attachmentAccept = (() => {
    const parts: string[] = []
    try {
      if (allowImages) {
        parts.push('image/jpeg,image/png,image/webp,image/gif')
      }
      if (allowFiles) {
        parts.push('application/pdf')
        if (allowAudio) {
          parts.push('audio/wav,audio/x-wav,audio/mpeg,audio/mp3')
        }
      }
    } catch {}
    return parts.join(',')
  })()
  const allowWebSearch = (() => {
    try {
      // Web search is supported for xAI Grok 4 and most others
      return true
    } catch {
      return true
    }
  })()
  const handleToggleWebSearch = useCallback(() => {
    // Independent web toggle; no Sonar special casing anymore
    onUseWebSearchToggle()
  }, [onUseWebSearchToggle])
  const toggleResearch = useCallback(() => {
    try {
      const grok4 = 'x-ai/grok-4-0709'
      const current = String(modelChoice || '')
      const isOn = String(current).toLowerCase() === grok4
      if (!isOn) {
        // Turn ON research: remember current model and switch to Grok 4 (+ enable web)
        prevNonResearchModelRef.current = current
        onModelChange(grok4)
      } else {
        // Turn OFF research: restore previous model (or default to first option)
        const prev = prevNonResearchModelRef.current
        if (prev && prev.trim()) {
          onModelChange(prev)
        } else {
          const fallback = (Array.isArray(modelOptions) && modelOptions.length > 0)
            ? modelOptions[0].value
            : 'x-ai/grok-4-fast-reasoning'
          onModelChange(fallback)
        }
      }
    } catch {}
  }, [modelChoice, onModelChange, onUseWebSearchToggle, useWebSearch])

  // Model selector moved to navbar

  // Listen for global event to open the attachments dialog
  useEffect(() => {
    const handler = () => {
      try {
        attachmentInputRef.current?.click()
      } catch {}
    }
    try {
      window.addEventListener('yurie:attachments:open', handler as EventListener)
    } catch {}
    return () => {
      try {
        window.removeEventListener('yurie:attachments:open', handler as EventListener)
      } catch {}
    }
  }, [])

  // Model selector moved to navbar; width sizer no longer needed

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
      <div className="relative order-2 pb-2 sm:pb-3 md:order-1">
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
                  placeholder="Ask, or search anything..."
                  className="min-h-[64px] pl-3 pr-6 pt-3 pb-3 text-base leading-[1.3] sm:text-base md:text-base text-foreground/80 placeholder:!text-[#807d78] dark:placeholder:!text-[#807d78]"
                />
              </PromptInputBody>
              <PromptInputToolbar className="px-3 pb-2.5 pt-0.5">
                <PromptInputTools className="-ml-0.5 gap-1.5">
                  {/* Unified attachments input (images, PDFs, and optional audio) */}
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept={attachmentAccept}
                    multiple
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? [])
                      const filtered = selected.filter((f) => {
                        const mime = (f.type || '').toLowerCase()
                        const isPdf = mime === 'application/pdf'
                        const isWav = (allowFiles && allowAudio) && (mime === 'audio/wav' || mime === 'audio/x-wav')
                        const isMp3 = (allowFiles && allowAudio) && (mime === 'audio/mpeg' || mime === 'audio/mp3')
                        const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg'
                        const isPng = mime === 'image/png'
                        const isWebp = mime === 'image/webp'
                        const isGif = mime === 'image/gif'
                        if (allowFiles && isPdf) return f.size <= MAX_PDF_BYTES
                        if (allowFiles && (isWav || isMp3)) return f.size <= MAX_AUDIO_BYTES
                        if (allowImages && (isJpeg || isPng || isWebp || isGif)) return f.size <= MAX_IMAGE_BYTES
                        return false
                      })
                      if (filtered.length > 0) onFileUpload(filtered)
                      if (e.target) e.target.value = ''
                    }}
                    className="sr-only"
                    aria-label="Add attachments"
                    disabled={!allowAttachments}
                  />
                  {!isResearchMode ? (
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      aria-label="Add attachments"
                      title="Add attachments"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-transparent text-[#807d78] transition-colors hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer disabled:cursor-not-allowed"
                      disabled={isSubmitting || !allowAttachments}
                    >
                      <Paperclip className="size-4" />
                    </button>
                  ) : null}
                  {/* Model selector moved to navbar */}
                  {(useWebSearch && !isResearchMode) ? null : (
                    <button
                      type="button"
                      onClick={toggleResearch}
                      onMouseEnter={() => setIsResearchHovered(true)}
                      onMouseLeave={() => setIsResearchHovered(false)}
                      aria-pressed={isResearchMode}
                      aria-label="Research"
                      title="Deep Research"
                      className={
                        `inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors backdrop-blur-sm ` +
                        (isResearchMode
                          ? 'border border-accent bg-[var(--color-pill-active)] text-[var(--color-accent)]'
                          : 'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78]') +
                        ' cursor-pointer disabled:cursor-not-allowed'
                      }
                      disabled={isSubmitting}
                    >
                      {isResearchMode && isResearchHovered ? (
                        <X className="size-4" />
                      ) : (
                        <Microscope className="size-4" />
                      )}
                      <span className="text-sm font-medium">Research</span>
                    </button>
                  )}
                  {allowWebSearch && !isResearchMode ? (
                    <button
                      type="button"
                      onClick={handleToggleWebSearch}
                      onMouseEnter={() => setIsWebHovered(true)}
                      onMouseLeave={() => setIsWebHovered(false)}
                      aria-pressed={useWebSearch}
                      aria-label="Web search"
                      title="Web search"
                      className={
                        `inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors backdrop-blur-sm ` +
                        (useWebSearch
                          ? 'border border-accent bg-[var(--color-pill-active)] text-[var(--color-accent)]'
                          : 'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78]') +
                        ' cursor-pointer disabled:cursor-not-allowed'
                      }
                      disabled={isSubmitting}
                    >
                      {useWebSearch && isWebHovered ? (
                        <X className="size-4" />
                      ) : (
                        <Globe className="size-4" />
                      )}
                      <span className="text-sm font-medium">Web</span>
                    </button>
                  ) : null}
                </PromptInputTools>
              </PromptInputToolbar>
              {/* Floating submit button anchored to bottom-right */}
              <div className="pointer-events-none absolute bottom-1 right-1 z-20">
                {status === 'streaming' ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] backdrop-blur-sm text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer"
                    aria-label="Stop"
                    title="Stop"
                  >
                    <Square className="size-4" />
                  </button>
                ) : status === 'submitted' ? (
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] backdrop-blur-sm text-[#807d78] dark:text-[#807d78] opacity-80"
                    aria-label="Sending"
                    title="Sending"
                    disabled
                  >
                    <Loader size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] backdrop-blur-sm text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Send"
                    title="Send"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  )
}
