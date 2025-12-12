'use client'
import { cn } from '@/lib/utils'
import { AnimatePresence, Transition, motion } from 'motion/react'
import {
  Children,
  cloneElement,
  FocusEvent,
  ReactElement,
  useCallback,
  useEffect,
  useId,
  useState,
} from 'react'

export type AnimatedBackgroundProps = {
  children:
    | ReactElement<{ 'data-id': string }>[]
    | ReactElement<{ 'data-id': string }>
  defaultValue?: string
  onValueChange?: (newActiveId: string | null) => void
  className?: string
  transition?: Transition
  enableHover?: boolean
}

export function AnimatedBackground({
  children,
  defaultValue,
  onValueChange,
  className,
  transition,
  enableHover = false,
}: AnimatedBackgroundProps) {
  const [activeId, setActiveId] = useState<string | null>(() => defaultValue ?? null)
  const uniqueId = useId()
  const [pendingClearTimeoutId, setPendingClearTimeoutId] =
    useState<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingTimeout = useCallback(() => {
    setPendingClearTimeoutId((existing) => {
      if (existing) clearTimeout(existing)
      return null
    })
  }, [])

  const handleSetActiveId = useCallback(
    (id: string | null) => {
      clearPendingTimeout()

      if (id === null) {
        const timeoutId = setTimeout(() => {
          setActiveId(null)
          onValueChange?.(null)
          setPendingClearTimeoutId(null)
        }, 50)

        setPendingClearTimeoutId(timeoutId)
        return
      }

      setActiveId(id)
      onValueChange?.(id)
    },
    [clearPendingTimeout, onValueChange],
  )

  useEffect(() => {
    return () => {
      if (pendingClearTimeoutId) {
        clearTimeout(pendingClearTimeoutId)
      }
    }
  }, [pendingClearTimeoutId])

  return Children.map(children, (child) => {
    if (!child || typeof child !== 'object' || !('props' in child)) return null
    const element = child as ReactElement<{ 'data-id': string; className?: string; children?: React.ReactNode }>
    const id = element.props['data-id']

    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
          onFocus: () => handleSetActiveId(id),
          onBlur: (e: FocusEvent<HTMLElement>) => {
            const nextTarget = e.relatedTarget as Node | null
            if (nextTarget && e.currentTarget.contains(nextTarget)) return
            handleSetActiveId(null)
          },
        }
      : {
          onClick: () => handleSetActiveId(id),
        }

    return cloneElement(
      element,
      {
        className: cn('relative', element.props.className),
        'data-checked': activeId === id ? 'true' : 'false',
        ...interactionProps,
      } as unknown as React.HTMLAttributes<HTMLElement>,
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={`background-${uniqueId}`}
              className={cn('pointer-events-none absolute inset-0 will-change-transform', className)}
              transition={transition}
              initial={{ opacity: defaultValue ? 1 : 0 }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
            />
          )}
        </AnimatePresence>
        <div className="z-10 w-full min-w-0">{element.props.children}</div>
      </>,
    )
  })
}
