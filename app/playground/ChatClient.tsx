"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useId, createContext, useContext } from 'react'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'
import { ArrowUp, Stop, Paperclip, X, FilePdf, Brain, CaretDown } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
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
      <div className={cn('bg-white dark:bg-black rounded-3xl border border-neutral-200 dark:border-neutral-800 p-2 shadow-xs', className)}>
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
            className="rounded border border-neutral-200 dark:border-neutral-800 max-h-56 object-cover"
          />
        ) : (
          <a
            key={att.id}
            href={att.objectUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-white dark:bg-black hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-3 py-2 text-xs inline-flex items-center gap-2"
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
      <div className="bg-white dark:bg-black hover:bg-neutral-50 dark:hover:bg-neutral-900 border-neutral-200 dark:border-neutral-800 flex w-full items-center gap-3 rounded-2xl border p-2 pr-3 transition-colors">
        <div className="bg-neutral-200 dark:bg-neutral-700 flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
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
          className="absolute top-1 right-1 z-10 inline-flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-black dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900 shadow-none transition-colors"
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
        className="size-9 inline-flex items-center justify-center p-0 leading-none rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black cursor-pointer"
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
}
function ChatInput({ value, onValueChange, onSend, isSubmitting, files, onFileUpload, onFileRemove, stop, status }: ChatInputProps) {
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)

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

  return (
    <div className="relative flex w-full flex-col gap-4">
      <div className="relative order-2 pb-3 sm:pb-4 md:order-1">
        <PromptInput className="relative z-10 w-full p-0 pt-1 shadow-xs" maxHeight={200} value={value} onValueChange={onValueChange}>
          <FileList files={files} onFileRemove={onFileRemove} />
          <PromptInputTextarea
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask anything"
            className="min-h-[44px] pt-3 px-4 text-base leading-[1.3] sm:text-base md:text-base"
          />
          <PromptInputActions className="mt-3 w-full justify-between p-2">
            <div className="flex flex-wrap gap-2">
              <ButtonFileUpload onFileUpload={onFileUpload} />
            </div>
            <PromptInputAction tooltip={status === 'streaming' || status === 'submitted' ? 'Stop' : 'Send'}>
              <button
                className="size-9 inline-flex items-center justify-center p-0 leading-none rounded-full transition-all duration-300 ease-out border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-black dark:text-white"
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
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
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
  const [reasoningByMessageIndex, setReasoningByMessageIndex] = useState<Record<number, string>>({})
  const [reasoningOpenByIndex, setReasoningOpenByIndex] = useState<Record<number, boolean>>({})
  const currentAssistantIndexRef = useRef<number | null>(null)
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [sentAttachmentsByMessageIndex, setSentAttachmentsByMessageIndex] = useState<Record<number, AttachmentPreview[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)

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
      return /^[A-Z][A-Za-z0-9'’()\[\]\/,&\- ]+$/.test(trimmed)
    }

    const boldenLabels = (line: string): string =>
      line.replace(/(^|\n)([A-Z][A-Za-z\- ]{2,40}):\s/g, (_m, p1, p2) => `${p1}**${p2}:** `)

    const promoteInlineHeadings = (line: string): string => {
      const inlineHeadingRe = /([.!?;:])\s*([A-Z][A-Za-z0-9'’()\[\]\/,&\-]+(?:\s+[A-Z][A-Za-z0-9'’()\[\]\/,&\-]+){2,9})(?=\s|$)/g
      const dashHeadingRe = /(\s[\-–—]\s)\s*([A-Z][A-Za-z0-9'’()\[\]\/,&\-]+(?:\s+[A-Z][A-Za-z0-9'’()\[\]\/,&\-]+){2,9})(?=\s|$)/g
      const gluedHeadingRe = /([a-z])([A-Z][a-zA-Z]+(?:\s+[A-Z][A-Za-z0-9'’()\[\]\/,&\-]+){2,9})(?=\s|$)/g
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
                className="prose prose-neutral dark:prose-invert"
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

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
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
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          inputImages,
          inputPdfs,
          previousResponseId: lastResponseId,
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
        const thoughtRegex = /<thinking:([^>]+)>/g
        let cleanChunk = chunk
        let tm: RegExpExecArray | null
        while ((tm = thoughtRegex.exec(chunk)) !== null) {
          const delta = tm[1]
          if (delta && currentAssistantIndexRef.current !== null) {
            const idx = currentAssistantIndexRef.current
            setReasoningByMessageIndex((prev) => ({ ...prev, [idx!]: (prev[idx!] || '') + delta }))
          }
        }
        cleanChunk = cleanChunk.replace(thoughtRegex, '')
        assistantText += cleanChunk
        const idMatch = /<response_id:([^>]+)>/g.exec(cleanChunk)
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
        const thoughtRegex = /<thinking:([^>]+)>/g
        let cleanFinal = finalChunk
        let tm: RegExpExecArray | null
        while ((tm = thoughtRegex.exec(finalChunk)) !== null) {
          const delta = tm[1]
          if (delta && currentAssistantIndexRef.current !== null) {
            const idx = currentAssistantIndexRef.current
            setReasoningByMessageIndex((prev) => ({ ...prev, [idx!]: (prev[idx!] || '') + delta }))
          }
        }
        cleanFinal = cleanFinal.replace(thoughtRegex, '')
        assistantText += cleanFinal
        const idMatch = /<response_id:([^>]+)>/g.exec(cleanFinal)
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
      currentAssistantIndexRef.current = null
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
    <section ref={containerRef} className={cn('w-full flex flex-col px-3 sm:px-4', messages.length === 0 && 'justify-center min-h-[60vh]')}>
      <div
        ref={outputRef}
        className={cn('rounded pt-2 pb-3 overflow-y-auto text-base font-sans chat-scroll', messages.length === 0 && 'hidden')}
        style={{ height: outputHeight ? `${outputHeight}px` : undefined }}
      >
        {messages.length === 0 ? null : (
          messages.map((m, i) => {
            const isFirst = i === 0
            const speakerChanged = !isFirst && messages[i - 1].role !== m.role
            const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
            const reasoningText = reasoningByMessageIndex[i] || ''
            const hasReasoning = m.role === 'assistant' && reasoningText.trim().length > 0
            const isOpen = reasoningOpenByIndex[i] === true
            return (
              <div key={i} className={`${topMarginClass} mb-0`}>
                <div className={cn('chat-row', m.role === 'user' ? 'user' : 'assistant')}>
                  <div className={cn('chat-bubble', m.role === 'user' ? 'user' : 'assistant', 'min-w-0')}>
                    {hasReasoning && (
                      <div className="mt-3 mb-2">
                        <button
                          type="button"
                          onClick={() => setReasoningOpenByIndex((prev) => ({ ...prev, [i]: !prev[i] }))}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800',
                            'bg-white/70 dark:bg-black/70 backdrop-blur px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300',
                            'hover:bg-white dark:hover:bg-black transition-colors'
                          )}
                          aria-expanded={isOpen}
                          aria-controls={`thinking-panel-${i}`}
                        >
                          <Brain className="size-3.5 text-[#7f91e0]" weight="fill" aria-hidden="true" />
                          <span className="font-medium">{isOpen ? 'Hide reasoning' : 'Show reasoning'}</span>
                          <CaretDown className={cn('size-3 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              id={`thinking-panel-${i}`}
                              key={`thinking-panel-${i}`}
                              initial={{ height: 0, opacity: 0, y: -2 }}
                              animate={{ height: 'auto', opacity: 1, y: 0 }}
                              exit={{ height: 0, opacity: 0, y: -2 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 max-h-64 overflow-auto thinking-scroll rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 shadow-xs">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
                                  <span className="inline-flex size-1.5 rounded-full" style={{ backgroundColor: '#7f91e0' }} />
                                  <span>Reasoning</span>
                                </div>
                                <div
                                  className="prose-message prose-thinking font-sans text-[13px] leading-5"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(md.parse(formatThinkingForMarkdown(reasoningText)) as string) }}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    <div className="min-w-0 w-full">
                      {renderMessageContent(m.role, m.content)}
                      {m.role === 'user' && sentAttachmentsByMessageIndex[i]?.length ? (
                        <MessageAttachmentList attachments={sentAttachmentsByMessageIndex[i]} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
      <div
        ref={inputWrapperRef}
        className={cn(messages.length === 0 ? 'mt-0 mb-0' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+12px)] sm:mb-0')}
        aria-busy={isLoading}
      >
        {messages.length === 0 ? (
          <div className="text-neutral-600 dark:text-neutral-300 font-medium text-2xl sm:text-3xl text-center mt-3 sm:mt-4 mb-10 sm:mb-12">
            What's on your mind today?
          </div>
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
        />
      </div>
    </section>
  )
}