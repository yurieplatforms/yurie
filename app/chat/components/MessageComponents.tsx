'use client'

import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretDown, Globe, Lightbulb } from '@phosphor-icons/react'
import Image from 'next/image'
import { cn, dedupeUrls, inferSourceMeta, toDisplayParts, getSiteDisplayNameFromHostname, sortUrlsByRelevanceAndRecency } from '../utils'

// Lightweight client-side cache for meta lookups with TTL and simple concurrency limiting
type RemoteMeta = { title?: string; description?: string; images?: string[] }
const META_TTL_MS = 15 * 60 * 1000
const metaCache = new Map<string, { expiresAt: number; data: RemoteMeta }>()
const inFlightMeta = new Map<string, Promise<RemoteMeta>>()
const MAX_CONCURRENT_META_FETCHES = 4
let activeMetaFetches = 0
const pendingMetaResolvers: Array<() => void> = []

async function acquireSlot(): Promise<void> {
  if (activeMetaFetches < MAX_CONCURRENT_META_FETCHES) {
    activeMetaFetches++
    return
  }
  await new Promise<void>((resolve) => pendingMetaResolvers.push(resolve))
  activeMetaFetches++
}

function releaseSlot(): void {
  activeMetaFetches = Math.max(0, activeMetaFetches - 1)
  const next = pendingMetaResolvers.shift()
  if (next) next()
}

async function fetchMetaWithCache(url: string, signal?: AbortSignal): Promise<RemoteMeta> {
  try {
    const now = Date.now()
    const cached = metaCache.get(url)
    if (cached && cached.expiresAt > now) return cached.data
    if (inFlightMeta.has(url)) return await inFlightMeta.get(url)!

    const task = (async () => {
      await acquireSlot()
      try {
        const res = await fetch(`/api/meta?url=${encodeURIComponent(url)}`, { signal, cache: 'force-cache' })
        if (!res.ok) return {}
        const data = await res.json().catch(() => ({}))
        const out: RemoteMeta = {
          title: typeof data?.title === 'string' ? data.title : undefined,
          description: typeof data?.description === 'string' ? data.description : undefined,
          images: Array.isArray(data?.images) ? data.images.filter((s: any) => typeof s === 'string') : undefined,
        }
        metaCache.set(url, { data: out, expiresAt: now + META_TTL_MS })
        return out
      } finally {
        releaseSlot()
        inFlightMeta.delete(url)
      }
    })()
    inFlightMeta.set(url, task)
    return await task
  } catch {
    return {}
  }
}

const FaviconOrGlobe = memo(({ src }: { src?: string }) => {
  const [failed, setFailed] = useState(false)
  const handleError = useCallback(() => setFailed(true), [])
  
  if (!src || failed) {
    return (
      <Globe className="size-4 text-foreground/50 shrink-0" weight="bold" aria-hidden="true" />
    )
  }
  return (
    <Image
      src={src}
      alt=""
      width={16}
      height={16}
      className="size-4 rounded shrink-0"
      onError={handleError}
      loading="lazy"
      quality={60}
    />
  )
})
FaviconOrGlobe.displayName = 'FaviconOrGlobe'

const SourceItem = memo(({ url }: { url: string }) => {
  const meta = useMemo(() => inferSourceMeta(url), [url])
  const p = useMemo(() => toDisplayParts(url), [url])
  const [remote, setRemote] = useState<RemoteMeta | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const rootRef = useRef<HTMLLIElement | null>(null)
  const [shouldFetch, setShouldFetch] = useState<boolean>(false)

  useEffect(() => {
    try {
      if (typeof IntersectionObserver === 'undefined') {
        setShouldFetch(true)
        return
      }
      const el = rootRef.current
      if (!el) return
      const obs = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldFetch(true)
            obs.disconnect()
            break
          }
        }
      }, { root: null, rootMargin: '200px', threshold: 0 })
      obs.observe(el)
      return () => obs.disconnect()
    } catch {
      setShouldFetch(true)
      return
    }
  }, [url])

  useEffect(() => {
    if (!shouldFetch) return
    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchMetaWithCache(url, controller.signal)
        if (!cancelled) setRemote(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      try { controller.abort() } catch {}
    }
  }, [shouldFetch, url])
  
  // Derive a clean site name from hostname (handles locales like en.wikipedia.org)
  const siteName = useMemo(() => {
    const name = getSiteDisplayNameFromHostname(p.hostname || p.domain)
    return name || (p.domain || '')
  }, [p.hostname, p.domain])
  
  const displayTitle = remote?.title || meta.title
  const displayDescription = remote?.description
  const displayImages = Array.isArray(remote?.images) ? (remote!.images as string[]).slice(0, 1) : []

  return (
    <li className="min-w-0" ref={rootRef}>
      <a
        href={meta.href}
        target="_blank"
        rel="noreferrer"
        title={meta.href}
        className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--color-pill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
      >
        <FaviconOrGlobe src={meta.faviconUrl} />
        <div className="min-w-0 flex-1" aria-busy={loading || undefined}>
          <div className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
            {siteName}
          </div>
          <div className="text-[15px] font-medium text-foreground leading-snug mt-1 line-clamp-2 group-hover:underline">
            {displayTitle}
          </div>
          {displayDescription ? (
            <div className="text-[13px] text-foreground/70 leading-snug mt-1.5 line-clamp-2">
              {displayDescription}
            </div>
          ) : loading ? (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="h-3.5 w-5/6 bg-neutral-200/60 dark:bg-neutral-800/60 rounded animate-pulse" />
              <div className="h-3.5 w-2/3 bg-neutral-200/60 dark:bg-neutral-800/60 rounded animate-pulse" />
            </div>
          ) : null}
          <div className="text-[11px] text-foreground/50 leading-tight mt-1.5 truncate">
            {meta.href}
          </div>
        </div>
        {displayImages.length > 0 ? (
          <div className="ml-3 hidden sm:flex gap-1">
            {displayImages.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`thumb-${i}`}
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded border border-neutral-200 dark:border-neutral-800 object-cover"
              />
            ))}
          </div>
        ) : null}
      </a>
    </li>
  )
})
SourceItem.displayName = 'SourceItem'

export function SourcesList({ urls }: { urls: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const MAX_VISIBLE = 12
  const deduped = useMemo(() => dedupeUrls(urls), [urls])
  const sorted = useMemo(() => sortUrlsByRelevanceAndRecency(deduped), [deduped])
  const shown = useMemo(() => expanded ? sorted : sorted.slice(0, MAX_VISIBLE), [expanded, sorted])
  const toggleExpanded = useCallback(() => setExpanded(v => !v), [])
  
  return (
    <div className="space-y-0">
      <ul className="space-y-1">
        {shown.map((url) => (
          <SourceItem key={url} url={url} />
        ))}
      </ul>
      {deduped.length > MAX_VISIBLE && (
        <div className="px-2 pt-2 pb-1">
          <button
            type="button"
            onClick={toggleExpanded}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-foreground/60 transition-colors hover:bg-[var(--color-pill-hover)] hover:text-foreground cursor-pointer text-center"
          >
            {expanded ? 'Show less' : `Show all ${deduped.length}`}
          </button>
        </div>
      )}
    </div>
  )
}

export function ThinkingPanel({
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
          <Lightbulb className="size-4" weight="bold" />
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
            <div className="mt-0 ml-[18px] rounded-lg bg-[var(--color-background)] px-0 py-2">
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

