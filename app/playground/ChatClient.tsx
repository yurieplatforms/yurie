'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  createContext,
  useContext,
} from 'react'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'
import {
  ArrowUp,
  Stop,
  ImageSquare,
  X,
  CaretDown,
  Globe,
  Sparkle,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Image from 'next/image'
import { Response } from '@/app/components/ai-elements/response'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MiB

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
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type PromptInputContextValue = {
  isLoading: boolean
  value: string
  setValue: (newValue: string) => void
  maxHeight: number | string
  onSubmit?: () => void
}
const PromptInputContext = createContext<PromptInputContextValue | null>(null)
function usePromptInput(): PromptInputContextValue {
  return useContext(PromptInputContext)!
}

type PromptInputProps = {
  className?: string
  isLoading?: boolean
  maxHeight?: number | string
  value?: string
  onValueChange?: (value: string) => void
  onSubmit?: () => void
  children?: React.ReactNode
}
function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || '')
  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }
  return (
    <PromptInputContext.Provider
      value={{
        isLoading,
        value: value ?? internalValue,
        setValue: onValueChange ?? handleChange,
        maxHeight,
        onSubmit,
      }}
    >
      <div
        className={cn(
          'glass-input-wrap',
          isLoading && 'ai-border-glow',
          className
        )}
      >
        <div className="glass-input-inner">{children}</div>
      </div>
    </PromptInputContext.Provider>
  )
}

type PromptInputTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onKeyDown'
> & {
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  disableAutosize?: boolean
}
function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit } = usePromptInput()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (disableAutosize || !textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
  }, [value, disableAutosize])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e)
  }
  const maxHeightStyle =
    typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
  return (
    <textarea
      ref={textareaRef}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'min-h-[60px] w-full resize-none border-none bg-transparent text-neutral-900 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-neutral-100',
        'overflow-y-auto',
        className
      )}
      style={{ maxHeight: maxHeightStyle }}
      rows={1}
      {...props}
    />
  )
}

function MessageAttachmentList({
  attachments,
  compact = false,
}: {
  attachments: AttachmentPreview[]
  compact?: boolean
}) {
  if (!attachments || attachments.length === 0) return null
  return (
    <div
      className={cn(
        compact ? 'm-0' : 'mt-2 mb-3',
        'flex flex-row flex-wrap gap-2'
      )}
    >
      {attachments.map((att) =>
        att.isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={att.id}
            src={att.objectUrl}
            alt={att.name}
            className="max-h-56 rounded border border-neutral-200 object-cover dark:border-neutral-800"
          />
        ) : (
          <a
            key={att.id}
            href={att.objectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--surface)] px-3 py-2 text-xs hover:bg-[var(--surface-hover)]"
          >
            <span className="font-medium">{att.name}</span>
            <span className="ml-2 text-neutral-500">
              {(att.size / 1024).toFixed(2)}kB
            </span>
          </a>
        )
      )}
    </div>
  )
}

type SourceDisplayParts = {
  href: string
  hostname: string
  domain: string
  path: string
  faviconUrl: string
}

function safeParseUrl(rawUrl: string): URL | null {
  try {
    if (rawUrl.startsWith('//')) return new URL('https:' + rawUrl)
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function toDisplayParts(rawUrl: string): SourceDisplayParts {
  const parsed = safeParseUrl(rawUrl)
  const hostname = parsed?.hostname || ''
  const domain = hostname.replace(/^www\./i, '') || rawUrl
  const pathname = (parsed?.pathname || '/').replace(/\/$/, '') || '/'
  const search = parsed?.search || ''
  const path = `${pathname}${search}`
  const faviconUrl = hostname
    ? `https://icons.duckduckgo.com/ip3/${hostname}.ico`
    : ''
  return {
    href: parsed ? parsed.href : rawUrl,
    hostname,
    domain,
    path,
    faviconUrl,
  }
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const parsed = safeParseUrl(u)
    const key = parsed ? `${parsed.hostname}${parsed.pathname}${parsed.search}` : u
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}

function SourcesList({ urls }: { urls: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const MAX_VISIBLE = 6
  const deduped = useMemo(() => dedupeUrls(urls), [urls])
  const shown = expanded ? deduped : deduped.slice(0, MAX_VISIBLE)
  return (
    <div className="mt-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/60 p-0 shadow-xs backdrop-blur-[2px]">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] text-[var(--color-accent)]">
            <Globe className="size-4" weight="bold" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">Sources</span>
        </div>
        <div className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] leading-none text-neutral-600 dark:text-neutral-400">
          {deduped.length}
        </div>
      </div>
      <div className="h-px w-full bg-[var(--border-color)]/80" />
      <ul className="grid grid-cols-1 gap-0.5 p-1.5 sm:grid-cols-2">
        {shown.map((u) => {
          const p = toDisplayParts(u)
          return (
            <li key={u} className="min-w-0">
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                title={p.href}
                className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-[var(--border-color)] hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              >
                {p.faviconUrl ? (
                  <Image
                    src={p.faviconUrl}
                    alt=""
                    width={14}
                    height={14}
                    className="size-[14px] rounded-sm"
                  />
                ) : (
                  <span className="inline-block size-[14px] rounded-sm bg-neutral-300 dark:bg-neutral-700" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-neutral-900 group-hover:underline dark:text-neutral-100">
                    {p.domain}
                  </div>
                  <div className="truncate text-[11px] text-neutral-500">
                    {p.path}
                  </div>
                </div>
                <ArrowSquareOut className="ml-1 size-3 shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
              </a>
            </li>
          )
        })}
      </ul>
      {deduped.length > MAX_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-2 mb-2 mt-0 inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium text-neutral-700 underline-offset-2 transition-colors hover:cursor-pointer hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
        >
          {expanded ? 'Show less' : `Show all ${deduped.length}`}
        </button>
      ) : null}
    </div>
  )
}

function ThinkingPanel({
  content,
  generating = false,
}: {
  content: string
  generating?: boolean
}) {
  const [open, setOpen] = useState(false)
  const maxHeight = open ? 'auto' : 0
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group inline-flex items-center gap-2 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100'
        )}
        aria-expanded={open}
        aria-busy={generating}
      >
        <span className="inline-flex size-6 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] text-[var(--color-accent)]">
          <Sparkle className="size-4" weight="bold" />
        </span>
        <span className={generating ? 'ai-text-shimmer' : undefined}>
          {open ? 'Hide thinking' : 'Show thinking'}
        </span>
        <CaretDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          weight="bold"
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="think"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: maxHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-0 ml-[12px] rounded-lg bg-[var(--color-background)] px-0 py-2">
              <div
                className="prose-message border-l-[3px] border-neutral-300 pl-3 text-sm leading-relaxed dark:border-neutral-800"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function FileItem({
  file,
  onRemove,
}: {
  file: File
  onRemove: (file: File) => void
}) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isLikelyImage = useMemo(() => {
    const mime = (file.type || '').toLowerCase()
    if (mime.startsWith('image/')) return true
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const imageExts = [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'bmp',
      'svg',
      'heic',
      'heif',
      'tif',
      'tiff',
      'avif',
    ]
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
      <div className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-2 pr-3 transition-colors hover:bg-[var(--surface-hover)]">
        {isLikelyImage ? (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-700">
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt={file.name}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
                onError={loadDataUrlFallback}
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-xs font-medium">{file.name}</span>
          <span className="text-xs text-gray-500">
            {(file.size / 1024).toFixed(2)}kB
          </span>
        </div>
      </div>
      {!isRemoving ? (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-1 right-1 z-10 inline-flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[var(--border-color)] bg-[var(--surface)] text-black shadow-none transition-colors hover:bg-[var(--surface-hover)] dark:text-white"
          aria-label="Remove file"
        >
          <X className="size-3" weight="bold" />
        </button>
      ) : null}
    </div>
  )
}

function FileList({
  files,
  onFileRemove,
}: {
  files: File[]
  onFileRemove: (file: File) => void
}) {
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
                  <FileItem
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    file={file}
                    onRemove={onFileRemove}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ButtonFileUpload({
  onFileUpload,
}: {
  onFileUpload: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => {
            const mime = (f.type || '').toLowerCase()
            const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg'
            const isPng = mime === 'image/png'
            const withinLimit = f.size <= MAX_IMAGE_BYTES
            return (isJpeg || isPng) && withinLimit
          })
          onFileUpload(files)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      <label
        htmlFor={inputId}
        role="button"
        tabIndex={0}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-0 leading-none transition-colors hover:border-[var(--border-color-hover)] hover:bg-[var(--surface-hover)]"
        aria-label="Add images"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <ImageSquare className="size-4" weight="bold" aria-hidden="true" />
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
  useWebSearch: boolean
  onUseWebSearchToggle: () => void
}
function ChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  stop,
  status,
  modelChoice,
  onModelChange,
  useWebSearch,
  onUseWebSearchToggle,
}: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const setDragging = useCallback((v: boolean) => {
    setIsDragging(v)
  }, [])

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      try {
        const items = Array.from(e.dataTransfer?.items || [])
        const hasFiles =
          items.some((it) => it.kind === 'file') ||
          (e.dataTransfer?.types || []).includes('Files')
        if (!hasFiles) return
        dragCounterRef.current += 1
        setDragging(true)
      } catch {}
    },
    [setDragging]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      try {
        const items = Array.from(e.dataTransfer?.items || [])
        const hasFiles =
          items.some((it) => it.kind === 'file') ||
          (e.dataTransfer?.types || []).includes('Files')
        if (!hasFiles) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'copy'
        setDragging(true)
      } catch {}
    },
    [setDragging]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      try {
        const items = Array.from(e.dataTransfer?.items || [])
        const hasFiles =
          items.some((it) => it.kind === 'file') ||
          (e.dataTransfer?.types || []).includes('Files')
        if (!hasFiles) return
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
        if (dragCounterRef.current === 0) setDragging(false)
      } catch {}
    },
    [setDragging]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      try {
        e.preventDefault()
        e.stopPropagation()
        const fileList = Array.from(e.dataTransfer?.files || []).filter((f) => {
          const mime = (f.type || '').toLowerCase()
          const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg'
          const isPng = mime === 'image/png'
          const withinLimit = f.size <= MAX_IMAGE_BYTES
          return (isJpeg || isPng) && withinLimit
        })
        if (fileList.length > 0) onFileUpload(fileList)
      } finally {
        dragCounterRef.current = 0
        setDragging(false)
        try {
          e.dataTransfer?.clearData()
        } catch {}
      }
    },
    [onFileUpload, setDragging]
  )

  const handleSend = useCallback(() => {
    if (status === 'streaming' || status === 'submitted') {
      stop()
      return
    }
    if (isSubmitting) return
    onSend()
  }, [isSubmitting, onSend, status, stop])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        (status === 'streaming' || status === 'submitted')
      ) {
        e.preventDefault()
        // While streaming, Enter acts as Stop; typing remains allowed otherwise
        stop()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (isOnlyWhitespace(value) && files.length === 0) return
        e.preventDefault()
        onSend()
      }
    },
    [files.length, onSend, status, stop, value]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const hasImageContent = Array.from(items).some((item) =>
        item.type === 'image/png' || item.type === 'image/jpeg' || item.type === 'image/jpg'
      )
      if (hasImageContent) {
        const imageFiles: File[] = []
        for (const item of Array.from(items)) {
          if (item.type === 'image/png' || item.type === 'image/jpeg' || item.type === 'image/jpg') {
            const file = item.getAsFile()
            if (file) {
              if (file.size > MAX_IMAGE_BYTES) continue
              const newFile = new File(
                [file],
                `pasted-image-${Date.now()}.${file.type.split('/')[1]}`,
                { type: file.type }
              )
              imageFiles.push(newFile)
            }
          }
        }
        if (imageFiles.length > 0) onFileUpload(imageFiles)
      }
    },
    [onFileUpload]
  )

  const modelOptions = useMemo(
    () => [
      { value: 'x-ai/grok-4-0709', label: 'Grok 4' },
      { value: 'x-ai/grok-4-fast-reasoning', label: 'Grok 4 Fast' },
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
              <div className="absolute inset-1 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-accent)] bg-[var(--surface)]/70">
                <div className="text-sm font-medium text-[var(--color-accent)]">
                  Drop images to attach
                </div>
              </div>
            </div>
          ) : null}
          <PromptInput
            className="relative z-10 w-full p-0 pt-0 shadow-xs"
            maxHeight={200}
            value={value}
            onValueChange={onValueChange}
            isLoading={status === 'streaming' || status === 'submitted'}
          >
            <FileList files={files} onFileRemove={onFileRemove} />
            {/* Top: Text area */}
            <div className="relative px-2 pt-2 pb-0">
              <PromptInputTextarea
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Ask Yurie"
                className="min-h-[60px] px-3 py-3 text-base leading-[1.3] sm:text-base md:text-base"
              />
            </div>
            {/* Bottom: Actions row */}
            <div className="mt-2 flex w-full items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-1.5 pl-1">
                <ButtonFileUpload onFileUpload={onFileUpload} />
                <button
                  type="button"
                  onClick={onUseWebSearchToggle}
                  className={cn(
                    'inline-flex h-9 cursor-pointer items-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] px-3 leading-none transition-colors gap-1.5',
                    useWebSearch
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)] hover:bg-[var(--surface-hover)]'
                      : 'text-neutral-900 dark:text-neutral-100 hover:border-[var(--border-color-hover)] hover:bg-[var(--surface-hover)]'
                  )}
                  aria-pressed={useWebSearch}
                  aria-label="Web search"
                  title="Web search"
                >
                  <Globe className="size-5" weight="bold" aria-hidden="true" />
                  <span className="text-xs font-medium">Search</span>
                </button>
                <div className="relative inline-flex items-center">
                  <label className="sr-only" htmlFor="model-select">
                    Model
                  </label>
                  <div className="group relative">
                    <div
                      aria-hidden="true"
                      className={cn(
                        'inline-flex h-9 items-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] px-3 transition-colors',
                        'group-hover:border-[var(--border-color-hover)] group-hover:bg-[var(--surface-hover)]'
                      )}
                    >
                      <span className="text-xs text-neutral-900 dark:text-neutral-100">
                        {selectedModelLabel}
                      </span>
                      <CaretDown
                        className="ml-1.5 size-4 text-neutral-600 dark:text-neutral-300"
                        weight="bold"
                        aria-hidden="true"
                      />
                    </div>
                    <select
                      id="model-select"
                      value={modelChoice}
                      onChange={(e) => onModelChange(e.target.value)}
                      className={cn(
                        'absolute inset-0 h-9 w-full cursor-pointer text-[11px] opacity-0',
                        'focus:outline-none'
                      )}
                    >
                      {modelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="pr-1">
                <button
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] p-0 leading-none text-black transition-all duration-300 ease-out hover:border-[var(--border-color-hover)] hover:bg-[var(--surface-hover)] dark:text-white"
                  disabled={
                    status !== 'streaming' &&
                    status !== 'submitted' &&
                    (isSubmitting ||
                      (isOnlyWhitespace(value) && files.length === 0))
                  }
                  type="button"
                  onClick={handleSend}
                  aria-label={
                    status === 'streaming' || status === 'submitted'
                      ? 'Stop'
                      : 'Send message'
                  }
                >
                  {status === 'streaming' || status === 'submitted' ? (
                    <Stop className="size-4" weight="bold" aria-hidden="true" />
                  ) : (
                    <ArrowUp
                      className="size-4"
                      weight="bold"
                      aria-hidden="true"
                    />
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
  const [files, setFiles] = useState<File[]>([])
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [status, setStatus] = useState<
    'submitted' | 'streaming' | 'ready' | 'error'
  >('ready')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [sentAttachmentsByMessageIndex, setSentAttachmentsByMessageIndex] =
    useState<Record<number, AttachmentPreview[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)
  const [modelChoice, setModelChoice] = useState<string>(
    'x-ai/grok-4-fast-reasoning'
  )
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
  const [timeOfDayWord, setTimeOfDayWord] = useState<'today' | 'tonight'>(
    () => {
      try {
        const hours = new Date().getHours()
        const isNight = hours < 6 || hours >= 18
        return isNight ? 'tonight' : 'today'
      } catch {
        return 'today'
      }
    }
  )

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
    const urlsAtMount = createdObjectUrlsRef.current
    return () => {
      try {
        for (const url of urlsAtMount) URL.revokeObjectURL(url)
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
    const handle = async (e: Event) => {
      const target = e.target as HTMLElement | null
      const btn = target?.closest('.chat-copy') as HTMLButtonElement | null
      if (!btn) return
      const wrapper = btn.closest('.chat-code') as HTMLElement | null
      const codeEl = wrapper?.querySelector('pre code') as HTMLElement | null
      const text = codeEl?.textContent || ''
      try {
        await navigator.clipboard.writeText(text)
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

  // CSS-driven layout (flex) handles heights; no JS recompute needed

  // Maintain pinned-to-bottom state and toggle auto-hide scrollbar visibility
  useEffect(() => {
    const el = outputRef.current
    if (!el) return
    const computePinned = () => {
      try {
        const threshold = 16
        const distanceFromBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight
        pinnedToBottomRef.current = distanceFromBottom <= threshold
      } catch {}
    }
    const updatePinned: EventListener = () => computePinned()
    computePinned()
    el.addEventListener('scroll', updatePinned, { passive: true } as AddEventListenerOptions)
    return () => {
      el.removeEventListener('scroll', updatePinned)
    }
  }, [])

  // If the output area resizes and user is pinned, keep them pinned
  // Keep pinned when layout changes (CSS-only sizing)
  useEffect(() => {
    if (pinnedToBottomRef.current) {
      queueMicrotask(() => {
        outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
      })
    }
  })

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
    const blockedContentTags = [
      'script',
      'style',
      'title',
      'iframe',
      'object',
      'embed',
      'noscript',
    ]
    const contentTagPattern = new RegExp(
      `<\\s*(${blockedContentTags.join('|')})\\b[\\s\\S]*?<\\/\\s*\\1\\s*>`,
      'gi'
    )
    html = html.replace(contentTagPattern, '')
    const blockedVoidTags = [
      'link',
      'meta',
      'base',
      'form',
      'input',
      'select',
      'option',
      'textarea',
      'frame',
      'frameset',
    ]
    const voidTagPattern = new RegExp(
      `<\\s*(${blockedVoidTags.join('|')})\\b[^>]*>`,
      'gi'
    )
    html = html.replace(voidTagPattern, '')
    html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    html = html.replace(
      /(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
      '$1="#"'
    )

    return html
  }

  function renderMessageContent(role: 'user' | 'assistant', content: string) {
    const legacyBracketPattern =
      '\\[' + 'data:image' + '\\/[a-zA-Z]+;base64,[^\\]]+' + '\\]'
    const pattern = new RegExp(
      `<image_partial:([^>]+)>|<image:([^>]+)>|<reasoning_partial:([^>]+)>|<reasoning:([^>]+)>|<revised_prompt:([^>]+)>|<response_id:([^>]+)>|<summary_text:([^>]+)>|<incomplete:([^>]+)>|<citations:([^>]+)>|${legacyBracketPattern}`,
      'g'
    )
    type Part =
      | { type: 'text'; value: string }
      | { type: 'image'; src: string; partial?: boolean }
      | { type: 'reasoning'; value: string; partial?: boolean }
      | {
          type: 'meta'
          key: 'revised_prompt' | 'response_id' | 'summary_text' | 'incomplete'
          value: string
        }
      | { type: 'citations'; urls: string[] }
    const parts: Part[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: content.slice(lastIndex, match.index),
        })
      }
      const full = match[0]
      const partialPayload = match[1]
      const finalPayload = match[2]
      const reasoningPartialPayload = match[3]
      const reasoningFinalPayload = match[4]
      const revisedPayload = match[5]
      const responseIdPayload = match[6]
      const summaryPayload = match[7]
      const incompletePayload = match[8]
      const src = partialPayload
        ? partialPayload
        : finalPayload
          ? finalPayload
          : full.startsWith('[')
            ? full.slice(1, -1)
            : ''
      const citationsPayload = match[9]
      if (src) {
        const isPartial = Boolean(partialPayload)
        parts.push({ type: 'image', src, partial: isPartial })
      }
      if (
        typeof reasoningPartialPayload === 'string' &&
        reasoningPartialPayload
      ) {
        parts.push({
          type: 'reasoning',
          value: reasoningPartialPayload,
          partial: true,
        })
      }
      if (typeof reasoningFinalPayload === 'string' && reasoningFinalPayload) {
        parts.push({ type: 'reasoning', value: reasoningFinalPayload })
      }
      if (typeof revisedPayload === 'string' && revisedPayload) {
        parts.push({
          type: 'meta',
          key: 'revised_prompt',
          value: revisedPayload,
        })
      }
      if (typeof responseIdPayload === 'string' && responseIdPayload) {
        parts.push({
          type: 'meta',
          key: 'response_id',
          value: responseIdPayload,
        })
      }
      if (typeof summaryPayload === 'string' && summaryPayload) {
        parts.push({ type: 'meta', key: 'summary_text', value: summaryPayload })
      }
      if (typeof incompletePayload === 'string' && incompletePayload) {
        parts.push({
          type: 'meta',
          key: 'incomplete',
          value: incompletePayload,
        })
      }
      if (typeof citationsPayload === 'string' && citationsPayload) {
        try {
          const parsed = JSON.parse(citationsPayload)
          if (Array.isArray(parsed)) {
            const urls = parsed
              .map((u) => (typeof u === 'string' ? u : String(u)))
              .filter((u) => u && /^(https?:)?\/\//i.test(u))
            if (urls.length > 0) parts.push({ type: 'citations', urls })
          }
        } catch {}
      }
      lastIndex = match.index + full.length
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.slice(lastIndex) })
    }

    const latestPartialIndex = (() => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        if (p.type === 'image' && p.partial) return i
      }
      return -1
    })()
    const hasFinalImage = parts.some(
      (p) => p.type === 'image' && !p.partial
    )
    const reasoningParts = parts.filter(
      (p): p is Extract<Part, { type: 'reasoning' }> => p.type === 'reasoning'
    )
    const hasFinalReasoning = reasoningParts.some((r) => !r.partial)
    const decodeBase64Utf8 = (b64: string): string => {
      try {
        const bin = atob(b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return new TextDecoder().decode(bytes)
      } catch {
        return ''
      }
    }
    const reasoningDecoded = (() => {
      if (hasFinalReasoning) {
        const finals = reasoningParts
          .filter((r) => !r.partial)
          .map((r) => String(r.value))
        return finals.map(decodeBase64Utf8).join('')
      }
      const partials = reasoningParts
        .filter((r) => r.partial)
        .map((r) => String(r.value))
      if (partials.length === 0) return ''
      return partials.map(decodeBase64Utf8).join('')
    })()
    const reasoningHtml = reasoningDecoded
      ? sanitizeHtml(md.parse(reasoningDecoded) as string)
      : ''
    return (
      <>
        {role === 'assistant' && reasoningHtml ? (
          <ThinkingPanel
            content={reasoningHtml}
            generating={status === 'submitted' || status === 'streaming'}
          />
        ) : null}
        {parts.map((p, i) => {
          if (p.type === 'text') {
            if (role === 'assistant') {
              return (
                <Response
                  key={i}
                  parseIncompleteMarkdown
                  allowedImagePrefixes={["*"]}
                  allowedLinkPrefixes={["*"]}
                >
                  {p.value}
                </Response>
              )
            }
            const rawHtml = md.parse(p.value) as string
            return (
              <div
                key={i}
                className={cn('prose prose-neutral dark:prose-invert')}
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
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={i}
                  src={p.src}
                  alt="Generated image"
                  className={cn(
                    'mt-2 max-w-full rounded border border-neutral-200 dark:border-neutral-800',
                    role === 'assistant' ? 'mb-1' : 'mb-3'
                  )}
                />
              </>
            )
          }
          return null
        })}
        {parts.map((p, i) => {
          if (p.type === 'meta') {
            const meta = p
            // Skip rendering Response ID
            if (meta.key === 'response_id') {
              return null
            }
            const label =
              meta.key === 'revised_prompt'
                ? 'Revised prompt'
                : meta.key === 'summary_text'
                    ? 'Summary'
                    : 'Status'
            return (
              <div key={`meta-${i}`} className="mt-1 text-xs text-neutral-500">
                <span className="font-medium">{label}:</span> {meta.value}
              </div>
            )
          }
          return null
        })}
        {(() => {
          const latestCitations = (() => {
            for (let i = parts.length - 1; i >= 0; i--) {
              const p = parts[i]
              if (p.type === 'citations' && Array.isArray(p.urls)) {
                return p.urls
              }
            }
            return [] as string[]
          })()
          if (role === 'assistant' && latestCitations.length > 0) {
            return <SourcesList urls={latestCitations} />
          }
          return null
        })()}
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
        const imageExts = [
          'png',
          'jpg',
          'jpeg',
          'gif',
          'webp',
          'bmp',
          'svg',
          'heic',
          'heif',
          'tif',
          'tiff',
          'avif',
        ]
        const isImage = mime.startsWith('image/') || imageExts.includes(ext)
        return {
          id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
          name: f.name,
          size: f.size,
          mime: f.type,
          objectUrl: url,
          isImage,
        }
      })
      if (attachmentsForPreview.length > 0) {
        const indexForThisMessage = nextMessages.length - 1
        setSentAttachmentsByMessageIndex((prev) => ({
          ...prev,
          [indexForThisMessage]: attachmentsForPreview,
        }))
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
      // Extract http(s) image URLs from the prompt text (jpg/jpeg/png only)
      const extractHttpImageUrls = (text: string): string[] => {
        try {
          const urlRegex = /https?:\/\/[\w\-._~:?#\[\]@!$&'()*+,;=%/]+/gi
          const candidates = (text.match(urlRegex) || [])
          const filtered = candidates.filter((u) => /\.(?:jpg|jpeg|png)(?:$|[?#])/i.test(u))
          // Basic validation that they are valid URLs
          const valid = filtered.filter((u) => {
            try {
              const p = new URL(u)
              return p.protocol === 'http:' || p.protocol === 'https:'
            } catch {
              return false
            }
          })
          return Array.from(new Set(valid))
        } catch {
          return []
        }
      }
      const httpImageUrls = extractHttpImageUrls(trimmed)
      const inputImages: string[] = Array.from(
        new Set([...(inputImagesFromFiles || []), ...(httpImageUrls || [])])
      )
      // Clear input files after capturing previews and data URLs
      setFiles([])
      const stripImageData = (text: string): string => {
        const angleTag = /<(?:image|image_partial):[^>]+>/gi
        const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
        const bareDataUrl =
          /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
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
      const payloadMessages = nextMessages.map((m) => ({
        ...m,
        content: stripImageData(m.content),
      }))
      const ac = new AbortController()
      abortControllerRef.current = ac
      // Only include reasoning for models that support reasoning_effort (grok-3-mini, grok-3-mini-fast)
      const supportsReasoningEffort = /grok-3-mini(\b|\-|_)/i.test(modelChoice) || /grok-3-mini-fast/i.test(modelChoice)
      type ChatRequestPayload = {
        messages: ChatMessage[]
        inputImages?: string[]
        previousResponseId?: string | null
        model?: string
        reasoning?: { effort: 'high' }
        search_parameters?: { mode: 'on' | 'off'; return_citations?: boolean }
      }
      const body: ChatRequestPayload = {
        messages: payloadMessages,
        inputImages,
        previousResponseId: lastResponseId,
        model: modelChoice,
      }
      if (supportsReasoningEffort) {
        body.reasoning = { effort: 'high' }
      }
      // xAI Live Search: wire Globe toggle
      try {
        body.search_parameters = useWebSearch
          ? { mode: 'on', return_citations: true }
          : { mode: 'off' }
      } catch {}
      const res = await fetch('/api/xai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      })

      if (!res.ok) {
        try {
          type ErrorJSON = { error?: { code?: number; message?: string } }
          const errJson = (await res.json()) as ErrorJSON
          const code =
            typeof errJson?.error?.code === 'number'
              ? errJson.error.code
              : res.status
          const message = errJson?.error?.message || `HTTP ${code}`
          throw new Error(message)
        } catch {
          let details = ''
          try {
            details = await res.text()
          } catch {}
          const msg =
            details && details.trim().length > 0
              ? details
              : `HTTP ${res.status}`
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
      const isAbort = (() => {
        try {
          if (err && typeof err === 'object') {
            const withName = err as { name?: string }
            if (withName.name === 'AbortError') return true
          }
          if (err instanceof DOMException && err.name === 'AbortError')
            return true
          if (err instanceof Error && /abort/i.test(err.message)) return true
        } catch {}
        return false
      })()
      if (!isAbort) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `There was an error: ${message}` },
        ])
        setStatus('error')
      }
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

  useEffect(() => {
    const el = outputRef.current
    if (!el) return
    try {
      el.scrollTo({ top: el.scrollHeight })
      pinnedToBottomRef.current = true
    } catch {}
  }, [])

  const isEmpty = messages.length === 0
  const [outputBottomPad, setOutputBottomPad] = useState<number>(96)
  // Height of the fixed input wrapper and its top position to anchor the bottom scrim
  const [inputOverlayHeight, setInputOverlayHeight] = useState<number>(120)
  // Track the top position of the input to anchor the bottom scrim
  // Top coordinate (in px) of the input wrapper relative to the viewport; used to anchor the scrim from prompt top → bottom
  const [inputOverlayTop, setInputOverlayTop] = useState<number>(0)

  useEffect(() => {
    if (isEmpty) return
    const compute = () => {
      try {
        const wrap = inputWrapperRef.current
        if (!wrap) return
        const rect = wrap.getBoundingClientRect()
        const height = Math.ceil(rect.height)
        const top = Math.max(0, Math.floor(rect.top))
        // Add generous breathing room so expanded blocks (e.g., Sources list) are fully visible
        setOutputBottomPad(Math.max(112, height + 32))
        setInputOverlayHeight(height)
        setInputOverlayTop(top)
        try {
          // Expose as CSS var for any pure-CSS uses
          document.documentElement.style.setProperty(
            '--input-wrapper-height',
            `${height}px`
          )
          document.documentElement.style.setProperty(
            '--input-wrapper-top',
            `${top}px`
          )
        } catch {}
      } catch {}
    }
    compute()
    // Recompute on resize and briefly after layout changes
    window.addEventListener('resize', compute, { passive: true } as AddEventListenerOptions)
    window.addEventListener('scroll', compute, { passive: true } as AddEventListenerOptions)
    const id = window.setInterval(compute, 300)
    const timeout = window.setTimeout(() => window.clearInterval(id), 1800)
    // Also observe the input wrapper in case its height changes without window resize
    let ro: ResizeObserver | null = null
    try {
      const RO = (window as any).ResizeObserver
      if (typeof RO === 'function') {
        const observer = new RO(() => compute())
        ro = observer
        if (inputWrapperRef.current) observer.observe(inputWrapperRef.current)
      }
    } catch {}
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute)
      window.clearInterval(id)
      window.clearTimeout(timeout)
      try {
        const target = inputWrapperRef.current
        if (ro && target) {
          ro.unobserve(target)
        }
      } catch {}
    }
  }, [isEmpty, messages.length])

  return (
    <section
      ref={containerRef}
      className={cn(
        'flex w-full flex-col px-3 sm:px-4 min-h-[70vh]',
        isEmpty && 'justify-center'
      )}
    >
      <div
        ref={outputRef}
        className={cn(
          'chat-scroll overflow-y-auto rounded pt-1 font-sans text-base flex-1 min-h-0 pb-[calc(env(safe-area-inset-bottom)+96px)] sm:pb-24',
          messages.length === 0 && 'hidden'
        )}
        style={isEmpty ? undefined : { paddingBottom: outputBottomPad }}
      >
        {messages.length === 0
          ? null
          : messages.map((m, i) => {
              const isFirst = i === 0
              const speakerChanged = !isFirst && messages[i - 1].role !== m.role
              const topMarginClass = isFirst
                ? 'mt-1'
                : speakerChanged
                  ? 'mt-2'
                  : 'mt-0.5'
              return (
                <div key={i} className={`${topMarginClass} mb-0`}>
                  <div
                    className={cn(
                      'chat-row',
                      m.role === 'user' ? 'user' : 'assistant'
                    )}
                  >
                    {m.role === 'user' ? (
                      (() => {
                        const attachments =
                          sentAttachmentsByMessageIndex[i] || []
                        const hasText = (m.content || '').trim().length > 0
                        const hasAttachments = attachments.length > 0
                        const attachmentsOnly = !hasText && hasAttachments
                        if (attachmentsOnly) {
                          return (
                            <div
                              className={cn(
                                'chat-bubble',
                                'user',
                                'compact',
                                'inline-flex'
                              )}
                            >
                              <MessageAttachmentList
                                attachments={attachments}
                                compact
                              />
                            </div>
                          )
                        }
                        return (
                          <div className={cn('chat-bubble', 'user', 'min-w-0')}>
                            <div className="w-full min-w-0">
                              {renderMessageContent(m.role, m.content)}
                              {hasAttachments ? (
                                <MessageAttachmentList
                                  attachments={attachments}
                                />
                              ) : null}
                            </div>
                          </div>
                        )
                      })()
                    ) : (
                      <div className={cn('w-full min-w-0')}>
                        <div className="w-full min-w-0">
                          {renderMessageContent(m.role, m.content)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
      </div>
      <div
        ref={inputWrapperRef}
        className={cn(
          isEmpty
            ? 'relative z-20'
            : 'relative fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+8px)] sm:bottom-3 z-20 mx-auto max-w-3xl px-3 sm:px-4'
        )}
        aria-busy={isLoading}
      >
        {!isEmpty ? (
          <div
            aria-hidden
            className="pointer-events-none fixed left-0 right-0 bottom-0 z-10 bg-[var(--color-background)]"
            style={{
              top: Math.max(0, inputOverlayTop + inputOverlayHeight),
            }}
          />
        ) : null}
        {!isEmpty ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-4 bottom-0 rounded-2xl bg-[var(--color-background)]"
          />
        ) : null}
        {isEmpty ? (
          <>
            <div className="mt-0 mb-8 text-center text-2xl font-medium text-neutral-600 sm:mb-10 sm:text-3xl dark:text-neutral-300">
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
          onFileUpload={(newFiles) =>
            setFiles((prev) => [...prev, ...newFiles])
          }
          onFileRemove={(file) =>
            setFiles((prev) => prev.filter((f) => f !== file))
          }
          stop={stop}
          status={status}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          useWebSearch={useWebSearch}
          onUseWebSearchToggle={() => setUseWebSearch((v) => !v)}
        />
      </div>
    </section>
  )
}
