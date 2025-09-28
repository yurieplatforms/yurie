'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowSquareOut, CaretDown, Globe, Sparkle } from '@phosphor-icons/react'
import Image from 'next/image'
import { cn, dedupeUrls, toDisplayParts } from '../utils'

export function SourcesList({ urls }: { urls: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const MAX_VISIBLE = 6
  const deduped = useMemo(() => dedupeUrls(urls), [urls])
  const shown = expanded ? deduped : deduped.slice(0, MAX_VISIBLE)
  return (
    <div className="mt-3 rounded-2xl border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input)] p-0 shadow-xs backdrop-blur-[2px]">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input)] text-[var(--color-accent)]">
            <Globe className="size-4" weight="bold" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold text-[#807d78] dark:text-[#807d78]">Sources</span>
        </div>
        <div className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[var(--color-chat-input-border)] bg-[var(--color-chat-input)] px-1.5 py-0.5 text-[10px] leading-none text-[#807d78] dark:text-[#807d78]">
          {deduped.length}
        </div>
      </div>
      <div className="h-px w-full bg-[var(--color-chat-input-border)]" />
      <ul className="grid grid-cols-1 gap-0.5 p-1.5 sm:grid-cols-2">
        {shown.map((u) => {
          const p = toDisplayParts(u)
          return (
            <li key={u} className="min-w-0">
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                title={p.href}
                className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-[var(--border-color-hover)] hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              >
                {p.faviconUrl ? (
                  <Image
                    src={p.faviconUrl}
                    alt=""
                    width={14}
                    height={14}
                    className="size-[14px] rounded-sm"
                  />
                ) : (
                  <span className="inline-block size-[14px] rounded-sm bg-neutral-300 dark:bg-neutral-700" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground group-hover:underline">
                    {p.domain}
                  </div>
                  <div className="truncate text-[11px] text-foreground/60">
                    {p.path}
                  </div>
                </div>
                <ArrowSquareOut className="ml-1 size-3 shrink-0 text-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
              </a>
            </li>
          )
        })}
      </ul>
      {deduped.length > MAX_VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-2 mb-2 mt-0 inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium text-[#807d78] underline-offset-2 transition-colors hover:cursor-pointer hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78]"
        >
          {expanded ? 'Show less' : `Show all ${deduped.length}`}
        </button>
      ) : null}
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
