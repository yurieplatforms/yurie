'use client'

import * as React from 'react'
import clsx from 'clsx'

type ClassName = string | undefined
function cn(...parts: Array<ClassName | false | null>): string {
  return clsx(parts.filter(Boolean))
}

type StickToBottomContextValue = {
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  isAtBottom: boolean
  scrollToBottom: () => void
}

const StickToBottomContext = React.createContext<StickToBottomContextValue | null>(
  null
)

export type ConversationProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: React.ReactNode
}

export const Conversation = React.forwardRef<HTMLDivElement, ConversationProps>(
  function Conversation({ className, children, ...props }, ref) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    // Allow parent to hold a ref to the scroll container
    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

    const [isAtBottom, setIsAtBottom] = React.useState(true)

    const computeIsAtBottom = React.useCallback(() => {
      const el = containerRef.current
      if (!el) return true
      try {
        const threshold = 16
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        return distanceFromBottom <= threshold
      } catch {
        return true
      }
    }, [])

    const scrollToBottom = React.useCallback(() => {
      const el = containerRef.current
      if (!el) return
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      } catch {
        el.scrollTop = el.scrollHeight
      }
    }, [])

    React.useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const onScroll = () => setIsAtBottom(computeIsAtBottom())
      onScroll()
      el.addEventListener('scroll', onScroll, { passive: true } as AddEventListenerOptions)
      return () => el.removeEventListener('scroll', onScroll)
    }, [computeIsAtBottom])

    // When content size changes and user is at bottom, keep pinned
    React.useEffect(() => {
      const el = containerRef.current
      if (!el || typeof ResizeObserver === 'undefined') return
      const ro = new ResizeObserver(() => {
        if (computeIsAtBottom()) {
          try {
            el.scrollTo({ top: el.scrollHeight })
          } catch {
            el.scrollTop = el.scrollHeight
          }
        }
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [computeIsAtBottom])

    return (
      <StickToBottomContext.Provider
        value={{ containerRef, isAtBottom, scrollToBottom }}
      >
        <div
          ref={containerRef}
          className={cn('overflow-y-auto', className)}
          {...props}
        >
          {typeof children === 'function'
            ? (children as (ctx: StickToBottomContextValue) => React.ReactNode)({
                containerRef,
                isAtBottom,
                scrollToBottom,
              })
            : children}
        </div>
      </StickToBottomContext.Provider>
    )
  }
)

export function useConversationContext(): StickToBottomContextValue {
  const ctx = React.useContext(StickToBottomContext)
  if (!ctx) throw new Error('Conversation components must be used within <Conversation>')
  return ctx
}

export function ConversationContent({ className, children, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & { children?: React.ReactNode | ((ctx: StickToBottomContextValue) => React.ReactNode) }) {
  const ctx = useConversationContext()
  return (
    <div className={cn('flex flex-col gap-0.5 px-0', className)} {...props}>
      {typeof children === 'function' ? (children as (c: StickToBottomContextValue) => React.ReactNode)(ctx) : children}
    </div>
  )
}

export function ConversationEmptyState({
  title = 'No messages yet',
  description = 'Start a conversation to see messages here',
  icon,
  children,
  className,
  ...props
}: {
  title?: string
  description?: string
  icon?: React.ReactNode
  children?: React.ReactNode
  className?: string
} & React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center text-neutral-600 dark:text-neutral-300',
        className
      )}
      {...props}
    >
      {icon ? <div className="mb-1 opacity-70">{icon}</div> : null}
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs opacity-80">{description}</div>
      {children}
    </div>
  )
}

export function ConversationScrollButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isAtBottom, scrollToBottom } = useConversationContext()
  if (isAtBottom) return null
  return (
    <button
      type="button"
      onClick={scrollToBottom}
      className={cn(
        'sticky bottom-2 left-auto ml-auto mr-2 mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-xs transition-colors hover:border-[var(--border-color-hover)] hover:bg-[var(--surface-hover)] dark:text-neutral-100',
        className
      )}
      aria-label="Scroll to bottom"
      {...props}
    >
      <span>Jump to newest</span>
    </button>
  )
}


