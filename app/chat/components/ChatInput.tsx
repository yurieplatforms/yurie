'use client'

import { useCallback, useRef, useEffect } from 'react'
import { Globe, ArrowUp, Square, Plus, Telescope } from 'lucide-react'
import { Loader } from '@/components/ai-elements/loader'
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_AUDIO_BYTES } from '../utils'
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
  modelChoice,
  onModelChange,
}: ChatInputProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const prevNonResearchModelRef = useRef<string | null>(null)
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
    // Ensure Web mode uses Grok-4 Fast Reasoning
    try {
      const desired = 'x-ai/grok-4-fast-reasoning'
      if (String(modelChoice || '').toLowerCase() !== desired) {
        onModelChange(desired)
      }
    } catch {}
    onUseWebSearchToggle()
  }, [onUseWebSearchToggle, onModelChange, modelChoice])
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
        // Turn OFF research: always return to Grok-4 Fast Reasoning
        onModelChange('x-ai/grok-4-fast-reasoning')
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
                  placeholder="What can I help you with?"
                  className="min-h-[56px] pl-3 pr-10 pt-3 pb-3 text-base leading-[1.3] sm:text-base md:text-base text-foreground/80 placeholder:italic placeholder:!text-[#9e9b96] dark:placeholder:!text-[#9e9b96]"
                />
              </PromptInputBody>
              <PromptInputToolbar className="px-3 pb-3 pt-0">
                <PromptInputTools className="ml-0 gap-1.5">
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
                      className="inline-flex size-8 items-center justify-center rounded-full border border-transparent bg-transparent text-[#a7a4a0] transition-all hover:bg-[var(--color-pill-hover)] hover:text-[#6b6865] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] active:scale-[0.92] dark:text-[#a7a4a0] dark:hover:text-[#c9c6c0] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSubmitting || !allowAttachments}
                    >
                      <Plus className="size-4 flex-shrink-0" strokeWidth={2.5} />
                    </button>
                  ) : null}
                  {/* Model selector moved to navbar */}
                  {(useWebSearch && !isResearchMode) ? null : (
                    <button
                      type="button"
                      onClick={toggleResearch}
                      aria-pressed={isResearchMode}
                      aria-label="Research"
                      title="Deep Research"
                      className={
                        `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all duration-200 backdrop-blur-sm ` +
                        (isResearchMode
                          ? 'border-accent/60 bg-[var(--color-pill-active)] text-[var(--color-accent)] shadow-sm hover:border-accent hover:shadow-md'
                          : 'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] hover:text-[#6b6865] hover:border-neutral-200 dark:hover:border-neutral-700 active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] active:scale-[0.96] text-[#a7a4a0] dark:text-[#a7a4a0] dark:hover:text-[#c9c6c0]') +
                        ' cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
                      }
                      disabled={isSubmitting}
                    >
                      <Telescope className="size-4 flex-shrink-0" strokeWidth={2} />
                      <span className="text-[13px] leading-none">Research</span>
                    </button>
                  )}
                  {allowWebSearch && !isResearchMode ? (
                    <button
                      type="button"
                      onClick={handleToggleWebSearch}
                      aria-pressed={useWebSearch}
                      aria-label="Web search"
                      title="Web search"
                      className={
                        `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all duration-200 backdrop-blur-sm ` +
                        (useWebSearch
                          ? 'border-accent/60 bg-[var(--color-pill-active)] text-[var(--color-accent)] shadow-sm hover:border-accent hover:shadow-md'
                          : 'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] hover:text-[#6b6865] hover:border-neutral-200 dark:hover:border-neutral-700 active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] active:scale-[0.96] text-[#a7a4a0] dark:text-[#a7a4a0] dark:hover:text-[#c9c6c0]') +
                        ' cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
                      }
                      disabled={isSubmitting}
                    >
                      <Globe className="size-4 flex-shrink-0" strokeWidth={2} />
                      <span className="text-[13px] leading-none">Web</span>
                    </button>
                  ) : null}
                </PromptInputTools>
              </PromptInputToolbar>
              {/* Floating submit button anchored to bottom-right */}
              <div className="pointer-events-none absolute bottom-3 right-3 z-20">
                {status === 'streaming' ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 active:scale-[0.92] backdrop-blur-sm text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg"
                    aria-label="Stop"
                    title="Stop"
                  >
                    <Square className="size-4 flex-shrink-0" strokeWidth={2.5} />
                  </button>
                ) : status === 'submitted' ? (
                  <button
                    type="button"
                    className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 backdrop-blur-sm text-[#a7a4a0] dark:text-[#a7a4a0] transition-all duration-200 shadow-md"
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
                    className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-transparent bg-[var(--color-accent)] hover:bg-[#6d7fc9] active:bg-[#5d6fb5] active:scale-[0.94] backdrop-blur-sm text-white cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send"
                    title="Send"
                  >
                    <ArrowUp className="size-5 flex-shrink-0" strokeWidth={2.5} />
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
