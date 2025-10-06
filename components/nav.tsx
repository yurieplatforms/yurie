'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { modelOptions } from '@/app/chat/utils'

export function Navbar() {
  const pathname = usePathname()
  const safePathname = pathname ?? '/'
  const isPlayground = safePathname === '/'
  const [, setHasChatMessages] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return (modelOptions && modelOptions[0]?.value) || 'x-ai/grok-4-fast-reasoning'
    } catch {
      return 'x-ai/grok-4-fast-reasoning'
    }
  })
  const modelSizerRef = useRef<HTMLSpanElement | null>(null)
  const [modelSelectorWidth, setModelSelectorWidth] = useState<number | null>(null)
  const selectedModelLabel = useMemo(() => {
    try {
      const found = modelOptions.find(o => o.value === selectedModel)
      return found ? found.label : selectedModel
    } catch {
      return selectedModel
    }
  }, [selectedModel])
  const isResearchMode = useMemo(() => {
    try {
      return String(selectedModel || '').toLowerCase() === 'x-ai/grok-4-0709'
    } catch {
      return false
    }
  }, [selectedModel])

  useEffect(() => {
    const onChatState = (e: Event) => {
      try {
        const ce = e as CustomEvent
        const next = Boolean(ce?.detail?.hasMessages)
        setHasChatMessages(next)
      } catch {}
    }
    const onModelState = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ value?: string }>
        const value = String(ce?.detail?.value || '')
        if (value) setSelectedModel(value)
      } catch {}
    }
    const onGeneratingState = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ isGenerating?: boolean }>
        const generating = Boolean(ce?.detail?.isGenerating)
        setIsGenerating(generating)
      } catch {}
    }
    try {
      window.addEventListener('yurie:chat-state', onChatState as EventListener)
      window.addEventListener('yurie:model:state', onModelState as EventListener)
      window.addEventListener('yurie:generating', onGeneratingState as EventListener)
    } catch {}
    return () => {
      try {
        window.removeEventListener('yurie:chat-state', onChatState as EventListener)
        window.removeEventListener('yurie:model:state', onModelState as EventListener)
        window.removeEventListener('yurie:generating', onGeneratingState as EventListener)
      } catch {}
    }
  }, [])

  useLayoutEffect(() => {
    const computeWidth = () => {
      try {
        const sizer = modelSizerRef.current
        if (!sizer) return
        const contentWidth = Math.ceil(sizer.offsetWidth)
        // left padding 8px (pl-2) + right padding for chevron 24px (pr-6) + borders 2px
        const total = contentWidth + 8 + 24 + 2
        setModelSelectorWidth(total)
      } catch {}
    }
    computeWidth()
    window.addEventListener('resize', computeWidth)
    return () => window.removeEventListener('resize', computeWidth)
  }, [selectedModelLabel])

  return (
    <aside
      className={
        isPlayground
          ? 'fixed top-0 left-0 right-0 z-50 h-12 pt-1.5 tracking-tight bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60'
          : 'fixed top-0 left-0 right-0 z-50 h-12 pt-1.5 tracking-tight bg-[var(--color-background)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60'
      }
    >
      <div className="mx-auto max-w-3xl">
        <nav
          className="flex scroll-pr-6 flex-row items-center px-0 pb-0"
          id="nav"
        >
          <div className="flex w-full h-10 flex-row items-center justify-between px-3 sm:px-4">
            <Link
              href="/"
              className="group flex items-center gap-1 px-0 py-1.5 cursor-pointer transition-opacity"
              onClick={(e) => {
                if (safePathname === '/') {
                  e.preventDefault()
                  try {
                    window.location.assign('/')
                  } catch {}
                }
              }}
            >
              <img
                src="/favicon.ico"
                alt="Yurie"
                width={20}
                height={20}
                className="h-5 w-5 origin-center transform transition-transform duration-200 ease-out select-none group-hover:scale-105 sm:h-6 sm:w-6"
                draggable={false}
                decoding="async"
              />
              <span className="leading-none font-semibold text-foreground">Yurie</span>
            </Link>
            {isPlayground ? (
              <div className="flex items-center gap-2">
                <AnimatePresence initial={false}>
                  {!isResearchMode ? (
                    <motion.div
                      key="navbar-model-selector"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <div className="relative inline-flex items-center" style={modelSelectorWidth ? { width: `${modelSelectorWidth}px` } : undefined}>
                        <label htmlFor="navbar-model-select" className="sr-only">Model</label>
                        <select
                          id="navbar-model-select"
                          value={selectedModel}
                          onChange={(e) => {
                            const value = e.target.value
                            try {
                              window.dispatchEvent(new CustomEvent('yurie:model:change', { detail: { value } }))
                              setSelectedModel(value)
                            } catch {}
                          }}
                          disabled={isGenerating}
                          className="inline-block w-full appearance-none bg-transparent pl-2 pr-6 text-sm font-normal text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-default"
                        >
                          {modelOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2 size-4 text-[#807d78] dark:text-[#807d78]" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                        <span
                          ref={modelSizerRef}
                          aria-hidden="true"
                          className="absolute left-0 top-0 invisible whitespace-nowrap text-sm font-normal"
                        >
                          {selectedModelLabel}
                        </span>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </aside>
  )
}
