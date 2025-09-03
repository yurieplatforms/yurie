"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useId, createContext, useContext } from 'react'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'
import { ArrowUp, Stop, Paperclip, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
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
            <div className="text-center text-xs text-gray-400">{file.name.split('.').pop()?.toUpperCase()}</div>
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
                {status === 'streaming' || status === 'submitted' ? <Stop className="size-4" weight="bold" aria-hidden="true" /> : <ArrowUp className="size-4" weight="bold" aria-hidden="true" />}
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
  const [thinkingOpen, setThinkingOpen] = useState<boolean>(false)
  const [thinkingText, setThinkingText] = useState<string>('')
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready')
  const abortControllerRef = useRef<AbortController | null>(null)

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
      if (/^[-*+]\s+/.test(trimmed)) return false
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
              result.push('')
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

    let labelInjected = false

    const latestPartialIndex = (() => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        if ((p as any).type === 'image' && (p as any).partial) return i
      }
      return -1
    })()
    const hasFinalImage = parts.some((p) => (p as any).type === 'image' && !(p as any).partial)
    const speaker = role === 'user' ? 'You' : 'Yurie'
    return (
      <>
        {parts.map((p, i) => {
          if (p.type === 'text') {
            const rawHtml = md.parse(p.value) as string
            const isParagraph = /^\s*<p[>\s]/.test(rawHtml)
            if (!labelInjected) {
              labelInjected = true
              if (isParagraph) {
                const withLabel = rawHtml.replace(
                  /<p(.*?)>/,
                  `<p$1><span class="font-bold mr-1">${speaker}:</span>`
                )
                return (
                  <div
                    key={i}
                    className="prose-message font-sans"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(withLabel) }}
                  />
                )
              }
              return (
                <div key={`block-${i}`} className="prose-message font-sans">
                  <div className="chat-label font-bold mb-1">{speaker}:</div>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }} />
                </div>
              )
            }
            return (
              <div
                key={i}
                className="prose-message font-sans"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }}
              />
            )
          }
          if (p.type === 'image') {
            if (!labelInjected) {
              labelInjected = true
              return (
                <div key={i} className="prose-message dark:prose-invert font-sans">
                  <span className="font-bold mr-1">{speaker}:</span>
                  <img
                    src={p.src}
                    alt="Generated image"
                    className="mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full"
                  />
                </div>
              )
            }
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
                className="mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full"
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
      setThinkingText('')
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
          if (delta) setThinkingText((prev) => prev + delta)
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
          outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
        })
      }

      const finalChunk = decoder.decode()
      if (finalChunk) {
        const thoughtRegex = /<thinking:([^>]+)>/g
        let cleanFinal = finalChunk
        let tm: RegExpExecArray | null
        while ((tm = thoughtRegex.exec(finalChunk)) !== null) {
          const delta = tm[1]
          if (delta) setThinkingText((prev) => prev + delta)
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
    <section ref={containerRef} className="w-full">
      <div
        ref={outputRef}
        className="rounded pt-2 pb-3 overflow-y-auto text-base font-sans"
        style={{ height: outputHeight ? `${outputHeight}px` : undefined }}
      >
        {messages.length === 0 ? null : (
          messages.map((m, i) => {
            const isFirst = i === 0
            const speakerChanged = !isFirst && messages[i - 1].role !== m.role
            const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
            const isLastAssistant = i === messages.length - 1 && m.role === 'assistant'
            return (
              <div key={i} className={`${topMarginClass} mb-0`}>
                {thinkingText && isLastAssistant && (
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => setThinkingOpen((v) => !v)}
                      className="text-xs text-neutral-600 dark:text-neutral-300 underline"
                    >
                      {thinkingOpen ? 'Hide thinking' : 'Show thinking'}
                    </button>
                    {thinkingOpen && (
                      <div className="mt-1 max-h-40 overflow-auto rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2">
                        <div
                          className="prose-message prose-thinking font-sans text-xs leading-5"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(md.parse(formatThinkingForMarkdown(thinkingText)) as string) }}
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="min-w-0 w-full">
                  {renderMessageContent(m.role, m.content)}
                </div>
              </div>
            )
          })
        )}
      </div>
      <div ref={inputWrapperRef} className="mt-2 mb-[calc(env(safe-area-inset-bottom)+12px)] sm:mb-0" aria-busy={isLoading}>
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