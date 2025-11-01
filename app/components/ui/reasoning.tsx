"use client"

import { memo, useCallback, useContext, useEffect, useMemo, useState, createContext, type ComponentProps } from 'react'
import { TextShimmer } from '@/app/components/ui/text-shimmer'
import { Response } from './response'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { cn } from '@/app/lib/utils'

type ReasoningContextValue = {
  isStreaming: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  duration: number | undefined
  usingSearch: boolean
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null)

function useReasoning() {
  const ctx = useContext(ReasoningContext)
  if (!ctx) throw new Error('Reasoning components must be used within Reasoning')
  return ctx
}

export type ReasoningProps = {
  isStreaming?: boolean
  usingSearch?: boolean
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
  usingSearch = false,
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

  const [duration, setDuration] = useState<number | undefined>(durationProp)
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
    () => ({ isStreaming, isOpen, setIsOpen: handleSetOpen, duration, usingSearch }),
    [isStreaming, isOpen, handleSetOpen, duration, usingSearch]
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

const getThinkingMessage = (isStreaming: boolean, duration?: number, usingSearch?: boolean, title?: string) => {
  if (title) return title
  if (isStreaming) return usingSearch ? 'Thinking and searching in parallel' : 'Thinking'
  if (duration === undefined) return 'Thought for a few seconds'
  return `Thought for ${duration} seconds`
}

export const ReasoningTrigger = memo(function ReasoningTrigger({ className, children, title, ...props }: ReasoningTriggerProps) {
  const { isStreaming, isOpen, setIsOpen, duration, usingSearch } = useReasoning()
  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      aria-expanded={isOpen}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border h-9 px-4 text-sm sm:text-[15px] font-medium transition-colors duration-150 hover:cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 shadow-sm hover:shadow-md',
        isOpen
          ? 'bg-neutral-100 text-neutral-900 border-neutral-300 dark:bg-neutral-800/70 dark:text-neutral-100 dark:border-neutral-700'
          : 'bg-transparent text-neutral-700 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900 hover:border-neutral-300 dark:text-neutral-300 dark:border-neutral-800 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100 dark:hover:border-neutral-700',
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <Lightbulb className="size-4" aria-hidden="true" />
          {isStreaming ? (
            <TextShimmer
              duration={1.2}
              className="[--base-color:#737373] [--base-gradient-color:#e5e5e5] dark:[--base-color:#a3a3a3] dark:[--base-gradient-color:#f5f5f5]"
            >
              {getThinkingMessage(isStreaming, duration, usingSearch, title)}
            </TextShimmer>
          ) : (
            <span>{getThinkingMessage(isStreaming, duration, usingSearch, title)}</span>
          )}
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
          <div className="prose prose-neutral dark:prose-invert font-sans text-[13px] leading-[1.6] prose-p:my-0 prose-p:leading-[1.6] prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-ol:pl-4 prose-strong:font-semibold prose-strong:text-neutral-800 dark:prose-strong:text-neutral-200 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
            <Response className="w-full" parseIncompleteMarkdown>{children}</Response>
          </div>
        </div>
      )}
    </div>
  )
})

Reasoning.displayName = 'Reasoning'
ReasoningTrigger.displayName = 'ReasoningTrigger'
ReasoningContent.displayName = 'ReasoningContent'


