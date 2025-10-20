"use client"

import { memo, useCallback, useContext, useEffect, useMemo, useState, createContext, type ComponentProps } from 'react'
import { Response } from './response'
import { CaretDown as ChevronDown, Lightbulb as Brain } from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

function useReasoning() {
  const ctx = useContext(ReasoningContext)
  if (!ctx) throw new Error('Reasoning components must be used within Reasoning')
  return ctx
}

export type ReasoningProps = {
  isStreaming?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  duration?: number
  className?: string
  children?: React.ReactNode
}

const AUTO_CLOSE_DELAY = 1000
const MS_IN_S = 1000

export const Reasoning = memo(function Reasoning({
  className,
  isStreaming = false,
  open,
  defaultOpen = true,
  onOpenChange,
  duration: durationProp,
  children,
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useState<boolean>(open ?? defaultOpen)
  useEffect(() => {
    if (open === undefined) return
    setIsOpen(open)
  }, [open])

  const handleSetOpen = useCallback(
    (next: boolean) => {
      setIsOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const [duration, setDuration] = useState<number>(durationProp ?? 0)
  useEffect(() => {
    if (durationProp === undefined) return
    setDuration(durationProp)
  }, [durationProp])

  const [hasAutoClosed, setHasAutoClosed] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)

  // Track duration when streaming starts and ends
  useEffect(() => {
    if (isStreaming) {
      if (startTime === null) setStartTime(Date.now())
      if (!isOpen) handleSetOpen(true)
    } else if (startTime !== null) {
      setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S))
      setStartTime(null)
    }
  }, [isStreaming, startTime, isOpen, handleSetOpen])

  // Auto-close once streaming finishes (with a small delay)
  useEffect(() => {
    if (!isStreaming && isOpen && !hasAutoClosed) {
      const t = setTimeout(() => {
        handleSetOpen(false)
        setHasAutoClosed(true)
      }, AUTO_CLOSE_DELAY)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isStreaming, isOpen, hasAutoClosed, handleSetOpen])

  const contextValue = useMemo(
    () => ({ isStreaming, isOpen, setIsOpen: handleSetOpen, duration }),
    [isStreaming, isOpen, handleSetOpen, duration]
  )

  return (
    <ReasoningContext.Provider value={contextValue}>
      <div className={cn('not-prose mb-2', className)}>{children}</div>
    </ReasoningContext.Provider>
  )
})

export type ReasoningTriggerProps = ComponentProps<'button'> & {
  title?: string
}

const getThinkingMessage = (isStreaming: boolean, duration?: number, title?: string) => {
  if (title) return title
  if (isStreaming || duration === 0) return 'Thinking...'
  if (duration === undefined) return 'Thought for a few seconds'
  return `Thought for ${duration} seconds`
}

export const ReasoningTrigger = memo(function ReasoningTrigger({ className, children, title, ...props }: ReasoningTriggerProps) {
  const { isStreaming, isOpen, setIsOpen, duration } = useReasoning()
  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      aria-expanded={isOpen}
      className={cn(
        'flex w-full items-center gap-2 text-neutral-600 dark:text-neutral-300 text-sm transition-colors hover:text-neutral-900 dark:hover:text-neutral-50 cursor-pointer',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <Brain className="size-4" aria-hidden="true" />
          <span>{getThinkingMessage(isStreaming, duration, title)}</span>
          <ChevronDown className={cn('size-4 transition-transform', isOpen ? 'rotate-180' : 'rotate-0')} aria-hidden="true" />
        </>
      )}
    </button>
  )
})

export type ReasoningContentProps = ComponentProps<'div'> & {
  children: string
}

export const ReasoningContent = memo(function ReasoningContent({ className, children, ...props }: ReasoningContentProps) {
  const { isOpen } = useReasoning()
  return (
    <div
      className={cn(
        'mt-3 overflow-hidden',
        isOpen ? 'opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1',
        'transition-all duration-200 ease-out',
        className
      )}
      {...props}
    >
      {isOpen && (
        <div className="mt-2 max-h-64 overflow-auto rounded-none bg-white dark:bg-[#303030] border border-neutral-200 dark:border-neutral-800 p-3 shadow-xs">
          <div className="prose prose-neutral dark:prose-invert font-sans text-[13px] leading-5">
            <Response className="w-full">{children}</Response>
          </div>
        </div>
      )}
    </div>
  )
})

Reasoning.displayName = 'Reasoning'
ReasoningTrigger.displayName = 'ReasoningTrigger'
ReasoningContent.displayName = 'ReasoningContent'


