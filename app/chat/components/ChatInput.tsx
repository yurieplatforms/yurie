'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { ArrowUp, Square, Telescope, Paperclip } from 'lucide-react'
import { Loader } from '@/components/ai-elements/loader'
import { Button } from '@/components/ui/button'
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_AUDIO_BYTES } from '../utils'
import { ChatInputProps } from '../types'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/prompt-kit/prompt-input'
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
  modelChoice,
  onModelChange,
}: ChatInputProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const prevNonResearchModelRef = useRef<string | null>(null)
  const [input, setInput] = useState('')
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
  }, [modelChoice, onModelChange])

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

  const handleSubmit = useCallback(async () => {
    const hasText = Boolean(input.trim())
    const hasAttachments = Boolean(files?.length)

    if (!(hasText || hasAttachments)) {
      return
    }

    if (onSubmitWithMessage) {
      onSubmitWithMessage(input, files || [])
      setInput('')
    } else if (onSend) {
      onSend()
    }
  }, [onSend, onSubmitWithMessage, files, input])

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
              value={input}
              onValueChange={setInput}
              isLoading={status === 'streaming' || status === 'submitted'}
              onSubmit={handleSubmit}
              className="relative z-10 w-full shadow-none"
            >
              {files.length > 0 ? (
                <FileList files={files} onFileRemove={onFileRemove} />
              ) : null}
              <PromptInputTextarea
                placeholder="What can I help you with?"
                className="min-h-[56px] pl-3 pr-3 pt-3 pb-3 text-base leading-[1.3] sm:text-base md:text-base text-foreground/80 placeholder:!text-[#9e9b96] dark:placeholder:!text-[#656765]"
              />
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
                id="chat-file-upload"
              />
              <PromptInputActions className="flex items-center justify-between gap-3 px-3 pt-0 pb-3">
                <div className="flex items-center gap-2">
                  <PromptInputAction tooltip="Attach files">
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      aria-label="Add attachments"
                      className={
                        `inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-all duration-200 backdrop-blur-sm ` +
                        'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] hover:text-[#6b6865] hover:border-neutral-200 dark:hover:border-neutral-700 active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] active:scale-[0.96] text-[#a7a4a0] dark:text-[#656765] dark:hover:text-[#c9c6c0] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
                      }
                      disabled={isSubmitting || !allowAttachments}
                    >
                      <Paperclip className="size-5 flex-shrink-0" />
                      <span className="text-[13px] leading-none">Attach</span>
                    </button>
                  </PromptInputAction>
                  <PromptInputAction tooltip="Deep Research">
                    <button
                      type="button"
                      onClick={toggleResearch}
                      aria-pressed={isResearchMode}
                      aria-label="Research"
                      className={
                        `inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-all duration-200 backdrop-blur-sm ` +
                        (isResearchMode
                          ? 'border-accent/60 bg-[var(--color-pill-active)] text-[var(--color-accent)] shadow-sm hover:border-accent hover:shadow-md'
                          : 'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] hover:text-[#6b6865] hover:border-neutral-200 dark:hover:border-neutral-700 active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] active:scale-[0.96] text-[#a7a4a0] dark:text-[#656765] dark:hover:text-[#c9c6c0]') +
                        ' cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
                      }
                      disabled={isSubmitting}
                    >
                      <Telescope className="size-5 flex-shrink-0" strokeWidth={2} />
                      <span className="text-[13px] leading-none">Research</span>
                    </button>
                  </PromptInputAction>
                </div>
                <div className="flex items-center">
                  {status === 'streaming' ? (
                    <PromptInputAction tooltip="Stop">
                      <Button
                        variant="default"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={handleStop}
                        aria-label="Stop"
                      >
                        <Square className="size-5" />
                      </Button>
                    </PromptInputAction>
                  ) : status === 'submitted' ? (
                    <PromptInputAction tooltip="Sending">
                      <Button
                        variant="default"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        aria-label="Sending"
                        disabled
                      >
                        <Loader size={16} />
                      </Button>
                    </PromptInputAction>
                  ) : (
                    <PromptInputAction tooltip="Send message">
                      <Button
                        variant="default"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={handleSubmit}
                        aria-label="Send"
                        disabled={isSubmitting}
                      >
                        <ArrowUp className="size-5" />
                      </Button>
                    </PromptInputAction>
                  )}
                </div>
              </PromptInputActions>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  )
}
