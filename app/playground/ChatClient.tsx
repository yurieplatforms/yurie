'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cn, getTimeOfDayWord, stripImageData, extractHttpImageUrls } from './utils'
import { ChatMessage, AttachmentPreview, ChatRequestPayload, ErrorJSON } from './types'
import { ChatInput } from './components/ChatInput'
import { MessageAttachmentList } from './components/FileComponents'
import { renderMessageContent, useMarkdownRenderer } from './components/MessageRenderer'

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
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
  // Model is fixed to grok-4-fast-reasoning per requirements
  const modelChoice = 'x-ai/grok-4-fast-reasoning'
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
  const [timeOfDayWord, setTimeOfDayWord] = useState<'today' | 'tonight'>(
    getTimeOfDayWord
  )

  const md = useMarkdownRenderer()

  useEffect(() => {
    const compute = () => {
      setTimeOfDayWord(getTimeOfDayWord())
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

  const handleSubmitWithMessage = useCallback(async (text: string, messageFiles: File[]) => {
    const trimmed = text.trim()
    if (isLoading) return
    if (trimmed.length === 0 && messageFiles.length === 0) return
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages: ChatMessage[] = [...messages, userMsg]
    setMessages(nextMessages)
    setIsLoading(true)
    setStatus('submitted')

    try {
      // Capture current files as message attachments for preview in the chat container
      const attachmentsForPreview: AttachmentPreview[] = messageFiles.map((f) => {
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
      const imageFiles = messageFiles.filter((f) => f.type.startsWith('image/'))
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
      const httpImageUrls = extractHttpImageUrls(trimmed)
      const inputImages: string[] = Array.from(
        new Set([...(inputImagesFromFiles || []), ...(httpImageUrls || [])])
      )
      // Clear input files after capturing previews and data URLs
      setFiles([])

      const payloadMessages = nextMessages.map((m) => ({
        ...m,
        content: stripImageData(m.content),
      }))
      const ac = new AbortController()
      abortControllerRef.current = ac
      // Only include reasoning for models that support reasoning_effort (grok-3-mini, grok-3-mini-fast)
      const supportsReasoningEffort = /grok-3-mini(\b|\-|_)/i.test(modelChoice) || /grok-3-mini-fast/i.test(modelChoice)

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
  }, [messages, isLoading, modelChoice, useWebSearch, lastResponseId])

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
    // Also recompute when the chat output scrolls (mobile uses an inner scroll container)
    const scrollContainer = outputRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', compute, { passive: true } as AddEventListenerOptions)
    }
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
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', compute)
      }
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
          'chat-scroll overflow-y-auto overscroll-contain rounded pt-1 font-sans text-base flex-1 min-h-0 pb-[calc(env(safe-area-inset-bottom)+96px)] sm:pb-24',
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
                              {renderMessageContent(m.role, m.content, status, md)}
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
                          {renderMessageContent(m.role, m.content, status, md)}
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
            : 'relative fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom))] sm:bottom-0 z-20 mx-auto max-w-3xl px-3 sm:px-4 transform-gpu will-change-transform'
        )}
        aria-busy={isLoading}
      >
        {!isEmpty ? (
          <div
            aria-hidden
            className="pointer-events-none fixed left-0 right-0 bottom-0 z-10 bg-[var(--color-background)]"
            style={{
              top: Math.max(0, inputOverlayTop - 32),
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
          onSubmitWithMessage={handleSubmitWithMessage}
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
          useWebSearch={useWebSearch}
          onUseWebSearchToggle={() => setUseWebSearch((v) => !v)}
        />
      </div>
    </section>
  )
}