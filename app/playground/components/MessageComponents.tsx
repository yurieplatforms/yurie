'use client'

import { memo, useMemo, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretDown, Globe, Sparkle } from '@phosphor-icons/react'
import Image from 'next/image'
import { cn, dedupeUrls, inferSourceMeta, toDisplayParts, getSiteDisplayNameFromHostname } from '../utils'

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
      quality={75}
    />
  )
})
FaviconOrGlobe.displayName = 'FaviconOrGlobe'

const SourceItem = memo(({ url }: { url: string }) => {
  const meta = useMemo(() => inferSourceMeta(url), [url])
  const p = useMemo(() => toDisplayParts(url), [url])
  
  // Derive a clean site name from hostname (handles locales like en.wikipedia.org)
  const siteName = useMemo(() => {
    const name = getSiteDisplayNameFromHostname(p.hostname || p.domain)
    return name || (p.domain || '')
  }, [p.hostname, p.domain])
  
  return (
    <li className="min-w-0">
      <a
        href={meta.href}
        target="_blank"
        rel="noreferrer"
        title={meta.href}
        className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--color-pill-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
      >
        <FaviconOrGlobe src={meta.faviconUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
            {siteName}
          </div>
          <div className="text-[15px] font-medium text-foreground leading-snug mt-1 line-clamp-2 group-hover:underline">
            {meta.title}
          </div>
          <div className="text-[11px] text-foreground/50 leading-tight mt-1.5 truncate">
            {meta.href}
          </div>
        </div>
      </a>
    </li>
  )
})
SourceItem.displayName = 'SourceItem'

export function SourcesList({ urls }: { urls: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const MAX_VISIBLE = 6
  const deduped = useMemo(() => dedupeUrls(urls), [urls])
  const shown = useMemo(() => expanded ? deduped : deduped.slice(0, MAX_VISIBLE), [expanded, deduped])
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
          <Sparkle className="size-4" weight="bold" />
        </span>
        <span className={generating ? 'ai-text-shimmer' : undefined}>
          {open ? 'Hide thinking' : 'Show thinking'}
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

