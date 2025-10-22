"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Response as StreamResponse } from '../../components/ui/response'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '../../components/ui/reasoning'
import { PromptInputBox } from '@/app/components/ui/chatinput'
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
        ) : null
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
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [reasoningByMessageIndex, setReasoningByMessageIndex] = useState<Record<number, string>>({})
  const currentAssistantIndexRef = useRef<number | null>(null)
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

  const handleSendMessage = useCallback((message: string, uploadedFiles?: File[], options?: { showThink?: boolean; showSearch?: boolean }) => {
    const trimmed = message.trim()
    const filesToProcess = uploadedFiles || []
    const useThinkMode = options?.showThink || false
    const useSearchMode = options?.showSearch || false
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
        const imageFiles = filesToProcess.filter((f) => f.type.startsWith('image/'))
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
        const pdfFiles = filesToProcess.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
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
            // Use gpt-4.1 by default, gpt-5 with medium reasoning when think is enabled
            model: useThinkMode ? 'gpt-5' : 'gpt-4.1',
            reasoningEffort: useThinkMode ? 'medium' : undefined,
            // Reserve space; adjust as needed for cost control
            max_output_tokens: 30000,
            // Opt-in to reasoning summaries where supported
            includeReasoningSummary: useThinkMode,
            // Enable encrypted reasoning items for stateless use (server decides include key)
            includeEncryptedReasoning: useThinkMode,
            // Enable web search when search button is active
            useSearch: useSearchMode,
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
    
    processMessage()
  }, [messages, status, lastResponseId, processStreamChunk])

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
                        'min-w-0 max-w-[80%] sm:max-w-[60%] break-words rounded-3xl px-3 py-0.5 text-base leading-snug shadow-xs',
                        'bg-neutral-100 text-neutral-900 border border-neutral-200 dark:bg-[#383838] dark:text-white dark:border-transparent'
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
        className={cn('max-w-3xl mx-auto w-full px-3 sm:px-4', messages.length === 0 ? '-mt-28 sm:-mt-16 md:-mt-40 lg:-mt-48 mb-0' : 'mt-2 mb-[calc(env(safe-area-inset-bottom)+32px)] sm:mb-6')}
        aria-busy={status === 'submitted' || status === 'streaming'}
      >
        {messages.length === 0 ? (
          <div className="text-neutral-600 dark:text-neutral-300 font-medium text-xl sm:text-2xl md:text-3xl text-center mt-0 mb-4 sm:mb-10 md:mb-12 px-3 sm:px-0">
            What's on your mind today?
          </div>
        ) : null}
        <PromptInputBox
          onSend={handleSendMessage}
          isLoading={status === 'streaming' || status === 'submitted'}
          placeholder="Message Yurie"
        />
      </div>
    </section>
  )
}

