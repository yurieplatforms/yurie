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
import { GetStarted, GetStartedItem } from '@/components/ai-elements/get-started'
import { Newspaper, ScrollText, ScanText, Palette, X } from 'lucide-react'

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
  const [sentContextByMessageIndex, setSentContextByMessageIndex] =
    useState<Record<number, { id: string; type: 'blog' | 'research'; slug: string; title: string; image?: string }[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)
  const [modelChoice, setModelChoice] = useState<string>('x-ai/grok-4-fast-reasoning')
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
  const [timeOfDayWord, setTimeOfDayWord] = useState<'today' | 'tonight'>(
    getTimeOfDayWord
  )
  const [contextIds, setContextIds] = useState<string[]>([])

  const md = useMarkdownRenderer()
  const getStartedItems = [
    {
      label: 'Latest tech news',
      icon: <Newspaper className="size-5" />,
      prompt: 'Latest tech news',
    },
    {
      label: 'Write a creative story',
      icon: <ScrollText className="size-5" />,
      prompt: 'Write a creative story.',
    },
    {
      label: 'Analyze PDFs or images',
      icon: <ScanText className="size-5" />,
      prompt: 'Analyze the attached PDF or image and summarize key insights with action items.',
    },
    {
      label: 'Create an image',
      icon: <Palette className="size-5" />,
      prompt: 'Create an image of dinosaurs and a comet.',
    },
  ] as const
  const suggestionsByCategory: Record<string, string[]> = {
    Technology: [
      'What are the biggest AI breakthroughs happening right now?',
      'Explain quantum computing like I\'m 10',
      'How does blockchain actually work under the hood?',
      'Compare Rust vs Go for building fast APIs',
      'What makes a neural network "understand" images?',
      'Will we have AGI by 2030? What are the arguments?',
      'How do edge computing and 5G work together?',
      'Explain the tech behind self-driving cars',
    ],
    Finance: [
      'What caused the 2008 financial crisis in simple terms?',
      'How do hedge funds make money in bear markets?',
      'Explain the difference between value and growth investing',
      'Why do interest rates affect stock prices?',
      'What is a credit default swap and why does it matter?',
      'How does Warren Buffett pick stocks?',
      'Explain cryptocurrency staking like I\'m new to crypto',
      'What are the best passive income strategies?',
    ],
    History: [
      'What were the greatest unsolved mysteries of ancient Egypt?',
      'How did the Vikings discover America before Columbus?',
      'What really happened during the Library of Alexandria fire?',
      'Explain the fall of Constantinople in 1453',
      'How did the Manhattan Project stay secret?',
      'What sparked the French Revolution?',
      'Why did the Mayan civilization collapse?',
      'How did code-breaking change World War II?',
    ],
    'Sci-Fi & Mystery': [
      'What are the most mind-bending sci-fi concepts in physics?',
      'Could we ever build a Dyson Sphere?',
      'Explain the Fermi Paradox—where are all the aliens?',
      'What are the creepiest unsolved mysteries in history?',
      'Could time travel create paradoxes or parallel universes?',
      'What is the simulation hypothesis and is it plausible?',
      'Explain the dark forest theory of the universe',
      'What mysteries surround the Voynich Manuscript?',
    ],
    Science: [
      'How close are we to curing cancer?',
      'Explain gene editing—can we design perfect humans?',
      'What happens inside a black hole?',
      'Could we terraform Mars in our lifetime?',
      'How does consciousness emerge from neurons?',
      'What is dark matter and why can\'t we see it?',
      'Explain the double-slit experiment and quantum weirdness',
      'How do scientists measure the age of the universe?',
    ],
    Entertainment: [
      'Recommend must-watch sci-fi shows with great plot twists',
      'Best thriller movies with shocking endings',
      'Suggest books like Dune or Foundation',
      'What are the most underrated films of all time?',
      'Recommend mystery novels with unreliable narrators',
      'Best podcasts for learning about history and science',
      'Suggest video games with incredible storytelling',
      'What are the greatest plot twists in TV history?',
    ],
    Research: [
      'What are the latest discoveries in neuroscience?',
      'Summarize recent breakthroughs in fusion energy',
      'How are AI models being used in drug discovery?',
      'What is the current state of longevity research?',
      'Explain recent advances in quantum entanglement',
      'What are scientists learning about exoplanets?',
      'How is CRISPR evolving beyond gene editing?',
      'What\'s new in climate science and carbon capture?',
    ],
    'Fun Facts & Trivia': [
      'What are the strangest laws that still exist today?',
      'Share mind-blowing facts about space and the cosmos',
      'What are the most bizarre animal behaviors?',
      'Explain the weirdest coincidences in history',
      'What are some psychological tricks that always work?',
      'Share fascinating facts about the human body',
      'What are the most ingenious ancient inventions?',
      'Tell me about the strangest discoveries underwater',
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

  const handleSubmitWithMessage = useCallback(async (text: string, messageFiles: File[], options?: { forceWebSearch?: boolean; overrideModel?: string }) => {
    const trimmed = text.trim()
    if (isLoading) return
    if (trimmed.length === 0 && messageFiles.length === 0 && contextIds.length === 0) return
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
      const indexForThisMessage = nextMessages.length - 1
      if (attachmentsForPreview.length > 0) {
        setSentAttachmentsByMessageIndex((prev) => ({
          ...prev,
          [indexForThisMessage]: attachmentsForPreview,
        }))
      }
      // Snapshot current context IDs so we can clear state immediately after
      const contextIdsSnapshot = Array.isArray(contextIds) ? contextIds.slice() : []
      if (contextIdsSnapshot.length > 0) {
        const parse = (id: string): { id: string; type: 'blog' | 'research' | null; slug: string | null } => {
          try {
            const [type, slug] = id.split(':')
            const t = (type || '').toLowerCase()
            if ((t === 'blog' || t === 'research') && slug) return { id, type: t as any, slug }
          } catch {}
          return { id, type: null, slug: null }
        }
        const prelim = contextIdsSnapshot.map((id) => {
          const p = parse(id)
          const label = p.type && p.slug ? `${p.type}/${p.slug}` : id
          return { id, type: (p.type || 'blog') as 'blog' | 'research', slug: (p.slug || id) as string, title: label }
        })
        setSentContextByMessageIndex((prev) => ({
          ...prev,
          [indexForThisMessage]: prelim,
        }))
        // Fetch titles and images to improve labels (non-blocking)
        Promise.all(
          prelim.map(async (p) => {
            try {
              const res = await fetch(`/api/posts?type=${p.type}&slug=${p.slug}`)
              if (!res.ok) return p
              const json = await res.json()
              const title = json?.post?.title
              const image = json?.post?.image
              if (typeof title === 'string' && title.trim()) {
                return { ...p, title: `${title} — ${p.type}`, image }
              }
              return { ...p, image }
            } catch {
              return p
            }
          })
        ).then((resolved) => {
          setSentContextByMessageIndex((prev) => ({ ...prev, [indexForThisMessage]: resolved }))
        }).catch(() => {})
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
      // Allow per-call model override for special actions (e.g., image generation card)
      const modelToUse = options?.overrideModel ?? modelChoice
      // Only include reasoning for models that support reasoning_effort (grok-3-mini, grok-3-mini-fast)
      const supportsReasoningEffort = /grok-3-mini(\b|\-|_)/i.test(modelToUse) || /grok-3-mini-fast/i.test(modelToUse)
      // Also enable reasoning for OpenRouter models (unified reasoning parameter per OpenRouter docs)
      const isOpenRouterModel = /^openrouter\//i.test(modelToUse)

      const body: ChatRequestPayload = {
        messages: payloadMessages,
        inputImages,
        inputPdfs,
        inputAudio: inputAudioFromFiles,
        previousResponseId: lastResponseId,
        model: modelToUse,
      }
      // Convert selected context IDs (e.g., "blog:slug") to structured payload
      try {
        if (Array.isArray(contextIdsSnapshot) && contextIdsSnapshot.length > 0) {
          const parsed = contextIdsSnapshot
            .map((id) => {
              const [type, slug] = id.split(':')
              const t = (type || '').toLowerCase()
              if ((t === 'blog' || t === 'research') && slug) {
                return { type: t as 'blog' | 'research', slug }
              }
              return null
            })
            .filter(Boolean) as Array<{ type: 'blog' | 'research'; slug: string }>
          if (parsed.length > 0) {
            body.context_ids = parsed
          }
        }
      } catch {}
      if (supportsReasoningEffort || isOpenRouterModel) {
        body.reasoning = { effort: 'high' }
      }
      // xAI Live Search: wire toggle (disabled for Sonar Deep Research)
      try {
        const lowerModel = String(modelToUse || '').toLowerCase()
        const supportsWebToggle = lowerModel !== 'openrouter/perplexity/sonar-deep-research'
        if (supportsWebToggle) {
          const enableSearch = options?.forceWebSearch ? true : useWebSearch
          body.search_parameters = enableSearch
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
      // Clear selected context once sent
      setContextIds([])
    }
  }, [messages, isLoading, modelChoice, useWebSearch, lastResponseId, contextIds])

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
    setSentContextByMessageIndex({})
    setContextIds([])
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
  const [showGetStarted, setShowGetStarted] = useState<boolean>(true)
  const dismissGetStarted = () => {
    setShowGetStarted(false)
  }
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
                        const contextChips = sentContextByMessageIndex[i] || []
                        const hasText = (m.content || '').trim().length > 0
                        const hasAttachments = attachments.length > 0
                        const hasContext = contextChips.length > 0
                        const contextOnly = !hasText && !hasAttachments && hasContext
                        const attachmentsOnly = !hasText && hasAttachments && !hasContext
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
                        if (contextOnly) {
                          return (
                            <div
                              className={cn(
                                'chat-bubble',
                                'user',
                                'compact',
                                'inline-flex'
                              )}
                            >
                              <div className="flex flex-wrap gap-2">
                                {contextChips.map((c) => (
                                  <span key={c.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-[#807d78] bg-[var(--color-chat-input)] border-[var(--color-chat-input-border)] ${c.image ? 'pl-1' : ''}`}>
                                    {c.image && (
                                      <img
                                        src={c.image}
                                        alt=""
                                        className="size-5 rounded-full object-cover flex-shrink-0"
                                      />
                                    )}
                                    @{c.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div className={cn('chat-bubble', 'user', 'min-w-0')}>
                            <div className="w-full min-w-0">
                              {renderMessageContent(m.role, m.content, status, md)}
                              {hasContext ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {contextChips.map((c) => (
                                    <span key={c.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs text-[#807d78] bg-[var(--color-chat-input)] border-[var(--color-chat-input-border)] ${c.image ? 'pl-1' : ''}`}>
                                      {c.image && (
                                        <img
                                          src={c.image}
                                          alt=""
                                          className="size-5 rounded-full object-cover flex-shrink-0"
                                        />
                                      )}
                                      @{c.title}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
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
          selectedContextIds={contextIds}
          onContextChange={setContextIds}
        />
        {isEmpty && showGetStarted ? (
          <div className="mt-3 sm:mt-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[13px] font-medium text-[#807d78]">Get started</div>
              <button
                type="button"
                onClick={dismissGetStarted}
                className="inline-flex items-center justify-center rounded-full p-1 text-[#807d78] hover:bg-[var(--color-suggestion)] cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
            <GetStarted>
              {getStartedItems.map((it) => (
                <GetStartedItem
                  key={it.label}
                  label={it.label}
                  icon={it.icon}
                  onClick={() => {
                    if (it.label === 'Analyze PDFs or images') {
                      try {
                        window.dispatchEvent(new Event('yurie:attachments:open'))
                      } catch {}
                    } else if (it.label === 'Latest tech news') {
                      handleSubmitWithMessage(it.prompt, [], { forceWebSearch: true })
                    } else if (it.label === 'Create an image') {
                      handleSubmitWithMessage(it.prompt, [], { overrideModel: 'openrouter/google/gemini-2.5-flash-image-preview' })
                    } else {
                      handleSubmitWithMessage(it.prompt, [])
                    }
                  }}
                />
              ))}
            </GetStarted>
          </div>
        ) : null}
      </div>
    </section>
  )
}