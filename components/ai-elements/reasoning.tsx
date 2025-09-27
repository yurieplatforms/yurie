'use client'

import * as React from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { Sparkle } from '@phosphor-icons/react'

export type ReasoningProps = React.ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
}

export function Reasoning({ isStreaming, className, children, ...props }: ReasoningProps) {
  const [open, setOpen] = React.useState<boolean>(false)
  React.useEffect(() => {
    if (isStreaming) setOpen(true)
    else setOpen(false)
  }, [isStreaming])
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn('mb-2', className)} {...props}>
      {children}
    </Collapsible>
  )
}

export type ReasoningTriggerProps = React.ComponentProps<typeof CollapsibleTrigger> & {
  title?: string
}

export function ReasoningTrigger({ title = 'Reasoning', className, ...props }: ReasoningTriggerProps) {
  return (
    <CollapsibleTrigger
      className={cn(
        'group inline-flex items-center gap-2 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100',
        className
      )}
      {...props}
    >
      <span className="inline-flex size-6 aspect-square shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface)] text-[var(--color-accent)] leading-none">
        <Sparkle className="size-4" weight="bold" aria-hidden="true" />
      </span>
      <span>{title}</span>
      <svg viewBox="0 0 24 24" className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
    </CollapsibleTrigger>
  )
}

export function ReasoningContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className={cn('overflow-hidden', className)}
      {...props}
    >
      <div className="mt-0 ml-[12px] rounded-lg bg-[var(--color-background)] px-0 py-2">
        <div className="prose-message border-l-[3px] border-neutral-300 pl-3 text-sm leading-relaxed dark:border-neutral-800">
          {children}
        </div>
      </div>
    </CollapsibleContent>
  )
}

export default Reasoning


