"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useId, createContext, useContext } from 'react'
import { ArrowUp, Stop, Paperclip, X, FilePdf, CaretDown } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { Response as StreamResponse } from '../../components/ui/response'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '../../components/ui/reasoning'
import { cn } from '@/app/lib/utils'

// ============ Type Definitions ============

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

// ============ Context & Hooks ============

const PromptInputContext = createContext<any>(null)
function usePromptInput() {
  return useContext(PromptInputContext)
}

// ============ Sub-Components ============

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
      <div className={cn('bg-white dark:bg-[#303030] rounded-none p-2 shadow-sm border border-neutral-200/70 dark:border-neutral-700/70', className)}>
        {children}
      </div>
    </PromptInputContext.Provider>
  )
}

function PromptInputTextarea({ className, onKeyDown, disableAutosize = false, ...props }: any) {
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
  const maxHeightStyle = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
  return (
    <textarea
      ref={textareaRef}
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'text-neutral-900 dark:text-neutral-100 min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
        'overflow-y-auto',
        className
      )}
      style={{ maxHeight: maxHeightStyle }}
      rows={1}
      
      {...props}
    />
  )
}

function PromptInputActions({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  )
}

function MessageAttachmentList({ attachments }: { attachments: AttachmentPreview[] }) {
  if (!attachments || attachments.length === 0) return null
  return (
    <div className="mt-2 mb-3 flex flex-row flex-wrap gap-2">
      {attachments.map((att) => (
        att.isImage ? (
          <img
            key={att.id}
            src={att.objectUrl}
            alt={att.name}
            className="rounded-none max-h-56 object-cover"
          />
        ) : (
          <a
            key={att.id}
            href={att.objectUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-white dark:bg-black hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-none px-3 py-2 text-xs inline-flex items-center gap-2"
          >
            {(() => {
              const isPdf = att.mime === 'application/pdf' || (att.name.split('.').pop() || '').toLowerCase() === 'pdf'
              return isPdf ? (
                <FilePdf className="size-4 text-[#7f91e0]" weight="fill" aria-hidden="true" />
              ) : null
            })()}
            <span className="font-medium">{att.name}</span>
            <span className="text-neutral-500 ml-2">{(att.size / 1024).toFixed(2)}kB</span>
          </a>
        )
      ))}
    </div>
  )
}

function PromptInputAction({ tooltip, children, className }: { className?: string, tooltip: React.ReactNode, children: React.ReactNode } & React.ComponentProps<any>) {
  return (
    <div title={tooltip} className={className}>
      {children}
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
      <div className="bg-neutral-100 dark:bg-[#404040] hover:bg-neutral-200 dark:hover:bg-[#4a4a4a] flex w-full items-center gap-3 rounded-none p-2 pr-3 transition-colors">
        <div className="bg-neutral-200 dark:bg-neutral-700 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-none">
          {isLikelyImage ? (
            previewUrl ? (
              <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" loading="eager" decoding="async" onError={loadDataUrlFallback} />
            ) : null
          ) : (
            (() => {
              const ext = (file.name.split('.').pop() || '').toLowerCase()
              const isPdf = (file.type || '').toLowerCase() === 'application/pdf' || ext === 'pdf'
              if (isPdf) {
                return <FilePdf className="size-6 text-[#7f91e0]" weight="fill" aria-hidden="true" />
              }
              return <div className="text-center text-xs text-gray-400">{ext.toUpperCase()}</div>
            })()
          )}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-xs font-medium">{file.name}</span>
          <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)}kB</span>
        </div>
      </div>
      {!isRemoving ? (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute top-1 right-1 z-10 inline-flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-none bg-neutral-100 dark:bg-[#505050] text-black dark:text-white hover:bg-neutral-50 dark:hover:bg-[#4a4a4a] shadow-none transition-colors cursor-pointer"
          aria-label="Remove file"
        >
          <X className="size-3" />
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
          <div className="flex flex-row overflow-x-auto pl-2">
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
        accept="image/*,application/pdf"
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
        className="size-9 inline-flex items-center justify-center p-0 leading-none rounded-none cursor-pointer bg-transparent hover:bg-neutral-100 dark:hover:bg-[#404040] transition-colors transform translate-x-[4px]"
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
  files: File[]
  onFileUpload: (files: File[]) => void
  onFileRemove: (file: File) => void
  model: string
  onModelChange: (model: string) => void
  stop: () => void
  status?: 'submitted' | 'streaming' | 'ready' | 'error'
}
function ChatInput({ value, onValueChange, onSend, files, onFileUpload, onFileRemove, model, onModelChange, stop, status }: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)
  const isBusy = status === 'streaming' || status === 'submitted'

  const handleSend = useCallback(() => {
    if (isBusy) {
      stop()
      return
    }
    onSend()
  }, [isBusy, onSend, stop])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isBusy) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isOnlyWhitespace(value) && files.length === 0) return
      e.preventDefault()
      onSend()
    }
  }, [files.length, isBusy, onSend, value])

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

  const getModelLabel = useCallback((value: string) => {
    return value
  }, [])
  const displayModelLabel = getModelLabel(model)

  const modelMeasureRef = useRef<HTMLSpanElement>(null)
  const [modelSelectWidth, setModelSelectWidth] = useState<number>(0)
  useEffect(() => {
    try {
      const el = modelMeasureRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setModelSelectWidth(Math.ceil(rect.width))
    } catch {}
  }, [model])

  return (
    <div className="relative flex w-full flex-col gap-3 sm:gap-4">
      <div className="relative order-2 pb-2 sm:pb-4 md:order-1">
        <PromptInput className="relative z-10 w-full p-0 pt-0.5 shadow-xs" maxHeight={200} value={value} onValueChange={onValueChange}>
          <FileList files={files} onFileRemove={onFileRemove} />
          <PromptInputTextarea
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message Yurie"
            className="min-h-[44px] pt-2 px-3 sm:px-4 text-base leading-[1.4] sm:text-base md:text-base"
          />
          <PromptInputActions className="mt-2 sm:mt-3 w-full justify-between px-2 py-2">
            <div className="flex flex-wrap gap-1 items-center">
              <div className="relative inline-block h-9 shrink-0" style={{ width: modelSelectWidth ? `${modelSelectWidth}px` : undefined }}>
                <span
                  aria-hidden="true"
                  ref={modelMeasureRef}
                className="invisible inline-block h-9 rounded-none bg-transparent text-sm px-3 pr-7 whitespace-nowrap"
                >
                  {displayModelLabel}
                </span>
                <label htmlFor="model-select" className="sr-only">Model</label>
                <select
                  id="model-select"
                  value={model}
                  onChange={(e) => onModelChange(e.target.value)}
                  className="absolute inset-0 rounded-none bg-transparent hover:bg-neutral-100 dark:hover:bg-[#404040] hover:cursor-pointer disabled:cursor-not-allowed text-sm pl-3 pr-7 text-neutral-900 dark:text-neutral-100 appearance-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 transition-colors"
                  style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                  aria-label="Select model"
                  disabled={isBusy}
                >
                  <option value="gpt-5">gpt-5</option>
                  <option value="gpt-5-mini">gpt-5-mini</option>
                  <option value="gpt-5-nano">gpt-5-nano</option>
                  <option value="gpt-5-codex">gpt-5-codex</option>
                </select>
                <CaretDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600 dark:text-neutral-300 size-4" aria-hidden="true" />
              </div>
              
            </div>
            <div className="flex items-center gap-1 pr-1">
              <ButtonFileUpload onFileUpload={onFileUpload} />
              <PromptInputAction tooltip={status === 'streaming' || status === 'submitted' ? 'Stop' : 'Send'}>
                <button
                  className="size-9 inline-flex items-center justify-center p-0 leading-none rounded-none transition-all duration-300 ease-out bg-neutral-100 dark:bg-[#404040] text-black dark:text-white hover:cursor-pointer disabled:cursor-not-allowed transform translate-x-[5px]"
                  disabled={!isBusy && (isOnlyWhitespace(value) && files.length === 0)}
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
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  )
}

// ============ Main Component ============

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [outputHeight, setOutputHeight] = useState<number>(0)
  const [files, setFiles] = useState<File[]>([])
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [reasoningByMessageIndex, setReasoningByMessageIndex] = useState<Record<number, string>>({})
  const currentAssistantIndexRef = useRef<number | null>(null)
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [sentAttachmentsByMessageIndex, setSentAttachmentsByMessageIndex] = useState<Record<number, AttachmentPreview[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)
  const [selectedModel, setSelectedModel] = useState<string>('gpt-5')
  
  const streamBufferRef = useRef<string>('')

  // ============ Helper Functions ============

  useEffect(() => {
    return () => {
      try {
        for (const url of createdObjectUrlsRef.current) URL.revokeObjectURL(url)
      } catch {}
    }
  }, [])

  // Streamdown provides built-in copy controls for code blocks; no manual listeners needed

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

  function formatThinkingForMarkdown(input: string): string {
    if (!input) return input
    const normalized = input.replace(/\r\n?/g, '\n')
    const lines = normalized.split('\n')
    const result: string[] = []
    let inFence = false

    const isHeadingCandidate = (text: string): boolean => {
      const trimmed = text.trim()
      if (trimmed.length < 8 || trimmed.length > 80) return false
      if (/[.!?;:]\s*$/.test(trimmed)) return false
      if (/[-*+]\s+/.test(trimmed)) return false
      if (/^\d+\.\s+/.test(trimmed)) return false
      if (/^>\s+/.test(trimmed)) return false
      if (/^#{1,6}\s/.test(trimmed)) return false
      return /^[A-Z][A-Za-z0-9''()\[\]\/,&\- ]+$/.test(trimmed)
    }

    const boldenLabels = (line: string): string =>
      line.replace(/(^|\n)([A-Z][A-Za-z\- ]{2,40}):\s/g, (_m, p1, p2) => `${p1}**${p2}:** `)

    const promoteInlineHeadings = (line: string): string => {
      const inlineHeadingRe = /([.!?;:])\s*([A-Z][A-Za-z0-9''()\[\]\/,&\-]+(?:\s+[A-Z][A-Za-z0-9''()\[\]\/,&\-]+){2,9})(?=\s|$)/g
      const dashHeadingRe = /(\s[\-–—]\s)\s*([A-Z][A-Za-z0-9''()\[\]\/,&\-]+(?:\s+[A-Z][A-Za-z0-9''()\[\]\/,&\-]+){2,9})(?=\s|$)/g
      const gluedHeadingRe = /([a-z])([A-Z][a-zA-Z]+(?:\s+[A-Z][A-Za-z0-9''()\[\]\/,&\-]+){2,9})(?=\s|$)/g
      let out = line.replace(inlineHeadingRe, (_m, p1, p2) => `${p1}\n\n## ${p2}\n\n`)
      out = out.replace(dashHeadingRe, (_m, _sep, p2) => `\n\n## ${p2}\n\n`)
      out = out.replace(gluedHeadingRe, (_m, prev, title) => `${prev}\n\n## ${title}\n\n`)
      return out
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (/^```/.test(trimmed)) {
        inFence = !inFence
        result.push(line)
        continue
      }

      if (!inFence) {
        const withInlineHeadings = promoteInlineHeadings(line)
        if (withInlineHeadings.includes('\n\n## ')) {
          const chunks = withInlineHeadings.split('\n')
          for (const chunk of chunks) {
            const ctrim = chunk.trim()
            if (ctrim.startsWith('## ')) {
              if (result.length > 0 && result[result.length - 1].trim() !== '') {
                result.push('')
              }
              result.push(ctrim)
            } else if (ctrim.length === 0) {
              result.push(boldenLabels(chunk))
            } else {
              result.push(boldenLabels(chunk))
            }
          }
          continue
        }
        if (isHeadingCandidate(trimmed)) {
          if (result.length > 0 && result[result.length - 1].trim() !== '') {
            result.push('')
          }
          result.push(`## ${trimmed}`)
          continue
        }
        result.push(boldenLabels(line))
        continue
      }

      result.push(line)
    }

    return result.join('\n')
  }

  // sanitizeHtml removed; StreamResponse handles markdown safely

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
            return (
              <div
                key={i}
                className={cn('prose prose-neutral dark:prose-invert')}>
                <StreamResponse className="w-full" parseIncompleteMarkdown>
                  {p.value}
                </StreamResponse>
              </div>
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
                    ? 'Reasoning summary'
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

  // Shared helpers to process streamed chunks
  const processStreamChunk = useCallback((raw: string, assistantIndex: number) => {
    if (!raw) return ''
    const thoughtRegex = /<thinking:([^>]+)>/g

    // Prepend any buffered partial tag from previous chunk
    let text = streamBufferRef.current ? streamBufferRef.current + raw : raw
    streamBufferRef.current = ''

    let clean = text.replace(thoughtRegex, (_m, delta: string) => {
      if (!delta) return ''
      setReasoningByMessageIndex((prev) => ({ ...prev, [assistantIndex]: (prev[assistantIndex] || '') + delta }))
      return ''
    })

    // If a chunk ends with an incomplete `<thinking:` tag (missing closing '>'),
    // buffer it so it doesn't leak to the UI and will be completed by the next chunk.
    const lastThinkingStart = clean.lastIndexOf('<thinking:')
    if (lastThinkingStart !== -1) {
      const tail = clean.slice(lastThinkingStart)
      if (!tail.includes('>')) {
        streamBufferRef.current = tail
        clean = clean.slice(0, lastThinkingStart)
      }
    }

    const idMatch = /<response_id:([^>]+)>/.exec(clean)
    if (idMatch && idMatch[1]) setLastResponseId(idMatch[1])
    return clean
  }, [])

  async function handleSend() {
    const trimmed = input.trim()
    if ((trimmed.length === 0 && files.length === 0) || status === 'submitted' || status === 'streaming') return
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages: ChatMessage[] = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
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
        setSentAttachmentsByMessageIndex((prev) => ({ ...prev, [indexForThisMessage]: attachmentsForPreview }))
      }
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      const inputImages: string[] = await Promise.all(
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
      // Clear input files after capturing previews and data URLs
      setFiles([])
      const stripImageData = (text: string): string => {
        const angleTag = /<image:[^>]+>/gi
        const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
        const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
        return text
          .replace(angleTag, '[image omitted]')
          .replace(bracketDataUrl, '[image omitted]')
          .replace(bareDataUrl, '[image omitted]')
      }
      const payloadMessages = nextMessages.map((m) => ({ ...m, content: stripImageData(m.content) }))
      const ac = new AbortController()
      abortControllerRef.current = ac
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          inputImages,
          inputPdfs,
          previousResponseId: lastResponseId,
          // Forward the UI model selection
          model: selectedModel,
          // Use medium reasoning effort by default
          reasoningEffort: 'medium',
          // Reserve space; adjust as needed for cost control
          max_output_tokens: 30000,
          // Opt-in to reasoning summaries where supported
          includeReasoningSummary: true,
          // Enable encrypted reasoning items for stateless use (server decides include key)
          includeEncryptedReasoning: true,
        }),
        signal: ac.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      // Prepare per-message reasoning index for this assistant reply
      const assistantIndex = nextMessages.length
      currentAssistantIndexRef.current = assistantIndex
      setReasoningByMessageIndex((prev) => ({ ...prev, [assistantIndex]: '' }))

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
      setStatus('streaming')

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const cleanChunk = processStreamChunk(chunk, assistantIndex)
        assistantText += cleanChunk
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
        const cleanFinal = processStreamChunk(finalChunk, assistantIndex)
        assistantText += cleanFinal
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
      setStatus('ready')
      currentAssistantIndexRef.current = null
      abortControllerRef.current = null
      streamBufferRef.current = ''
    }
  }

  const stop = useCallback(() => {
    try {
      abortControllerRef.current?.abort()
    } catch {}
    setStatus('ready')
    streamBufferRef.current = ''
  }, [])

  return (
    <section ref={containerRef} className={cn('w-full h-full flex flex-col', messages.length === 0 && 'justify-center max-w-3xl mx-auto')}>
      <div
        ref={outputRef}
        className={cn('rounded-none pt-1 pb-3 overflow-y-auto text-base font-sans w-full max-w-3xl mx-auto px-3 sm:px-4', messages.length === 0 && 'hidden')}
        style={{ height: outputHeight ? `${outputHeight}px` : undefined }}
      >
        {messages.length === 0 ? null : (
          <div className="w-full">
          {messages.map((m, i) => {
            const isFirst = i === 0
            const speakerChanged = !isFirst && messages[i - 1].role !== m.role
            const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
            const reasoningText = reasoningByMessageIndex[i] || ''
            const hasReasoning = m.role === 'assistant' && reasoningText.trim().length > 0
            return (
              <div key={i} className={`${topMarginClass} mb-0`}>
                <div className={cn('w-full flex items-end gap-1', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'user' ? (
                    <div
                      className={cn(
                        'min-w-0 max-w-[72%] sm:max-w-[60%] break-words rounded-none px-3 py-2 text-base leading-6 shadow-xs',
                        'bg-white text-neutral-900 dark:bg-[#383838] dark:text-white'
                      )}
                    >
                      <div className="min-w-0 w-full">
                        {renderMessageContent(m.role, m.content)}
                        {sentAttachmentsByMessageIndex[i]?.length ? (
                          <MessageAttachmentList attachments={sentAttachmentsByMessageIndex[i]} />
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className={cn('min-w-0 w-full')}>
                      {hasReasoning && (
                        <div className="mt-3 mb-2">
                          <Reasoning className="w-full" isStreaming={status === 'streaming' && i === messages.length - 1}>
                            <ReasoningTrigger />
                            <ReasoningContent>{formatThinkingForMarkdown(reasoningText)}</ReasoningContent>
                          </Reasoning>
                        </div>
                      )}
                      <div className="min-w-0 w-full">
                        {renderMessageContent(m.role, m.content)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        )}
      </div>
      <div
        ref={inputWrapperRef}
        className={cn('max-w-3xl mx-auto w-full px-3 sm:px-4', messages.length === 0 ? '-mt-12 sm:-mt-16 md:-mt-40 lg:-mt-48 mb-0' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+12px)] sm:mb-0')}
        aria-busy={status === 'submitted' || status === 'streaming'}
      >
        {messages.length === 0 ? (
          <div className="text-neutral-600 dark:text-neutral-300 font-medium text-xl sm:text-2xl md:text-3xl text-center mt-0 mb-8 sm:mb-10 md:mb-12 px-3 sm:px-0">
            What's on your mind today?
          </div>
        ) : null}
        <ChatInput
          value={input}
          onValueChange={setInput}
          onSend={handleSend}
          files={files}
          onFileUpload={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          onFileRemove={(file) => setFiles((prev) => prev.filter((f) => f !== file))}
          model={selectedModel}
          onModelChange={setSelectedModel}
          stop={stop}
          status={status}
        />
      </div>
    </section>
  )
}

