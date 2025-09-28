'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { cn, getTimeOfDayWord, stripImageData, extractHttpImageUrls, extractHttpPdfUrls } from './utils'
import { ChatMessage, AttachmentPreview, ChatRequestPayload, ErrorJSON } from './types'
import { ChatInput } from './components/ChatInput'
import { MessageAttachmentList } from './components/FileComponents'
import { renderMessageContent, useMarkdownRenderer } from './components/MessageRenderer'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'

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
  const [modelChoice, setModelChoice] = useState<string>('x-ai/grok-4-fast-reasoning')
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
  const [timeOfDayWord, setTimeOfDayWord] = useState<'today' | 'tonight'>(
    getTimeOfDayWord
  )

  const md = useMarkdownRenderer()
  const suggestionsByCategory: Record<string, string[]> = {
    Research: [
      'Summarize the latest LLM safety paper',
      'Outline a 5-page research proposal on climate policy',
      'Compare transformers and RNNs for sequence tasks',
      'Design an experiment to test a new hypothesis',
      'Create a literature review on retrieval-augmented generation',
      'Explain peer review best practices for reproducibility',
    ],
    Technology: [
      'Biggest AI releases this week',
      'Explain vector databases in simple terms',
      'When should I use server components in Next.js?',
      'What makes a good RAG pipeline?',
      'Compare serverless vs containers for a small API',
      'WebGPU vs WebGL for ML in the browser',
    ],
    Finance: [
      'Summarize today’s market movers',
      'Explain options Greeks in simple terms',
      'DCF valuation steps for a growth company',
      'Compare ETFs vs mutual funds advantages',
      'What is yield curve inversion and why it matters?',
      'Earnings preview for Apple next quarter',
    ],
    History: [
      'Why did the Roman Empire fall?',
      'Main causes and effects of World War II',
      'What sparked the Renaissance?',
      'How did the Silk Road change the world?',
      'Explain causes of the Industrial Revolution',
    ],
    Science: [
      'Explain quantum entanglement simply',
      'What is CRISPR and how does it work?',
      'How do vaccines train the immune system?',
      'Why is the sky blue?',
      'How do black holes evaporate (Hawking radiation)?',
    ],
    Entertainment: [
      'Recommend shows like Succession',
      'Suggest top movies released this year',
      'What are the most streamed songs right now?',
      'Best cozy mystery novels to read next',
      'Recommend anime similar to Attack on Titan',
    ],
    News: [
      "5-bullet summary of today’s top stories",
      "What's the key takeaway from today’s jobs report?",
      'Summarize the latest central bank announcements',
      'Biggest tech headlines today',
      'Major geopolitical updates this week',
    ],
    'Interesting Topics': [
      'Share fun facts about the human brain',
      'What mysteries of the deep ocean are unsolved?',
      'Explain why cats purr',
      'Why do we dream?',
      'How do languages evolve over time?',
      'Could colonizing Mars be realistic this century?',
    ],
  }
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([])

  useEffect(() => {
    // Client-only random selection: guarantee category coverage, then fill to 30 unique
    const pickOne = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
    const selected = new Set<string>()
    const categories = Object.values(suggestionsByCategory)
    // one per category first
    for (const arr of categories) {
      if (arr && arr.length > 0) selected.add(pickOne(arr))
    }
    // fill remainder up to 30 unique
    while (selected.size < 30) {
      const arr = categories[Math.floor(Math.random() * categories.length)]
      if (arr && arr.length > 0) selected.add(pickOne(arr))
    }
    // shuffle
    const list = Array.from(selected)
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = list[i]
      list[i] = list[j]
      list[j] = tmp
    }
    setQuickSuggestions(list.slice(0, 30))
  }, [])

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

  // Broadcast chat state to other components (e.g., navbar)
  useEffect(() => {
    try {
      const hasMessages = messages.length > 0
      window.dispatchEvent(
        new CustomEvent('yurie:chat-state', { detail: { hasMessages } })
      )
    } catch {}
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
      // Collect PDFs (as data URLs)
      const pdfFiles = messageFiles.filter((f) => (f.type || '').toLowerCase() === 'application/pdf')
      const inputPdfsFromFiles: string[] = await Promise.all(
        pdfFiles.map(
          (f) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(String(reader.result))
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(f)
            })
        )
      )
      // Collect audio (as typed objects with base64 and format)
      const audioFiles = messageFiles.filter((f) => (f.type || '').toLowerCase().startsWith('audio/'))
      const inputAudioFromFiles: Array<{ data: string; format: string }> = await Promise.all(
        audioFiles.map(
          (f) =>
            new Promise<{ data: string; format: string }>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const result = String(reader.result || '')
                  // Expect data URL: data:audio/<fmt>;base64,<b64>
                  const m = /^data:audio\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(result)
                  if (m && m[1] && m[2]) {
                    const mimeSub = m[1].toLowerCase()
                    const mimeToFmt: Record<string, string> = {
                      'mpeg': 'mp3',
                      'mp3': 'mp3',
                      'wav': 'wav',
                      'x-wav': 'wav',
                      'webm': 'webm',
                      'ogg': 'ogg',
                      'x-m4a': 'm4a',
                      'aac': 'aac',
                      'mp4': 'mp4',
                      '3gpp': '3gpp',
                      '3gpp2': '3gpp2',
                    }
                    const format = mimeToFmt[mimeSub] || mimeSub
                    resolve({ data: m[2], format })
                    return
                  }
                  reject(new Error('Invalid audio data URL'))
                } catch (e) {
                  reject(e instanceof Error ? e : new Error('Audio processing failed'))
                }
              }
              reader.onerror = () => reject(reader.error)
              reader.readAsDataURL(f)
            })
        )
      )
      // Extract http(s) image URLs from the prompt text (jpg/jpeg/png only)
      const httpImageUrls = extractHttpImageUrls(trimmed)
      // Extract http(s) PDF URLs from the prompt text
      const httpPdfUrls = extractHttpPdfUrls(trimmed)

      // Also extract any inline image tags from the user's text (e.g., <image:...>, <image_partial:...>, or [data:image...])
      const extractInlineImageUrls = (s: string): string[] => {
        try {
          const out: string[] = []
          const angle = /<(?:image|image_partial):([^>]+)>/gi
          let m: RegExpExecArray | null
          while ((m = angle.exec(s)) !== null) {
            const url = (m[1] || '').trim()
            if (url) out.push(url)
          }
          const bracket = /\[(data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+)\]/gi
          let mb: RegExpExecArray | null
          while ((mb = bracket.exec(s)) !== null) {
            const url = (mb[1] || '').trim()
            if (url) out.push(url)
          }
          return out
        } catch {
          return []
        }
      }
      const inlineImageUrlsFromUserText = extractInlineImageUrls(trimmed)

      // If the user is likely referencing/editing the last generated image but didn't paste it,
      // pull final images from the most recent assistant message.
      const lastAssistantImages = (() => {
        try {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            if (msg.role !== 'assistant') continue
            return extractInlineImageUrls(msg.content || '')
          }
        } catch {}
        return [] as string[]
      })()
      let inputImages: string[] = Array.from(
        new Set([
          ...(inputImagesFromFiles || []),
          ...(httpImageUrls || []),
          ...(inlineImageUrlsFromUserText || []),
        ])
      )
      const inputPdfs: string[] = Array.from(new Set([...(inputPdfsFromFiles || []), ...(httpPdfUrls || [])]))

      // Heuristic: if none were explicitly included in the user's text but they likely want to "edit" the last image,
      // include latest assistant images (limit to first 2 to avoid overlong payloads).
      try {
        const likelyEditing = /\b(edit|modify|change|update)\b.*\b(image|photo|picture)\b/i.test(trimmed)
        if (inputImages.length === 0 && likelyEditing && lastAssistantImages.length > 0) {
          inputImages = Array.from(new Set([...(lastAssistantImages.slice(0, 2))]))
        }
      } catch {}
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
      // Also enable reasoning for OpenRouter models (unified reasoning parameter per OpenRouter docs)
      const isOpenRouterModel = /^openrouter\//i.test(modelChoice)

      const body: ChatRequestPayload = {
        messages: payloadMessages,
        inputImages,
        inputPdfs,
        inputAudio: inputAudioFromFiles,
        previousResponseId: lastResponseId,
        model: modelChoice,
      }
      if (supportsReasoningEffort || isOpenRouterModel) {
        body.reasoning = { effort: 'high' }
      }
      // xAI Live Search: wire Globe toggle (disabled for Sonar Deep Research)
      try {
        const lowerModel = String(modelChoice || '').toLowerCase()
        const supportsWebToggle = lowerModel !== 'openrouter/perplexity/sonar-deep-research'
        if (supportsWebToggle) {
          body.search_parameters = useWebSearch
            ? { mode: 'on', return_citations: true }
            : { mode: 'off' }
        }
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

  const handleNewChat = useCallback(() => {
    // Clear chat transcript and any pending attachments
    setMessages([])
    setFiles([])
    setSentAttachmentsByMessageIndex({})
    setLastResponseId(null)
    // Revoke any created object URLs for message attachment previews
    try {
      const urls = createdObjectUrlsRef.current
      if (Array.isArray(urls) && urls.length > 0) {
        for (const u of urls) URL.revokeObjectURL(u)
      }
    } catch {}
    createdObjectUrlsRef.current = []
    setIsLoading(false)
    setStatus('ready')
  }, [])

  // Listen for global new chat event dispatched from the navbar
  useEffect(() => {
    const handler = () => {
      handleNewChat()
      try {
        containerRef.current?.scrollTo({ top: 0 })
      } catch {}
    }
    try {
      window.addEventListener('yurie:new-chat', handler as EventListener)
    } catch {}
    return () => {
      try {
        window.removeEventListener('yurie:new-chat', handler as EventListener)
      } catch {}
    }
  }, [handleNewChat])

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
  // Keep last measured values to avoid tiny oscillations causing layout shifts
  const inputWrapperHeightRef = useRef<number>(0)
  const inputWrapperTopRef = useRef<number>(0)

  useEffect(() => {
    if (isEmpty) return
    const compute = () => {
      try {
        const wrap = inputWrapperRef.current
        if (!wrap) return
        const rect = wrap.getBoundingClientRect()
        const height = Math.ceil(rect.height)
        const top = Math.max(0, Math.floor(rect.top))
        const prevHeight = inputWrapperHeightRef.current
        const prevTop = inputWrapperTopRef.current
        // Only update when changes are meaningful to prevent micro reflows
        const heightChanged = Math.abs(height - prevHeight) >= 6
        const topChanged = Math.abs(top - prevTop) >= 2

        if (heightChanged) {
          // Keep modest breathing room so expanded UI is visible without excessive gap
          setOutputBottomPad(Math.max(96, height + 24))
          inputWrapperHeightRef.current = height
        }
        if (topChanged) {
          setInputOverlayTop(top)
          inputWrapperTopRef.current = top
        }
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
        'flex w-full flex-col px-3 sm:px-4 min-h-[80vh]',
        isEmpty && 'justify-center'
      )}
    >
      <div
        ref={outputRef}
        className={cn(
          'chat-scroll overflow-y-auto overscroll-contain touch-pan-y rounded pt-1 font-sans text-base flex-1 min-h-0 pb-[calc(env(safe-area-inset-bottom)+96px)] sm:pb-24',
          messages.length === 0 && 'hidden'
        )}
        style={
          isEmpty
            ? undefined
            : { paddingBottom: outputBottomPad, overflowAnchor: 'none' as any }
        }
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
            : 'relative fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom))] sm:bottom-0 z-20 mx-auto max-w-3xl px-3 sm:px-4 chat-input-wrapper-contain'
        )}
        aria-busy={isLoading}
        style={{ overflowAnchor: 'none' as any }}
      >
        {!isEmpty ? (
          <div
            aria-hidden
            className="pointer-events-none fixed left-0 right-0 bottom-0 z-10 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/98 to-transparent"
            style={{
              top: Math.max(0, inputOverlayTop - 24),
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
            <div className="mt-0 mb-8 text-center text-2xl font-medium text-black sm:mb-10 sm:text-3xl dark:text-white">
              {`What's on your mind ${timeOfDayWord}?`}
            </div>
          </>
        ) : null}
        <div className="mb-3 sm:mb-4">
          <Suggestions>
            {quickSuggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={(s) => handleSubmitWithMessage(s, [])}
              />
            ))}
          </Suggestions>
        </div>
        <ChatInput
          onSubmitWithMessage={handleSubmitWithMessage}
          onNewChat={handleNewChat}
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
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
        />
      </div>
    </section>
  )
}