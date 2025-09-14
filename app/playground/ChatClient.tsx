"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useId, createContext, useContext } from 'react'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'
import { ArrowUp, Stop, Paperclip, X, CaretDown, Globe } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import Orb from './Orb'
import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AttachmentPreview = {
  id: string
  name: string
  size: number
  mime: string
  objectUrl: string
  isImage: boolean
  isAudio?: boolean
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const PromptInputContext = createContext<any>(null)
function usePromptInput() {
  return useContext(PromptInputContext)
}

function PromptInput({ className, isLoading = false, maxHeight = 240, value, onValueChange, onSubmit, children }: any) {
  const [internalValue, setInternalValue] = useState(value || '')
  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }
  return (
    <PromptInputContext.Provider
      value={{ isLoading, value: value ?? internalValue, setValue: onValueChange ?? handleChange, maxHeight, onSubmit }}
    >
      <div className={cn('glass-input-wrap', isLoading && 'ai-border-glow', className)}>
        <div className="glass-input-inner">
          {children}
        </div>
      </div>
    </PromptInputContext.Provider>
  )
}

function PromptInputTextarea({ className, onKeyDown, disableAutosize = false, ...props }: any) {
  const { value, setValue, maxHeight, onSubmit, isLoading } = usePromptInput()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (disableAutosize || !textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
  }, [value, disableAutosize])
  useEffect(() => {
    if (isLoading) {
      try { textareaRef.current?.blur() } catch {}
    }
  }, [isLoading])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e)
  }
  const maxHeightStyle = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
  return (
    <textarea
      ref={textareaRef}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'text-neutral-900 dark:text-neutral-100 min-h-[60px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
        'overflow-y-auto',
        className
      )}
      style={{ maxHeight: maxHeightStyle, caretColor: isLoading ? 'transparent' as any : undefined }}
      readOnly={Boolean(isLoading)}
      rows={1}
      
      {...props}
    />
  )
}

function MessageAttachmentList({ attachments, compact = false }: { attachments: AttachmentPreview[]; compact?: boolean }) {
  if (!attachments || attachments.length === 0) return null
  return (
    <div className={cn(compact ? 'm-0' : 'mt-2 mb-3', 'flex flex-row flex-wrap gap-2')}>
      {attachments.map((att) => (
        att.isImage ? (
          <img
            key={att.id}
            src={att.objectUrl}
            alt={att.name}
            className="rounded border border-neutral-200 dark:border-neutral-800 max-h-56 object-cover"
          />
        ) : att.isAudio ? (
          <div key={att.id} className="bg-[var(--surface)] border border-[var(--border-color)] rounded-md p-2 inline-flex items-center gap-2 max-w-full">
            <audio controls src={att.objectUrl} className="max-w-[260px]" />
            <div className="flex flex-col">
              <span className="font-medium text-xs truncate max-w-[200px]">{att.name}</span>
              <span className="text-neutral-500 text-[10px]">{(att.size / 1024).toFixed(2)}kB</span>
            </div>
          </div>
        ) : (
          <a
            key={att.id}
            href={att.objectUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-color)] rounded-md px-3 py-2 text-xs inline-flex items-center gap-2"
          >
            <span className="font-medium">{att.name}</span>
            <span className="text-neutral-500 ml-2">{(att.size / 1024).toFixed(2)}kB</span>
          </a>
        )
      ))}
    </div>
  )
}

function FileItem({ file, onRemove }: { file: File; onRemove: (file: File) => void }) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isLikelyImage = useMemo(() => {
    const mime = (file.type || '').toLowerCase()
    if (mime.startsWith('image/')) return true
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const imageExts = ['png','jpg','jpeg','gif','webp','bmp','svg','heic','heif','tif','tiff','avif']
    return imageExts.includes(ext)
  }, [file])
  const hasTriedDataUrlRef = useRef(false)
  const loadDataUrlFallback = useCallback(() => {
    if (hasTriedDataUrlRef.current) return
    hasTriedDataUrlRef.current = true
    try {
      const reader = new FileReader()
      reader.onload = () => setPreviewUrl(String(reader.result))
      reader.readAsDataURL(file)
    } catch {}
  }, [file])
  useEffect(() => {
    if (!isLikelyImage) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isLikelyImage])
  const handleRemove = () => {
    setIsRemoving(true)
    onRemove(file)
  }
  return (
    <div className="relative mr-2 mb-0 flex items-center">
      <div className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border-color)] flex w-full items-center gap-3 rounded-2xl border p-2 pr-3 transition-colors">
        {isLikelyImage ? (
          <div className="bg-neutral-200 dark:bg-neutral-700 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
            {previewUrl ? (
              <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" loading="eager" decoding="async" onError={loadDataUrlFallback} />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-xs font-medium">{file.name}</span>
          <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)}kB</span>
        </div>
      </div>
      {!isRemoving ? (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-1 right-1 z-10 inline-flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[var(--border-color)] bg-[var(--surface)] text-black dark:text-white hover:bg-[var(--surface-hover)] shadow-none transition-colors"
          aria-label="Remove file"
        >
          <X className="size-3" weight="bold" />
        </button>
      ) : null}
    </div>
  )
}

function FileList({ files, onFileRemove }: { files: File[]; onFileRemove: (file: File) => void }) {
  const TRANSITION = { type: 'spring', duration: 0.2, bounce: 0 } as const
  return (
    <AnimatePresence initial={false}>
      {files.length > 0 && (
        <motion.div
          key="files-list"
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={TRANSITION}
          className="overflow-hidden"
        >
          <div className="flex flex-row overflow-x-auto pl-3">
            <AnimatePresence initial={false}>
              {files.map((file) => (
                <motion.div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  initial={{ width: 0 }}
                  animate={{ width: 180 }}
                  exit={{ width: 0 }}
                  transition={TRANSITION}
                  className="relative shrink-0 overflow-hidden pt-2"
                >
                  <FileItem key={`${file.name}-${file.size}-${file.lastModified}`} file={file} onRemove={onFileRemove} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ButtonFileUpload({ onFileUpload }: { onFileUpload: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*,application/pdf,audio/*"
        multiple
        className="sr-only"
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          onFileUpload(files)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      <label
        htmlFor={inputId}
        role="button"
        tabIndex={0}
        className="size-9 inline-flex items-center justify-center p-0 leading-none rounded-full border border-[var(--border-color)] bg-[var(--surface)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-[var(--border-color-hover)] transition-colors"
        aria-label="Add files"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <Paperclip className="size-4" weight="bold" aria-hidden="true" />
      </label>
    </>
  )
}

type ChatInputProps = {
  value: string
  onValueChange: (value: string) => void
  onSend: () => void
  isSubmitting?: boolean
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  stop: () => void
  status?: 'submitted' | 'streaming' | 'ready' | 'error'
  modelChoice: string
  onModelChange: (value: string) => void
  useTavily: boolean
  onUseTavilyToggle: () => void
}
function ChatInput({ value, onValueChange, onSend, isSubmitting, files, onFileUpload, onFileRemove, stop, status, modelChoice, onModelChange, useTavily, onUseTavilyToggle }: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const setDragging = useCallback((v: boolean) => {
    setIsDragging(v)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    try {
      const items = Array.from(e.dataTransfer?.items || [])
      const hasFiles = items.some((it) => it.kind === 'file') || (e.dataTransfer?.types || []).includes('Files')
      if (!hasFiles) return
      dragCounterRef.current += 1
      setDragging(true)
    } catch {}
  }, [setDragging])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    try {
      const items = Array.from(e.dataTransfer?.items || [])
      const hasFiles = items.some((it) => it.kind === 'file') || (e.dataTransfer?.types || []).includes('Files')
      if (!hasFiles) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    } catch {}
  }, [setDragging])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    try {
      const items = Array.from(e.dataTransfer?.items || [])
      const hasFiles = items.some((it) => it.kind === 'file') || (e.dataTransfer?.types || []).includes('Files')
      if (!hasFiles) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) setDragging(false)
    } catch {}
  }, [setDragging])

  const handleDrop = useCallback((e: React.DragEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      const fileList = Array.from(e.dataTransfer?.files || [])
      if (fileList.length > 0) onFileUpload(fileList)
    } finally {
      dragCounterRef.current = 0
      setDragging(false)
      try { e.dataTransfer?.clearData() } catch {}
    }
  }, [onFileUpload, setDragging])

  const handleSend = useCallback(() => {
    if (isSubmitting) return
    if (status === 'streaming' || status === 'submitted') {
      stop()
      return
    }
    onSend()
  }, [isSubmitting, onSend, status, stop])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isSubmitting) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter' && (status === 'streaming' || status === 'submitted')) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isOnlyWhitespace(value) && files.length === 0) return
      e.preventDefault()
      onSend()
    }
  }, [files.length, isSubmitting, onSend, status, value])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const hasImageContent = Array.from(items).some((item) => item.type.startsWith('image/'))
    if (hasImageContent) {
      const imageFiles: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const newFile = new File([file], `pasted-image-${Date.now()}.${file.type.split('/')[1]}`, { type: file.type })
            imageFiles.push(newFile)
          }
        }
      }
      if (imageFiles.length > 0) onFileUpload(imageFiles)
    }
  }, [onFileUpload])

  const modelOptions = useMemo(
    () => [
      { value: 'x-ai/grok-4', label: 'Grok 4' },
      { value: 'openai/gpt-5', label: 'GPT-5' },
      { value: 'z-ai/glm-4.5', label: 'GLM 4.5' },
      { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'anthropic/claude-opus-4.1', label: 'Claude Opus 4.1' },
      { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
    ],
    []
  )

  const selectedModelLabel = useMemo(() => {
    const found = modelOptions.find((o) => o.value === modelChoice)
    return found ? found.label : modelChoice
  }, [modelChoice, modelOptions])

  return (
    <div className="relative flex w-full flex-col gap-4">
      <div className="relative order-2 pb-3 sm:pb-4 md:order-1">
        <div
          className="relative"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="pointer-events-none absolute inset-0 z-20">
              <div className="absolute inset-1 rounded-2xl border-2 border-dashed border-[var(--color-accent)] bg-[var(--surface)]/70 flex items-center justify-center">
                <div className="text-sm font-medium text-[var(--color-accent)]">Drop files to attach</div>
              </div>
            </div>
          ) : null}
          <PromptInput className="relative z-10 w-full p-0 pt-0 shadow-xs" maxHeight={200} value={value} onValueChange={onValueChange} isLoading={status === 'streaming' || status === 'submitted'}>
            <FileList files={files} onFileRemove={onFileRemove} />
            {/* Top: Text area */}
            <div className="relative px-2 pt-2 pb-0">
              {(status === 'streaming' || status === 'submitted') && (value.trim().length === 0) && (
                <div className="pointer-events-none absolute left-3 top-3">
                  <div style={{ width: 44, height: 44, position: 'relative' }} aria-hidden>
                    <Orb rotateOnHover={false} forceHoverState={true} hue={25} hoverIntensity={2} />
                  </div>
                </div>
              )}
              <PromptInputTextarea
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={(status === 'streaming' || status === 'submitted') ? '' : 'Ask anything'}
                className="min-h-[60px] py-3 px-3 text-base leading-[1.3] sm:text-base md:text-base"
              />
            </div>
            {/* Bottom: Actions row */}
            <div className="mt-2 w-full flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-1.5 pl-1">
                <ButtonFileUpload onFileUpload={onFileUpload} />
                <button
                  type="button"
                  onClick={onUseTavilyToggle}
                  className={cn(
                    'size-9 inline-flex items-center justify-center p-0 leading-none rounded-full border border-[var(--border-color)] bg-[var(--surface)] transition-colors cursor-pointer',
                    useTavily
                      ? 'ring-1 ring-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--surface-hover)]'
                      : 'hover:bg-[var(--surface-hover)] hover:border-[var(--border-color-hover)]'
                  )}
                  aria-pressed={useTavily}
                  aria-label="Web search"
                  title="Web search"
                >
                  <Globe className="size-5" weight="bold" aria-hidden="true" />
                </button>
                <div className="relative inline-flex items-center">
                  <label className="sr-only" htmlFor="model-select">Model</label>
                  <div className="relative group">
                    <div
                      aria-hidden="true"
                      className={cn(
                        'inline-flex items-center h-9 rounded-full border border-[var(--border-color)] bg-[var(--surface)] px-3 transition-colors',
                        'group-hover:bg-[var(--surface-hover)] group-hover:border-[var(--border-color-hover)]'
                      )}
                    >
                      <span className="text-xs text-neutral-900 dark:text-neutral-100">{selectedModelLabel}</span>
                      <CaretDown className="ml-1.5 size-4 text-neutral-600 dark:text-neutral-300" weight="bold" aria-hidden="true" />
                    </div>
                    <select
                      id="model-select"
                      value={modelChoice}
                      onChange={(e) => onModelChange(e.target.value)}
                      className={cn(
                        'absolute inset-0 h-9 w-full opacity-0 cursor-pointer text-[11px]',
                        'focus:outline-none'
                      )}
                    >
                      {modelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="pr-1">
                <button
                  className="size-9 inline-flex items-center justify-center p-0 leading-none rounded-full transition-all duration-300 ease-out border border-[var(--border-color)] bg-[var(--surface)] text-black dark:text-white hover:bg-[var(--surface-hover)] hover:border-[var(--border-color-hover)] cursor-pointer"
                  disabled={
                    status !== 'streaming' &&
                    status !== 'submitted' &&
                    (isSubmitting || (isOnlyWhitespace(value) && files.length === 0))
                  }
                  type="button"
                  onClick={handleSend}
                  aria-label={status === 'streaming' || status === 'submitted' ? 'Stop' : 'Send message'}
                >
                  {status === 'streaming' || status === 'submitted' ? (
                    <Stop className="size-4" weight="bold" aria-hidden="true" />
                  ) : (
                    <ArrowUp className="size-4" weight="bold" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [outputHeight, setOutputHeight] = useState<number>(0)
  const [files, setFiles] = useState<File[]>([])
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [sentAttachmentsByMessageIndex, setSentAttachmentsByMessageIndex] = useState<Record<number, AttachmentPreview[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)
  const [modelChoice, setModelChoice] = useState<string>('openai/gpt-5')
  const [useTavily, setUseTavily] = useState<boolean>(false)
  const [timeOfDayWord, setTimeOfDayWord] = useState<'today' | 'tonight'>(() => {
    try {
      const hours = new Date().getHours()
      const isNight = hours < 6 || hours >= 18
      return isNight ? 'tonight' : 'today'
    } catch {
      return 'today'
    }
  })

  useEffect(() => {
    const compute = () => {
      try {
        const hours = new Date().getHours()
        const isNight = hours < 6 || hours >= 18
        setTimeOfDayWord(isNight ? 'tonight' : 'today')
      } catch {}
    }
    const id = window.setInterval(compute, 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      try {
        for (const url of createdObjectUrlsRef.current) URL.revokeObjectURL(url)
      } catch {}
    }
  }, [])

  const md = useMemo(() => {
    const instance = new Marked({ gfm: true, breaks: true })
    instance.use({
      renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
          const language = (lang || '').trim().split(/\s+/)[0]
          const html = highlight(text)
          const langClass = language ? `language-${language}` : ''
          const label = language || 'text'
          return `
<div class=\"chat-code\">
  <div class=\"chat-code-header\">
    <span class=\"chat-code-lang\">${label}</span>
    <button type=\"button\" class=\"chat-copy\">Copy</button>
  </div>
  <pre><code class=\"${langClass}\">${html}</code></pre>
</div>`
        },
        codespan({ text }: { text: string }) {
          const html = highlight(text)
          return `<code>${html}</code>`
        },
      },
    })
    return instance
  }, [])

  useEffect(() => {
    const root = outputRef.current
    if (!root) return
    const handle = (e: Event) => {
      const target = e.target as HTMLElement | null
      const btn = target?.closest('.chat-copy') as HTMLButtonElement | null
      if (!btn) return
      const wrapper = btn.closest('.chat-code') as HTMLElement | null
      const codeEl = wrapper?.querySelector('pre code') as HTMLElement | null
      const text = codeEl?.textContent || ''
      try {
        navigator.clipboard.writeText(text)
        const previous = btn.textContent
        btn.textContent = 'Copied'
        setTimeout(() => {
          btn.textContent = previous || 'Copy'
        }, 1200)
      } catch {}
    }
    root.addEventListener('click', handle)
    return () => root.removeEventListener('click', handle)
  }, [])

  useEffect(() => {
    const recompute = () => {
      try {
        const viewportHeight = (window.visualViewport?.height ?? window.innerHeight)
        const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0
        const inputEl = inputWrapperRef.current
        const inputBox = inputEl?.getBoundingClientRect()
        const inputHeight = inputBox?.height ?? 0
        const mt = inputEl ? parseFloat(getComputedStyle(inputEl).marginTop || '0') : 0
        const available = Math.max(0, viewportHeight - containerTop - inputHeight - mt)
        setOutputHeight(Math.floor(available))
      } catch {}
    }
    recompute()
    const ro = inputWrapperRef.current ? new ResizeObserver(recompute) : null
    if (ro && inputWrapperRef.current) ro.observe(inputWrapperRef.current)
    window.addEventListener('resize', recompute)
    window.visualViewport?.addEventListener('resize', recompute)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', recompute)
      window.visualViewport?.removeEventListener('resize', recompute)
    }
  }, [])

  // Maintain pinned-to-bottom state and toggle auto-hide scrollbar visibility
  useEffect(() => {
    const el = outputRef.current
    if (!el) return
    const updatePinned = () => {
      try {
        const threshold = 16
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        pinnedToBottomRef.current = distanceFromBottom <= threshold
      } catch {}
    }
    updatePinned()
    el.addEventListener('scroll', updatePinned, { passive: true })
    return () => {
      el.removeEventListener('scroll', updatePinned as any)
    }
  }, [])

  // If the output area resizes and user is pinned, keep them pinned
  useEffect(() => {
    if (pinnedToBottomRef.current) {
      queueMicrotask(() => {
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
      })
    }
  }, [outputHeight])

  // When a new message is appended and user is pinned, keep pinned
  useEffect(() => {
    if (pinnedToBottomRef.current) {
      queueMicrotask(() => {
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
      })
    }
  }, [messages.length])

  //

  function sanitizeHtml(html: string): string {
    if (!html) return html
    const blockedContentTags = ['script', 'style', 'title', 'iframe', 'object', 'embed', 'noscript']
    const contentTagPattern = new RegExp(`<\\s*(${blockedContentTags.join('|')})\\b[\\s\\S]*?<\\/\\s*\\1\\s*>`, 'gi')
    html = html.replace(contentTagPattern, '')
    const blockedVoidTags = ['link', 'meta', 'base', 'form', 'input', 'select', 'option', 'textarea', 'frame', 'frameset']
    const voidTagPattern = new RegExp(`<\\s*(${blockedVoidTags.join('|')})\\b[^>]*>`, 'gi')
    html = html.replace(voidTagPattern, '')
    html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    html = html.replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')

    return html
  }

  function renderMessageContent(role: 'user' | 'assistant', content: string) {
    const legacyBracketPattern = "\\[" + "data:image" + "\\/[a-zA-Z]+;base64,[^\\]]+" + "\\]"
    const pattern = new RegExp(
      `<image_partial:([^>]+)>|<image:([^>]+)>|<revised_prompt:([^>]+)>|<response_id:([^>]+)>|<summary_text:([^>]+)>|<incomplete:([^>]+)>|${legacyBracketPattern}`,
      'g'
    )
    const parts: Array<
      { type: 'text'; value: string } |
      { type: 'image'; src: string; partial?: boolean } |
      { type: 'meta'; key: 'revised_prompt' | 'response_id' | 'summary_text' | 'incomplete'; value: string }
    > = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
      }
      const full = match[0]
      const partialPayload = match[1]
      const finalPayload = match[2]
      const revisedPayload = match[3]
      const responseIdPayload = match[4]
      const summaryPayload = match[5]
      const incompletePayload = match[6]
      const src = partialPayload
        ? partialPayload
        : finalPayload
          ? finalPayload
          : full.startsWith('[')
            ? full.slice(1, -1)
            : ''
      if (src) {
        const isPartial = Boolean(partialPayload)
        parts.push({ type: 'image', src, partial: isPartial })
      }
      if (typeof revisedPayload === 'string' && revisedPayload) {
        parts.push({ type: 'meta', key: 'revised_prompt', value: revisedPayload })
      }
      if (typeof responseIdPayload === 'string' && responseIdPayload) {
        parts.push({ type: 'meta', key: 'response_id', value: responseIdPayload })
      }
      if (typeof summaryPayload === 'string' && summaryPayload) {
        parts.push({ type: 'meta', key: 'summary_text', value: summaryPayload })
      }
      if (typeof incompletePayload === 'string' && incompletePayload) {
        parts.push({ type: 'meta', key: 'incomplete', value: incompletePayload })
      }
      lastIndex = match.index + full.length
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.slice(lastIndex) })
    }

    const latestPartialIndex = (() => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        if ((p as any).type === 'image' && (p as any).partial) return i
      }
      return -1
    })()
    const hasFinalImage = parts.some((p) => (p as any).type === 'image' && !(p as any).partial)
    return (
      <>
        {parts.map((p, i) => {
          if (p.type === 'text') {
            const rawHtml = md.parse(p.value) as string
            return (
              <div
                key={i}
                className={cn(role === 'assistant' ? 'prose-message' : 'prose prose-neutral dark:prose-invert')}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }}
              />
            )
          }
          if (p.type === 'image') {
            const isPartial = p.partial === true
            const isLatestPartial = latestPartialIndex === i
            if (isPartial && (!isLatestPartial || hasFinalImage)) {
              return null
            }
            return (
              <img
                key={i}
                src={p.src}
                alt="Generated image"
                className={cn(
                  'mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full',
                  role === 'assistant' ? 'mb-1' : 'mb-3'
                )}
              />
            )
          }
          return null
        })}
        {parts.map((p, i) => {
          if ((p as any).type === 'meta') {
            const meta = p as any
            const label =
              meta.key === 'revised_prompt'
                ? 'Revised prompt'
                : meta.key === 'response_id'
                  ? 'Response ID'
                  : meta.key === 'summary_text'
                    ? 'Summary'
                    : 'Status'
            return (
              <div key={`meta-${i}`} className="text-xs text-neutral-500 mt-1">
                <span className="font-medium">{label}:</span> {meta.value}
              </div>
            )
          }
          return null
        })}
      </>
    )
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (isLoading) return
    if (trimmed.length === 0 && files.length === 0) return
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages: ChatMessage[] = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)
    setStatus('submitted')

    try {
      // Capture current files as message attachments for preview in the chat container
      const attachmentsForPreview: AttachmentPreview[] = files.map((f) => {
        const url = URL.createObjectURL(f)
        createdObjectUrlsRef.current.push(url)
        const mime = (f.type || '').toLowerCase()
        const ext = (f.name.split('.').pop() || '').toLowerCase()
        const imageExts = ['png','jpg','jpeg','gif','webp','bmp','svg','heic','heif','tif','tiff','avif']
        const isImage = mime.startsWith('image/') || imageExts.includes(ext)
        const isAudio = mime.startsWith('audio/')
        return {
          id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
          name: f.name,
          size: f.size,
          mime: f.type,
          objectUrl: url,
          isImage,
          isAudio,
        }
      })
      if (attachmentsForPreview.length > 0) {
        const indexForThisMessage = nextMessages.length - 1
        setSentAttachmentsByMessageIndex((prev) => ({ ...prev, [indexForThisMessage]: attachmentsForPreview }))
      }
      // Collect user-attached images (as data URLs)
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      const inputImagesFromFiles: string[] = await Promise.all(
        imageFiles.map(
          (f) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(f)
            })
        )
      )
      // If user intends to edit and has not attached a new image, include the last assistant image(s)
      const editIntent = /\b(edit|add|replace|remove|overlay|combine|composite|blend|merge|variation|variations|logo|stamp|put|insert|inpaint|mask|fill|make it|make this|turn this into)\b/i
      const isEditing = editIntent.test(trimmed)
      const previousAssistantImages: string[] = (() => {
        if (!isEditing) return []
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i]
          if (m.role !== 'assistant') continue
          const out: string[] = []
          const re = /<image:([^>]+)>/g
          let match: RegExpExecArray | null
          while ((match = re.exec(m.content)) !== null) {
            const url = match[1]
            if (typeof url === 'string' && url.startsWith('data:image')) out.push(url)
          }
          if (out.length > 0) return out
        }
        return []
      })()
      const inputImages: string[] = Array.from(new Set([...(inputImagesFromFiles || []), ...(previousAssistantImages || [])]))
      const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      const inputPdfs: { filename: string; dataUrl: string }[] = await Promise.all(
        pdfFiles.map(
          (f) =>
            new Promise<{ filename: string; dataUrl: string }>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve({ filename: f.name, dataUrl: String(reader.result) })
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(f)
            })
        )
      )
      // Collect user-attached audio as base64 + normalized format (mp3|wav only)
      const audioFilesAll = files.filter((f) => (f.type || '').toLowerCase().startsWith('audio/'))
      const getAudioFormat = (f: File): 'mp3' | 'wav' | null => {
        const mime = (f.type || '').toLowerCase()
        const ext = (f.name.split('.').pop() || '').toLowerCase()
        if (mime.includes('mpeg') || ext === 'mp3') return 'mp3'
        if (mime.includes('wav') || mime.includes('wave') || ext === 'wav') return 'wav'
        return null
      }
      const audioFiles = audioFilesAll.filter((f) => getAudioFormat(f) !== null)
      const inputAudios: { format: 'mp3' | 'wav'; base64: string }[] = await Promise.all(
        audioFiles.map(
          (f) =>
            new Promise<{ format: 'mp3' | 'wav'; base64: string }>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const dataUrl = String(reader.result || '')
                  const commaIdx = dataUrl.indexOf(',')
                  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
                  const format = getAudioFormat(f) as 'mp3' | 'wav'
                  resolve({ format, base64 })
                } catch (e) {
                  reject(e)
                }
              }
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(f)
            })
        )
      )
      // Clear input files after capturing previews and data URLs
      setFiles([])
      const stripImageData = (text: string): string => {
        const angleTag = /<(?:image|image_partial):[^>]+>/gi
        const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
        const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
        const audioBracket = /\[data:audio\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
        const audioBare = /data:audio\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
        const pdfBracket = /\[data:application\/pdf;base64,[^\]]+\]/gi
        const pdfBare = /data:application\/pdf;base64,[A-Za-z0-9+/=]+/gi
        return text
          .replace(angleTag, '[image omitted]')
          .replace(bracketDataUrl, '[image omitted]')
          .replace(bareDataUrl, '[image omitted]')
          .replace(audioBracket, '[audio omitted]')
          .replace(audioBare, '[audio omitted]')
          .replace(pdfBracket, '[pdf omitted]')
          .replace(pdfBare, '[pdf omitted]')
      }
      const payloadMessages = nextMessages.map((m) => ({ ...m, content: stripImageData(m.content) }))
      const ac = new AbortController()
      abortControllerRef.current = ac
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          inputImages,
          inputPdfs,
          inputAudios,
          previousResponseId: lastResponseId,
          model: modelChoice,
          useTavily,
        }),
        signal: ac.signal,
      })

      if (!res.ok) {
        try {
          const errJson: any = await res.json()
          const code = typeof errJson?.error?.code === 'number' ? errJson.error.code : res.status
          const message = errJson?.error?.message || `HTTP ${code}`
          throw new Error(message)
        } catch {
          let details = ''
          try { details = await res.text() } catch {}
          const msg = details && details.trim().length > 0 ? details : `HTTP ${res.status}`
          throw new Error(msg)
        }
      }
      if (!res.body) {
        throw new Error('No response body received from server')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      setStatus('streaming')

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        assistantText += chunk
        const idMatch = /<response_id:([^>]+)>/g.exec(chunk)
        if (idMatch && idMatch[1]) setLastResponseId(idMatch[1])
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = { role: 'assistant', content: assistantText }
          } else {
            updated.push({ role: 'assistant', content: assistantText })
          }
          return updated
        })
        queueMicrotask(() => {
          if (pinnedToBottomRef.current) {
            outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
          }
        })
      }

      const finalChunk = decoder.decode()
      if (finalChunk) {
        assistantText += finalChunk
        const idMatch = /<response_id:([^>]+)>/g.exec(finalChunk)
        if (idMatch && idMatch[1]) setLastResponseId(idMatch[1])
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = { role: 'assistant', content: assistantText }
          }
          return updated
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `There was an error: ${message}` },
      ])
      setStatus('error')
    } finally {
      setIsLoading(false)
      setStatus('ready')
      
      abortControllerRef.current = null
    }
  }

  const stop = useCallback(() => {
    try {
      abortControllerRef.current?.abort()
    } catch {}
    setIsLoading(false)
    setStatus('ready')
  }, [])

  return (
    <section ref={containerRef} className={cn('w-full flex flex-col px-3 sm:px-4')}>
      <div
        ref={outputRef}
        className={cn('rounded pt-1 pb-3 overflow-y-auto text-base font-sans chat-scroll', messages.length === 0 && 'hidden')}
        style={{ height: outputHeight ? `${outputHeight}px` : undefined }}
      >
        {messages.length === 0 ? null : (
          messages.map((m, i) => {
            const isFirst = i === 0
            const speakerChanged = !isFirst && messages[i - 1].role !== m.role
            const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
            return (
              <div key={i} className={`${topMarginClass} mb-0`}>
                <div className={cn('chat-row', m.role === 'user' ? 'user' : 'assistant')}>
                  {m.role === 'user' ? (
                    (() => {
                      const attachments = sentAttachmentsByMessageIndex[i] || []
                      const hasText = (m.content || '').trim().length > 0
                      const hasAttachments = attachments.length > 0
                      const attachmentsOnly = !hasText && hasAttachments
                      if (attachmentsOnly) {
                        return (
                          <div className={cn('chat-bubble', 'user', 'compact', 'inline-flex')}>
                            <MessageAttachmentList attachments={attachments} compact />
                          </div>
                        )
                      }
                      return (
                        <div className={cn('chat-bubble', 'user', 'min-w-0')}>
                          <div className="min-w-0 w-full">
                            {renderMessageContent(m.role, m.content)}
                            {hasAttachments ? (
                              <MessageAttachmentList attachments={attachments} />
                            ) : null}
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className={cn('min-w-0 w-full')}>
                      <div className="min-w-0 w-full">
                        {renderMessageContent(m.role, m.content)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      <div
        ref={inputWrapperRef}
        className={cn(messages.length === 0 ? 'mt-12 sm:mt-16 md:mt-20 mb-0' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+12px)] sm:mb-0')}
        aria-busy={isLoading}
      >
        {messages.length === 0 ? (
          <>
            <div style={{ width: '100%', height: '180px', position: 'relative', margin: '4px 0 8px 0' }}>
              <Orb
                hoverIntensity={2}
                rotateOnHover={true}
                hue={25}
                forceHoverState={false}
              />
            </div>
            <div className="text-neutral-600 dark:text-neutral-300 font-medium text-2xl sm:text-3xl text-center mt-2 sm:mt-3 mb-8 sm:mb-10">
              {`What's on your mind ${timeOfDayWord}?`}
            </div>
          </>
        ) : null}
        <ChatInput
          value={input}
          onValueChange={setInput}
          onSend={handleSend}
          isSubmitting={isLoading}
          files={files}
          onFileUpload={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          onFileRemove={(file) => setFiles((prev) => prev.filter((f) => f !== file))}
          stop={stop}
          status={status}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          useTavily={useTavily}
          onUseTavilyToggle={() => setUseTavily((v) => !v)}
        />
      </div>
    </section>
  )
}