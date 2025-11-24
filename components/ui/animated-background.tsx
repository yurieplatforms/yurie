'use client'
import { cn } from '@/lib/utils'
import { AnimatePresence, Transition, motion } from 'motion/react'
import {
  Children,
  cloneElement,
  ReactElement,
  useEffect,
  useState,
  useId,
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const uniqueId = useId()

  const handleSetActiveId = (id: string | null) => {
    setActiveId(id)

    if (onValueChange) {
      onValueChange(id)
    }
  }

  useEffect(() => {
    if (defaultValue !== undefined) {
      setActiveId(defaultValue)
    }
  }, [defaultValue])

  return Children.map(children, (child, index) => {
    if (!child || typeof child !== 'object' || !('props' in child)) return null
    const element = child as ReactElement<{ 'data-id': string; className?: string; children?: React.ReactNode }>
    const id = element.props['data-id']

    const interactionProps = enableHover
      ? {
          onMouseEnter: () => handleSetActiveId(id),
          onMouseLeave: () => handleSetActiveId(null),
        }
      : {
          onClick: () => handleSetActiveId(id),
        }

    return cloneElement(
      element,
      {
        key: index,
        className: cn('relative inline-flex', element.props.className),
        'data-checked': activeId === id ? 'true' : 'false',
        ...interactionProps,
      } as any,
      <>
        <AnimatePresence initial={false}>
          {activeId === id && (
            <motion.div
              layoutId={`background-${uniqueId}`}
              className={cn('absolute inset-0', className)}
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
        <div className="z-10">{element.props.children}</div>
      </>,
    )
  })
}
