'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'
import { Response } from '@/components/ai-elements/response'
import { cn, sanitizeHtml, decodeBase64Utf8, extractHttpImageUrls, toDisplayParts, sortImageUrlsByRelevanceAndRecency } from '../utils'
import { MessagePart } from '../types'
import { SourcesList } from './MessageComponents'
import { Check, X, MessageSquare, Globe, ListOrdered, Image, Lightbulb } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function ImagesTabContent({ inlineImageUrls, citationUrls }: { inlineImageUrls: string[]; citationUrls: string[] }) {
  const [metaImageUrls, setMetaImageUrls] = useState<string[]>([])
  const [hiddenSrcs, setHiddenSrcs] = useState<Set<string>>(new Set())

  // Heuristic URL filter to avoid obvious icons, trackers, or tiny assets
  const shouldDropByHeuristics = (src: string): boolean => {
    try {
      const s = String(src || '')
      const lower = s.toLowerCase()
      if (!/(\.(?:jpg|jpeg|png|webp|gif))(?:$|[?#])/i.test(lower)) return true
      if (/(^|[\/_.-])favicon(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_.-])apple-touch-icon(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_.-])android-chrome(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_.-])mstile(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_.-])safari-pinned(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_-])icons?(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_-])icon(?:-\d+x\d+)?(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_-])logo(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_-])sprite(\.|[\/_-]|$)/i.test(lower)) return true
      if (/(^|[\/_-])(pixel|beacon|tracker|spacer)(\.|[\/_-]|$)/i.test(lower)) return true
      if (/([?&])(w|width|h|height|s|size)=(?:1|2|8|12|16|24|32|40|48|56|64)\b/i.test(lower)) return true
      if (/(^|[\/_-])(thumb|thumbnail|min|tiny|small)(\.|[\/_-]|$)/i.test(lower)) return true
      if (/doubleclick\.net|googletagmanager\.com|adservice|adsystem|analytics/i.test(lower)) return true
      return false
    } catch {
      return true
    }
  }

  // Concurrency-limited, incremental meta fetching when Images tab is mounted
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      try {
        const deduped = Array.from(new Set((citationUrls || []).filter(Boolean)))
        if (deduped.length === 0) {
          setMetaImageUrls([])
          return
        }
        const MAX_CONCURRENCY = 8
        let inFlight = 0
        let index = 0
        const aggregated = new Set<string>()

        const fetchOne = async (u: string): Promise<string[]> => {
          try {
            const res = await fetch(`/api/meta?url=${encodeURIComponent(u)}`, { signal: controller.signal, cache: 'force-cache' })
            if (!res.ok) return []
            const data = await res.json().catch(() => ({} as any))
            const imgs: unknown = data && (data as any).images
            if (!Array.isArray(imgs)) return []
            return (imgs as any[]).filter((s) => typeof s === 'string') as string[]
          } catch {
            return []
          }
        }

        const pump = async (): Promise<void> => {
          if (cancelled) return
          while (!cancelled && inFlight < MAX_CONCURRENCY && index < deduped.length) {
            const url = deduped[index++]
            inFlight++
            ;(async () => {
              const imgUrls = await fetchOne(url)
              inFlight--
              if (cancelled) return
              let changed = false
              for (const src of imgUrls) {
                if (!shouldDropByHeuristics(src) && !aggregated.has(src)) {
                  aggregated.add(src)
                  changed = true
                }
              }
              if (changed) setMetaImageUrls(Array.from(aggregated))
              if (index < deduped.length) {
                await pump()
              }
            })()
          }
        }

        await pump()
      } catch {
        if (!cancelled) setMetaImageUrls([])
      }
    })()
    return () => {
      cancelled = true
      try { controller.abort() } catch {}
    }
  }, [citationUrls.join('|')])

  const combinedImageUrls = (() => {
    const all = [...(inlineImageUrls || []), ...(metaImageUrls || [])]
    const uniqueSrcs = Array.from(new Set(all))
    const filtered = uniqueSrcs.filter((src) => !shouldDropByHeuristics(src))
    const sorted = sortImageUrlsByRelevanceAndRecency(filtered)
    const seenByHost = new Set<string>()
    const out: string[] = []
    for (const src of sorted) {
      try {
        const parts = toDisplayParts(src)
        const hostKey = String(parts.hostname || parts.domain || src).toLowerCase()
        if (seenByHost.has(hostKey)) continue
        seenByHost.add(hostKey)
        out.push(src)
      } catch {
        if (!seenByHost.has(src)) {
          seenByHost.add(src)
          out.push(src)
        }
      }
    }
    // Cap the list for performance; UI still lazy-loads images
    return out.slice(0, 36)
  })()

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    try {
      const el = e.currentTarget
      const src = el.currentSrc || el.src
      const minDim = 120
      if (el.naturalWidth < minDim || el.naturalHeight < minDim) {
        setHiddenSrcs((prev) => {
          const next = new Set(prev)
          next.add(src)
          return next
        })
      }
    } catch {}
  }

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    try {
      const src = (e.currentTarget.currentSrc || e.currentTarget.src) as string
      setHiddenSrcs((prev) => {
        const next = new Set(prev)
        next.add(src)
        return next
      })
    } catch {}
  }

  if (combinedImageUrls.length === 0) {
    return (
      <div className="text-sm text-neutral-500">No images found.</div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-4">
      {combinedImageUrls.filter((src) => !hiddenSrcs.has(src)).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`img-${i}`}
          src={src}
          alt="Image result"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
          className="w-full rounded border border-neutral-200 dark:border-neutral-800 object-cover"
        />
      ))}
    </div>
  )
}

function LoadingPreview({
  showThinking,
  showSearching,
  reasoningHtml,
  firstParagraphComplete,
  status,
  latestCitations,
}: {
  showThinking: boolean
  showSearching: boolean
  reasoningHtml: string
  firstParagraphComplete: boolean
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  latestCitations: string[]
}) {
  const [showPreparing, setShowPreparing] = useState<boolean>(false)
  const [showSearchingDelayed, setShowSearchingDelayed] = useState<boolean>(false)
  const [hasShownThinking, setHasShownThinking] = useState<boolean>(false)
  const [searchShimmerActive, setSearchShimmerActive] = useState<boolean>(false)
  
  // Track when the first paragraph of thinking has been fully shown
  useEffect(() => {
    if (reasoningHtml && showThinking && firstParagraphComplete && !hasShownThinking) {
      setHasShownThinking(true)
    }
  }, [reasoningHtml, showThinking, firstParagraphComplete, hasShownThinking])
  
  // Step 1: When thinking paragraph is shown (or fallback), schedule when "Searching the web" becomes visible
  useEffect(() => {
    let timerId: number | undefined
    if (hasShownThinking) {
      // Feel responsive after the first paragraph completes
      timerId = window.setTimeout(() => {
        setShowSearchingDelayed(true)
      }, 800)
    } else if (status === 'streaming' && !reasoningHtml && !showThinking) {
      // Fallback when there's no reasoning content for a while
      timerId = window.setTimeout(() => {
        setShowSearchingDelayed(true)
      }, 2500)
    }
    return () => {
      if (typeof timerId === 'number') window.clearTimeout(timerId)
    }
  }, [hasShownThinking, reasoningHtml, showThinking, status])

  // Step 2: If web search is enabled and has appeared, shimmer it for ~7s, then show Preparing
  useEffect(() => {
    if (!showSearching || !showSearchingDelayed) return
    setSearchShimmerActive(true)
    const id = window.setTimeout(() => {
      setSearchShimmerActive(false)
      setShowPreparing(true)
    }, 20000)
    return () => window.clearTimeout(id)
  }, [showSearching, showSearchingDelayed])

  // Step 3: If web search is NOT enabled, reveal Preparing on the original cadence
  useEffect(() => {
    if (showSearching) return
    let timerId: number | undefined
    if (hasShownThinking) {
      timerId = window.setTimeout(() => setShowPreparing(true), 800)
    } else if (status === 'streaming' && !reasoningHtml && !showThinking) {
      timerId = window.setTimeout(() => setShowPreparing(true), 2500)
    }
    return () => {
      if (typeof timerId === 'number') window.clearTimeout(timerId)
    }
  }, [showSearching, hasShownThinking, status, reasoningHtml, showThinking])
  return (
    <div className="space-y-2.5">
      {showThinking && reasoningHtml ? (
        <div className="rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-3.5 dark:border-neutral-800/60 dark:bg-neutral-900/30">
          <div className="mb-2.5 flex items-center gap-2 text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
            <Lightbulb className="size-3.5 text-neutral-500 dark:text-neutral-500" />
            <span className={!showPreparing && !(showSearching && showSearchingDelayed) ? 'ai-text-shimmer-white' : undefined}>Thought</span>
          </div>
          <div
            className="prose prose-sm prose-neutral dark:prose-invert text-[12.5px] leading-relaxed text-neutral-600 dark:text-neutral-400"
            dangerouslySetInnerHTML={{ __html: reasoningHtml }}
          />
        </div>
      ) : null}
      {showSearching && showSearchingDelayed ? (
        <div className="rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-3.5 dark:border-neutral-800/60 dark:bg-neutral-900/30">
          <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
            <svg className="size-3.5 text-neutral-500 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className={searchShimmerActive ? 'ai-text-shimmer-white' : undefined}>Searching the web</span>
            {Array.isArray(latestCitations) && latestCitations.length > 0 ? (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-500">· {latestCitations.length} sources</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {showPreparing ? (
        <div className="rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-3.5 dark:border-neutral-800/60 dark:bg-neutral-900/30">
          <div className="mb-2.5 flex items-center gap-2 text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
            <span className="ai-text-shimmer-white">Preparing answer</span>
          </div>
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-neutral-200/50 dark:bg-neutral-800/50">
            <div className="absolute inset-0 animate-progress-wave rounded-full">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-neutral-400 via-neutral-500 to-neutral-400 dark:from-neutral-600 dark:via-neutral-500 dark:to-neutral-600 opacity-60" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function mergeWithOverlap(chunks: string[], maxOverlap: number = 120): string {
  if (!Array.isArray(chunks) || chunks.length === 0) return ''
  let merged = ''
  for (const nextRaw of chunks) {
    const next = String(nextRaw || '')
    if (!merged) {
      merged = next
      continue
    }
    const maxK = Math.min(maxOverlap, merged.length, next.length)
    let overlap = 0
    for (let k = maxK; k > 0; k--) {
      if (merged.slice(-k) === next.slice(0, k)) {
        overlap = k
        break
      }
    }
    merged += next.slice(overlap)
  }
  return merged
}

function normalizeReasoningText(input: string): string {
  try {
    let s = String(input || '')
    // Collapse duplicate lines that repeat consecutively
    s = s
      .split(/\r?\n/)
      .reduce<string[]>((acc, line) => {
        const trimmed = line.trim()
        const prev = acc.length > 0 ? acc[acc.length - 1] : ''
        if (trimmed && prev.trim() === trimmed) return acc
        acc.push(line)
        return acc
      }, [])
      .join('\n')
    // Collapse immediate duplicate words (case-insensitive)
    s = s.replace(/\b(\w+)(?:\s+\1\b){1,}/gi, '$1')
    // Compress repeated punctuation like "..!!" -> ".!"
    s = s.replace(/([.,!?;:])\1{1,}/g, '$1')
    // Normalize excessive spaces
    s = s.replace(/[ \t]{2,}/g, ' ')
    // Remove accidental double list markers like "- - "
    s = s.replace(/(^|\n)\s*-\s*-\s+/g, '$1- ')
    return s
  } catch {
    return input
  }
}

export function useMarkdownRenderer() {
  return useMemo(() => {
    const instance = new Marked({ gfm: true, breaks: true })
    instance.use({
      renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
          const language = (lang || '').trim().split(/\s+/)[0]
          const html = highlight(text)
          const langClass = language ? `language-${language}` : ''
          const label = language || 'text'
          return `
<div class="chat-code">
  <div class="chat-code-header">
    <span class="chat-code-lang">${label}</span>
    <button type="button" class="chat-copy">Copy</button>
  </div>
  <pre><code class="${langClass}">${html}</code></pre>
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
}

export function renderMessageContent(
  role: 'user' | 'assistant',
  content: string,
  status: 'submitted' | 'streaming' | 'ready' | 'error',
  md: Marked
) {
  // legacyBracketPattern removed; we now parse explicit tokens only
  const pattern = new RegExp(
    `<reasoning_partial:([^>]+)>|<reasoning:([^>]+)>|<revised_prompt:([^>]+)>|<response_id:([^>]+)>|<summary_text:([^>]+)>|<incomplete:([^>]+)>|<citations:([^>]+)>|<web:on>`,
    'g'
  )
  
  const parts: MessagePart[] = []
  let lastIndex = 0
  let sawWebOn = false
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: content.slice(lastIndex, match.index),
      })
    }
    const full = match[0]
    const reasoningPartialPayload = match[1]
    const reasoningFinalPayload = match[2]
    const revisedPayload = match[3]
    const responseIdPayload = match[4]
    const summaryPayload = match[5]
    const incompletePayload = match[6]
    const citationsPayload = match[7]
    // Detect web search flag token
    if (full === '<web:on>') {
      sawWebOn = true
    }
    // No image tokens supported anymore
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
    (p): p is Extract<MessagePart, { type: 'reasoning' }> => p.type === 'reasoning'
  )
  const hasFinalReasoning = reasoningParts.some((r) => !r.partial)
  
  const reasoningDecoded = (() => {
    if (hasFinalReasoning) {
      const finals = reasoningParts
        .filter((r) => !r.partial)
        .map((r) => String(r.value))
      const decoded = finals.map(decodeBase64Utf8)
      return normalizeReasoningText(mergeWithOverlap(decoded))
    }
    const partials = reasoningParts
      .filter((r) => r.partial)
      .map((r) => String(r.value))
    if (partials.length === 0) return ''
    const decoded = partials.map(decodeBase64Utf8)
    return normalizeReasoningText(mergeWithOverlap(decoded))
  })()
  const reasoningHtml = reasoningDecoded
    ? sanitizeHtml(md.parse(reasoningDecoded) as string)
    : ''
  
  // For user messages, render directly
  if (role === 'user') {
    return (
      <>
        {parts.map((p, i) => {
          if (p.type === 'text') {
            const text = String(p.value || '')
            if (!text.trim()) return null
            return (
              <UserHeadingWithActions key={i} text={text} />
            )
          }
          if (p.type === 'image') {
            const isPartial = p.partial === true
            const isLatestPartial = latestPartialIndex === i
            if (isPartial && (!isLatestPartial || hasFinalImage)) {
              return null
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`img-${i}`}
                src={p.src}
                alt="Generated image"
                className={cn(
                  'mt-2 max-w-full rounded border border-neutral-200 dark:border-neutral-800',
                  'mb-3'
                )}
              />
            )
          }
          return null
        })}
      </>
    )
  }
  
  // For assistant messages, wrap content in tabs
  const latestCitations = (() => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (p.type === 'citations' && Array.isArray(p.urls)) {
        return p.urls
      }
    }
    return [] as string[]
  })()
  
  const textParts = parts.filter(p => p.type === 'text')
  const hasSources = sawWebOn || latestCitations.length > 0
  const hasReasoning = Boolean(reasoningHtml)

  // Derive image URLs from inline assistant text (pure)
  const inlineImageUrls = (() => {
    try {
      const combined = textParts.map((p) => String(p.value || '')).join(' ')
      return extractHttpImageUrls(combined)
    } catch {
      return [] as string[]
    }
  })()
  // Show Images tab whenever Sources tab is shown (when Research/Web is on)
  const showImagesTab = hasSources
  
  // Extract first paragraph from reasoning HTML
  // (we'll compute preview gating after we know if the first paragraph is complete)
  const firstParagraphHtml = (() => {
    if (!reasoningHtml) return ''
    // Extract first <p> tag or first block element
    const match = reasoningHtml.match(/<p[^>]*>[\s\S]*?<\/p>/)
    if (match) return match[0]
    // If no <p> tag, try to get content before double line break
    const textMatch = reasoningHtml.match(/^[\s\S]*?(?=\n\n|$)/)
    return textMatch ? textMatch[0] : reasoningHtml
  })()

  // Consider first paragraph complete when we clearly see a paragraph boundary
  // in the raw decoded reasoning (blank line), or when final reasoning has arrived.
  const firstParagraphComplete = (() => {
    if (!hasReasoning) return false
    if (hasFinalReasoning) return true
    try {
      const text = String(reasoningDecoded || '')
      // Paragraph boundary: one or more blank lines indicates next paragraph started
      if (/\n\s*\n/.test(text)) return true
      return false
    } catch {
      return false
    }
  })()
  
  // Show only Answer tab with preview when submitting, or while streaming until the first reasoning paragraph completes
  const hasTextContent = textParts.some(p => String(p.value || '').trim().length > 0)
  const isPreviewMode = (
    status === 'submitted' ||
    (status === 'streaming' && (!hasTextContent || (hasReasoning && !firstParagraphComplete)))
  )
  
  if (isPreviewMode) {
    return (
      <>
      <Tabs defaultValue="answer" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="answer">
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-[var(--color-pill-hover)] active:bg-[var(--color-pill-active)]">
              <MessageSquare className="size-3" />
              Answer
            </span>
          </TabsTrigger>
        </TabsList>
          
          <TabsContent value="answer" className="mt-0">
            <LoadingPreview
              showThinking={hasReasoning}
              showSearching={sawWebOn || latestCitations.length > 0}
              reasoningHtml={firstParagraphHtml}
              firstParagraphComplete={firstParagraphComplete}
              status={status}
              latestCitations={latestCitations}
            />
          </TabsContent>
        </Tabs>
      </>
    )
  }
  
  // Show all tabs when streaming or ready
  return (
    <>
      <Tabs defaultValue="answer" className="w-full">
        <TabsList className="mb-3">
          <TabsTrigger value="answer">
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-[var(--color-pill-hover)] active:bg-[var(--color-pill-active)]">
              <MessageSquare className="size-3" />
              Answer
            </span>
          </TabsTrigger>
          {showImagesTab && (
            <TabsTrigger value="images">
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-[var(--color-pill-hover)] active:bg-[var(--color-pill-active)]">
                <Image className="size-3" />
                Images
              </span>
            </TabsTrigger>
          )}
          {hasSources && (
            <TabsTrigger value="sources">
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-[var(--color-pill-hover)] active:bg-[var(--color-pill-active)]">
                <Globe className="size-3" />
                {`Sources${latestCitations.length > 0 ? ` · ${latestCitations.length}` : ''}`}
              </span>
            </TabsTrigger>
          )}
          {hasReasoning && (
            <TabsTrigger value="steps">
              <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-[var(--color-pill-hover)] active:bg-[var(--color-pill-active)]">
                <ListOrdered className="size-3" />
                Steps
              </span>
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="answer" className="mt-0">
          {textParts.map((p, i) => (
            <Response
              key={i}
              parseIncompleteMarkdown
              allowedImagePrefixes={["*"]}
              allowedLinkPrefixes={["*"]}
            >
              {p.value}
            </Response>
          ))}
          {parts.map((p, i) => {
            if (p.type === 'meta') {
              const meta = p
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
        </TabsContent>
        
        {hasSources && (
          <TabsContent value="sources" className="mt-0">
            <SourcesList urls={latestCitations} />
          </TabsContent>
        )}
        
        {hasReasoning && (
          <TabsContent value="steps" className="mt-0">
            <div
              className="prose prose-neutral dark:prose-invert prose-message"
              dangerouslySetInnerHTML={{ __html: reasoningHtml }}
            />
          </TabsContent>
        )}
        
        {showImagesTab && (
          <TabsContent value="images" className="mt-0">
            <ImagesTabContent inlineImageUrls={inlineImageUrls} citationUrls={latestCitations} />
          </TabsContent>
        )}
      </Tabs>
    </>
  )
}

function UserHeadingWithActions({ text }: { text: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<string>(text)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  
  const handleCancelEdit = () => {
    try {
      setDraft(text)
      setIsEditing(false)
    } catch {}
  }
  const handleSaveEdit = () => {
    try {
      const next = String(draft || '').trim()
      if (!next) {
        setIsEditing(false)
        return
      }
      window.dispatchEvent(
        new CustomEvent('yurie:prompt:edit-submit', {
          detail: { text: next },
        })
      )
      setIsEditing(false)
    } catch {}
  }
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    try {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSaveEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelEdit()
      }
    } catch {}
  }
  return (
    <div className="user-heading-wrapper group relative w-full">
      {(() => {
        // Classify question length to adjust heading styles for long prompts
        const classify = (s: string): 'short' | 'long' | 'very-long' => {
          try {
            const normalized = String(s || '').replace(/[\s\u00A0]+/g, ' ').trim()
            const charLength = normalized.length
            const wordCount = normalized ? normalized.split(/\s+/).length : 0
            const lineCount = String(s || '').split(/\r?\n/).length
            if (charLength >= 260 || wordCount >= 50 || lineCount >= 6) return 'very-long'
            if (charLength >= 140 || wordCount >= 28 || lineCount >= 3) return 'long'
            return 'short'
          } catch {
            return 'short'
          }
        }
        const variant = classify(text)
        const variantClass = variant === 'very-long' ? 'very-long' : variant === 'long' ? 'long' : undefined
        return (
          <div className={cn('user-heading w-full min-w-0 max-w-none pb-2 sm:pb-3', variantClass)}>
            {isEditing ? (
              <div className="w-full rounded-lg border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input)] p-2.5 sm:p-3">
                <textarea
                  ref={textareaRef as any}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full resize-y rounded-md border border-transparent bg-transparent px-2.5 py-2 leading-[1.3] text-neutral-900 dark:text-white outline-none focus:border-neutral-300 dark:focus:border-neutral-700"
                  rows={Math.min(8, Math.max(2, String(draft || '').split(/\r?\n/).length))}
                  aria-label="Edit prompt"
                />
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 cursor-pointer"
                    aria-label="Save and send edits"
                    title="Save & Send (⌘/Ctrl+Enter)"
                  >
                    <Check className="mr-1 size-4" /> Save & Send
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium bg-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 cursor-pointer"
                    aria-label="Cancel edits"
                    title="Cancel (Esc)"
                  >
                    <X className="mr-1 size-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={cn('title whitespace-pre-wrap break-words leading-[1.15] sm:leading-[1.2] select-text')}>
                <span className="align-baseline">{text}</span>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
