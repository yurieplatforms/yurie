'use client'

import { useCallback, useLayoutEffect, useRef, useState, useId } from 'react'
import { Globe, ArrowUp, Square, Paperclip, AtSign } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

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
  selectedContextIds,
  onContextChange,
}: ChatInputProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const modelSizerRef = useRef<HTMLSpanElement>(null)
  const [modelSelectorWidth, setModelSelectorWidth] = useState<number | null>(null)
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
      if (m === 'openrouter/perplexity/sonar-deep-research') return false
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
      const m = String(modelChoice || '').toLowerCase()
      if (m === 'openrouter/perplexity/sonar-deep-research') return false
      return true
    } catch {
      return true
    }
  })()

  useLayoutEffect(() => {
    const computeWidth = () => {
      try {
        const sizer = modelSizerRef.current
        if (!sizer) return
        const contentWidth = Math.ceil(sizer.offsetWidth)
        // left padding 8px (pl-2) + right padding for chevron 24px (pr-6) + borders 2px
        const total = contentWidth + 8 + 24 + 2
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
    const hasContext = Array.isArray(selectedContextIds) && selectedContextIds.length > 0

    if (!(hasText || hasAttachments || hasContext)) {
      return
    }

    if (onSubmitWithMessage) {
      onSubmitWithMessage(message.text || '', files || [])
    } else if (onSend) {
      onSend()
    }
  }, [onSend, onSubmitWithMessage, files, selectedContextIds])

  const handleStop = useCallback(() => {
    if (status === 'streaming' || status === 'submitted') {
      stop()
    }
  }, [status, stop])

  const [contextResults, setContextResults] = useState<Array<{ id: string; label: string }>>([])
  const [contextQuery, setContextQuery] = useState('')
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [contextLabels, setContextLabels] = useState<Record<string, string>>({})
  const contextMenuId = useId()

  const fetchContext = useCallback(async (q: string) => {
    try {
      const res = await fetch('/api/posts')
      if (!res.ok) return
      const json = await res.json()
      const posts: Array<{ type: 'blog' | 'research'; slug: string; title: string }>= Array.isArray(json?.posts) ? json.posts : []
      const items = posts.map((p) => ({ id: `${p.type}:${p.slug}`, label: `${p.title} — ${p.type}` }))
      const filtered = q.trim()
        ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
        : items
      setContextResults(filtered.slice(0, 12))
    } catch {}
  }, [])

  const addContextId = useCallback((id: string) => {
    if (!onContextChange) return
    const curr = Array.isArray(selectedContextIds) ? selectedContextIds : []
    if (curr.includes(id)) return
    
    // Find the label for this ID and store it
    const result = contextResults.find(r => r.id === id)
    if (result) {
      setContextLabels(prev => ({ ...prev, [id]: result.label }))
    }
    
    onContextChange([...curr, id])
  }, [onContextChange, selectedContextIds, contextResults])

  const removeContextId = useCallback((id: string) => {
    if (!onContextChange) return
    const curr = Array.isArray(selectedContextIds) ? selectedContextIds : []
    onContextChange(curr.filter((x) => x !== id))
    
    // Remove the label from storage
    setContextLabels(prev => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
  }, [onContextChange, selectedContextIds])

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
                {/* Context section - collapsed when items selected */}
                {Array.isArray(selectedContextIds) && selectedContextIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 px-3 pt-2 pb-2">
                    <DropdownMenu open={isContextOpen} onOpenChange={(o) => {
                      setIsContextOpen(o)
                      if (o) fetchContext('')
                    }}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Add more context"
                          title="Add more context"
                          aria-haspopup="menu"
                          aria-expanded={isContextOpen}
                          aria-controls={contextMenuId}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-chat-input-border)] bg-transparent hover:bg-[var(--color-pill-hover)] text-[#807d78] cursor-pointer disabled:cursor-not-allowed transition-colors -ml-1.5"
                          disabled={isSubmitting}
                        >
                          <AtSign className="size-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        id={contextMenuId}
                        inPortal 
                        sideOffset={12} 
                        side="bottom"
                        align="start"
                        className="min-w-[20rem] max-w-[24rem] z-[100] bg-[var(--color-chat-input)] border-[var(--color-chat-input-border)] shadow-lg backdrop-blur-md"
                      >
                        <div className="px-3 py-2">
                          <input
                            value={contextQuery}
                            onChange={(e) => {
                              const v = e.target.value
                              setContextQuery(v)
                              fetchContext(v)
                            }}
                            placeholder="Search blog or research…"
                            aria-label="Search context"
                            className="w-full rounded-lg border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[#807d78] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 focus:border-[var(--color-chat-input-border)] transition-colors"
                          />
                        </div>
                        <DropdownMenuSeparator className="bg-[var(--color-chat-input-border)] mx-2" />
                        <div className="max-h-[min(60vh,20rem)] overflow-y-auto">
                          {contextResults.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-[#807d78] text-center" role="status" aria-live="polite">No results found</div>
                          ) : (
                            contextResults.map((r) => (
                              <DropdownMenuItem 
                                key={r.id} 
                                onSelect={(e) => {
                                  e.preventDefault()
                                  addContextId(r.id)
                                  setIsContextOpen(false)
                                  setContextQuery('')
                                }}
                                className="mx-2 my-1 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--color-pill-hover)] focus:bg-[var(--color-pill-hover)] cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate">{r.label}</span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Selected context items inline */}
                    {selectedContextIds.map((id) => {
                      const displayName = contextLabels[id] || id.split(':').pop() || id
                      return (
                        <span key={id} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-chat-input-border)] bg-transparent px-2 text-[15px] text-[#807d78]">
                          <span className="truncate max-w-[260px] leading-none">{displayName}</span>
                          {onContextChange ? (
                            <button
                              type="button"
                              className="ml-1 inline-flex size-5 items-center justify-center rounded-full text-[#807d78] hover:bg-[var(--color-pill-hover)] cursor-pointer flex-shrink-0"
                              aria-label={`Remove ${displayName}`}
                              onClick={() => removeContextId(id)}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center px-3 pt-2 pb-0">
                    <DropdownMenu open={isContextOpen} onOpenChange={(o) => {
                      setIsContextOpen(o)
                      if (o) fetchContext('')
                    }}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Add context"
                          title="Add context"
                          aria-haspopup="menu"
                          aria-expanded={isContextOpen}
                          aria-controls={contextMenuId}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border px-2 text-xs transition-colors backdrop-blur-sm border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer disabled:cursor-not-allowed -ml-1.5"
                          disabled={isSubmitting}
                        >
                            <AtSign className="size-4" />
                            <span className="text-sm font-medium">Add context</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        id={contextMenuId}
                        inPortal 
                        sideOffset={12} 
                        side="bottom"
                        align="start"
                        className="min-w-[20rem] max-w-[24rem] z-[100] bg-[var(--color-chat-input)] border-[var(--color-chat-input-border)] shadow-lg backdrop-blur-md"
                      >
                        <div className="px-3 py-2">
                          <input
                            value={contextQuery}
                            onChange={(e) => {
                              const v = e.target.value
                              setContextQuery(v)
                              fetchContext(v)
                            }}
                            placeholder="Search blog or research…"
                            aria-label="Search context"
                            className="w-full rounded-lg border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[#807d78] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none active:ring-0 focus:border-[var(--color-chat-input-border)] transition-colors"
                          />
                        </div>
                        <DropdownMenuSeparator className="bg-[var(--color-chat-input-border)] mx-2" />
                        <div className="max-h-[min(60vh,20rem)] overflow-y-auto">
                          {contextResults.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-[#807d78] text-center" role="status" aria-live="polite">No results found</div>
                          ) : (
                            contextResults.map((r) => (
                              <DropdownMenuItem 
                                key={r.id} 
                                onSelect={(e) => {
                                  e.preventDefault()
                                  addContextId(r.id)
                                  setIsContextOpen(false)
                                  setContextQuery('')
                                }}
                                className="mx-2 my-1 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--color-pill-hover)] focus:bg-[var(--color-pill-hover)] cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate">{r.label}</span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                <PromptInputTextarea
                  placeholder="Ask, search, or make anything..."
                  className="min-h-[52px] px-3 pr-14 py-2 text-base leading-[1.3] sm:text-base md:text-base text-foreground/80 placeholder:!text-[#807d78] dark:placeholder:!text-[#807d78]"
                />
              </PromptInputBody>
              <PromptInputToolbar className="px-3 pb-2 pt-0">
                <PromptInputTools className="-ml-1.5 gap-1">
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
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    aria-label="Add attachments"
                    title="Add attachments"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border px-2 text-xs transition-colors backdrop-blur-sm border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer disabled:cursor-not-allowed"
                    disabled={isSubmitting || !allowAttachments}
                  >
                    <Paperclip className="size-4" />
                    <span className="text-sm font-medium">Attach</span>
                  </button>
                  {allowWebSearch ? (
                    <button
                      type="button"
                      onClick={onUseWebSearchToggle}
                      aria-pressed={useWebSearch}
                      aria-label="Web search"
                      title="Web search"
                      className={
                        `inline-flex h-8 items-center gap-1.5 rounded-full border px-2 text-xs transition-colors backdrop-blur-sm ` +
                        (useWebSearch
                          ? 'border border-accent bg-[var(--color-pill-active)]'
                          : 'border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)]') +
                        ' text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer disabled:cursor-not-allowed'
                      }
                      disabled={isSubmitting}
                    >
                      <Globe className="size-4" />
                      <span className="text-sm font-medium">Search</span>
                    </button>
                  ) : null}
                  <div
                    className="relative inline-flex h-8 items-center rounded-full border border-transparent bg-transparent hover:bg-[var(--color-pill-hover)] backdrop-blur-sm"
                    style={modelSelectorWidth ? { width: `${modelSelectorWidth}px` } : undefined}
                  >
                    <label htmlFor="model-select" className="sr-only">Model</label>
                    <select
                      id="model-select"
                      value={modelChoice}
                      onChange={(e) => onModelChange(e.target.value)}
                      disabled={isSubmitting}
                      aria-label="Model selector"
                      className={`h-8 inline-block w-full appearance-none bg-transparent pl-2 pr-6 text-sm font-medium text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed`}
                    >
                      {modelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2 size-4 text-[#807d78] dark:text-[#807d78]" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                    {/* Hidden content sizer to measure text width */}
                    <span
                      ref={modelSizerRef}
                      aria-hidden="true"
                      className="absolute left-0 top-0 invisible whitespace-nowrap text-sm font-medium"
                    >
                      {(modelOptions.find((o) => o.value === modelChoice)?.label) || modelChoice}
                    </span>
                  </div>
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
