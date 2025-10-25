"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { Response as StreamResponse } from './ui/response'
import { Reasoning, ReasoningContent, ReasoningTrigger } from './ui/reasoning'
import { AIChatInput } from './ui/ai-chat-input'
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

// ============ Sub-Components ============

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
          <div
            key={att.id}
            className="flex items-center gap-2 px-2 py-1 rounded-xl bg-neutral-100 dark:bg-[#3A3A40] text-xs text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-transparent"
          >
            <FileText className="w-4 h-4" />
            <span className="max-w-[12rem] truncate">{att.name}</span>
          </div>
        )
      ))}
    </div>
  )
}

// ============ Main Component ============

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const outputRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputWrapperRef = useRef<HTMLDivElement>(null)
  const [outputHeight, setOutputHeight] = useState<number>(0)
  // local input state moves inside AIChatInput
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [reasoningByMessageIndex, setReasoningByMessageIndex] = useState<Record<number, string>>({})
  const [status, setStatus] = useState<'submitted' | 'streaming' | 'ready' | 'error'>('ready')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [sentAttachmentsByMessageIndex, setSentAttachmentsByMessageIndex] = useState<Record<number, AttachmentPreview[]>>({})
  const createdObjectUrlsRef = useRef<string[]>([])
  const pinnedToBottomRef = useRef<boolean>(true)
  
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
        const mb = inputEl ? parseFloat(getComputedStyle(inputEl).marginBottom || '0') : 0
        const available = Math.max(0, viewportHeight - containerTop - inputHeight - mt - mb)
        setOutputHeight(Math.floor(available))
      } catch {}
    }
    recompute()
    const ro = inputWrapperRef.current ? new ResizeObserver(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(recompute)
    }) : null
    if (ro && inputWrapperRef.current) ro.observe(inputWrapperRef.current)
    
    // Also observe all children for size changes
    const childObserver = new MutationObserver(() => {
      requestAnimationFrame(recompute)
    })
    if (inputWrapperRef.current) {
      childObserver.observe(inputWrapperRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      })
    }
    
    window.addEventListener('resize', recompute)
    window.visualViewport?.addEventListener('resize', recompute)
    return () => {
      if (ro) ro.disconnect()
      childObserver.disconnect()
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
      if (/[\-*+]\s+/.test(trimmed)) return false
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
                className={cn(
                  'prose prose-neutral dark:prose-invert break-words',
                  // Tighter vertical rhythm inside bubbles without changing font size
                  'prose-p:my-0 prose-p:leading-snug prose-li:my-0 prose-ul:my-1 prose-ol:my-1 prose-pre:my-2'
                )}>
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

  const handleSendMessage = useCallback((message: string, uploadedFiles?: File[]) => {
    const trimmed = message.trim()
    const filesToProcess = uploadedFiles || []
    const useSearchMode = false
    if ((trimmed.length === 0 && filesToProcess.length === 0) || status === 'submitted' || status === 'streaming') return
    
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages: ChatMessage[] = [...messages, userMsg]
    setMessages(nextMessages)
    setStatus('submitted')

    async function processMessage() {
      try {
        // Capture current files as message attachments for preview in the chat container
        const attachmentsForPreview: AttachmentPreview[] = filesToProcess.map((f) => {
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

        // Convert files to base64 (images as data URLs with resize; PDFs as raw base64) for API submission
        // Standard browser FileReader approach for file inputs
        const fileToBase64RawPdf = async (file: File): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              try {
                const result = String(reader.result || '')
                const m = result.match(/^data:[^;]+;base64,(.*)$/)
                resolve(m ? m[1] : '')
              } catch (e) {
                reject(e)
              }
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
        }

        const encodeImageWithResize = async (file: File, maxDimension = 1200, quality = 0.72): Promise<string> => {
          try {
            const imgUrl = URL.createObjectURL(file)
            const img = new Image()
            img.crossOrigin = 'anonymous'
            const dataUrl: string = await new Promise((resolve, reject) => {
              img.onload = () => {
                try {
                  const { width, height } = img
                  const scale = Math.min(1, maxDimension / Math.max(width, height))
                  const targetW = Math.max(1, Math.round(width * scale))
                  const targetH = Math.max(1, Math.round(height * scale))
                  const canvas = document.createElement('canvas')
                  canvas.width = targetW
                  canvas.height = targetH
                  const ctx = canvas.getContext('2d')
                  if (!ctx) return reject(new Error('Canvas not supported'))
                  ctx.drawImage(img, 0, 0, targetW, targetH)
                  const out = canvas.toDataURL('image/jpeg', quality)
                  resolve(out)
                } catch (e) {
                  reject(e)
                }
              }
              img.onerror = reject
              img.src = imgUrl
            })
            URL.revokeObjectURL(imgUrl)
            return dataUrl
          } catch {
            // Fallback to direct FileReader if canvas processing fails
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
          }
        }

        const encodeImageToTarget = async (
          file: File,
          targetChars: number,
          dimCandidates = [1200, 1024, 800, 640, 512, 384],
          qualityCandidates = [0.72, 0.64, 0.56, 0.48, 0.4]
        ): Promise<string | null> => {
          for (const d of dimCandidates) {
            for (const q of qualityCandidates) {
              try {
                const s = await encodeImageWithResize(file, d, q)
                if (s && s.length <= targetChars) return s
              } catch {}
            }
          }
          // Return smallest we can produce even if above target
          try {
            const smallest = await encodeImageWithResize(file, dimCandidates[dimCandidates.length - 1], qualityCandidates[qualityCandidates.length - 1])
            return smallest || null
          } catch {
            return null
          }
        }

        const imageFiles = filesToProcess.filter((f) => f.type.startsWith('image/'))
        const pdfFiles = filesToProcess.filter((f) => (f.type === 'application/pdf') || (f.name || '').toLowerCase().endsWith('.pdf'))

        // Convert files to base64
        let imageDataUrls: string[] = []
        let pdfBase64s: string[] = []
        
        try {
          // Encode PDFs (raw base64, no data URL header)
          if (pdfFiles.length > 0) {
            try {
              pdfBase64s = await Promise.all(pdfFiles.map((f) => fileToBase64RawPdf(f)))
            } catch (e) {
              console.error('PDF encoding failed:', e)
              throw new Error('Failed to process PDFs. Please try again.')
            }
          }
          if (imageFiles.length > 0) {
            const isProduction = process.env.NODE_ENV === 'production'
            if (isProduction) {
              const TOTAL_BUDGET_CHARS = 3_200_000 // ~3.2MB JSON body cap (safe under server limits)
              const OVERHEAD_CHARS = 120_000 // buffer for JSON + text
              const pdfChars = pdfBase64s.reduce((n, s) => n + (s?.length || 0), 0)
              const availableForImages = Math.max(0, TOTAL_BUDGET_CHARS - OVERHEAD_CHARS - pdfChars)
              const perImageBudget = Math.max(120_000, Math.floor(availableForImages / imageFiles.length))
              const encoded = await Promise.all(imageFiles.map((f) => encodeImageToTarget(f, perImageBudget)))
              imageDataUrls = (encoded.filter(Boolean) as string[])
              const dropped = imageFiles.length - imageDataUrls.length
              if (dropped > 0) {
                console.warn('Dropped', dropped, 'images due to production size budget')
              }
            } else {
              imageDataUrls = await Promise.all(imageFiles.map((f) => encodeImageWithResize(f)))
            }
          }
        } catch (encodeError) {
          console.error('File encoding failed:', encodeError)
          throw new Error('Failed to process files. Please try again.')
        }

        // In production (e.g., Vercel), request body size is limited. Block overly large payloads upfront.
        try {
          const isProduction = process.env.NODE_ENV === 'production'
          if (isProduction) {
            const attachmentsChars = imageDataUrls.reduce((n, s) => n + (s?.length || 0), 0) + pdfBase64s.reduce((n, s) => n + (s?.length || 0), 0)
            // Add small buffer for JSON overhead and other fields
            const estimatedTotalChars = attachmentsChars + 64_000
            // Keep well under common 4.5MB limits; base64 expands ~33%, use ~3.5MB cap
            const PROD_MAX_PAYLOAD_CHARS = 3_500_000
            if (estimatedTotalChars > PROD_MAX_PAYLOAD_CHARS) {
              setMessages((prev) => ([
                ...prev,
                {
                  role: 'assistant',
                  content: 'Attachments are too large for the hosted server limit. Please send fewer/smaller files (try under ~2MB per file for images, ~2.5MB for PDFs), or reduce image resolution.'
                },
              ]))
              setStatus('ready')
              return
            }
          }
        } catch {}

        // Extract image and PDF URLs from the message
        const extractUrls = (text: string): { images: string[]; pdfs: string[] } => {
          const urlRe = /(https?:\/\/[^\s)]+)(?=\)\?)/gi
          const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.heic','.heif','.tif','.tiff','.avif']
          const images: string[] = []
          const pdfs: string[] = []
          let m: RegExpExecArray | null
          while ((m = urlRe.exec(text)) !== null) {
            const u = m[1]
            const lower = u.toLowerCase()
            if (lower.endsWith('.pdf')) pdfs.push(u)
            else if (imageExts.some((e) => lower.endsWith(e))) images.push(u)
          }
          return { images, pdfs }
        }
        const urlExtraction = extractUrls(trimmed)

        // Use Claude Sonnet 4.5 on the server
        const selectedModel = 'claude-sonnet-4-5'
        const stripImageData = (text: string): string => {
          const angleTag = /<image:[^>]+>/gi
          const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
          const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
          const bracketPdfDataUrl = /\[data:application\/pdf;base64,[^\]]+\]/gi
          const barePdfDataUrl = /data:application\/pdf;base64,[A-Za-z0-9+/=]+/gi
          return text
            .replace(angleTag, '[image omitted]')
            .replace(bracketDataUrl, '[image omitted]')
            .replace(bareDataUrl, '[image omitted]')
            .replace(bracketPdfDataUrl, '[pdf omitted]')
            .replace(barePdfDataUrl, '[pdf omitted]')
        }
        const payloadMessages = nextMessages.map((m) => ({ ...m, content: stripImageData(m.content) }))
        const ac = new AbortController()
        abortControllerRef.current = ac
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            inputImages: imageDataUrls,
            inputPdfBase64: pdfBase64s,
            inputImageUrls: urlExtraction.images,
            inputPdfUrls: urlExtraction.pdfs,
            previousResponseId: lastResponseId,
            model: selectedModel,
            // Reserve space; adjust as needed for cost control
            max_output_tokens: 30000,
            // Enable extended thinking so the server streams thinking deltas
            thinking: { type: 'enabled', budget_tokens: 4000 },
            includeReasoningSummary: false,
            includeEncryptedReasoning: false,
            useSearch: useSearchMode,
          }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          if (res.status === 413) {
            throw new Error('Payload too large for server. Please attach fewer/smaller files.')
          }
          let detail = ''
          try {
            detail = await res.text()
          } catch {}
          let msg = `Request failed: ${res.status}`
          try {
            const json = JSON.parse(detail)
            if (json && typeof json.error === 'string' && json.error) {
              msg += ` - ${json.error}`
            }
          } catch {
            if (detail) msg += ` - ${detail.slice(0, 200)}`
          }
          throw new Error(msg)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantText = ''

        // Prepare per-message reasoning index for this assistant reply
        const assistantIndex = nextMessages.length
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
        abortControllerRef.current = null
        streamBufferRef.current = ''
      }
    }
    
    processMessage()
  }, [messages, status, lastResponseId, processStreamChunk])

  return (
    <section ref={containerRef} className={cn('w-full h-full min-h-screen flex flex-col', messages.length === 0 && 'justify-center max-w-3xl mx-auto')}>
      <div
        ref={outputRef}
        className={cn('rounded-none pt-1 pb-3 overflow-y-auto text-base font-sans w-full max-w-3xl mx-auto px-2 sm:px-4', messages.length === 0 && 'hidden')}
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
                        'min-w-0 max-w-[80%] sm:max-w-[60%] break-words px-3 py-0.5 text-base leading-snug',
                        'bg-white text-neutral-900 border border-gray-200 dark:bg-[#303030] dark:text-white dark:border-[#444444]'
                      )}
                      style={{ borderRadius: 32, boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)" }}
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
        className={cn('max-w-3xl mx-auto w-full px-2 sm:px-4', messages.length === 0 ? '-mt-48 sm:-mt-40 md:-mt-48 lg:-mt-56 xl:-mt-64 mb-0' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+8px)] sm:mb-4')}
        aria-busy={status === 'submitted' || status === 'streaming'}
      >
        <AIChatInput
          isLoading={status === 'streaming' || status === 'submitted'}
          className="max-w-3xl mx-auto"
          onSend={(text, files) => {
            handleSendMessage(text, files)
          }}
        />
      </div>
    </section>
  )
}


