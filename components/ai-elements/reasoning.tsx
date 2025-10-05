'use client'

import * as React from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { Lightbulb } from '@phosphor-icons/react'

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
    <Collapsible open={open} onOpenChange={setOpen} className={cn('mb-2 mt-4 sm:mt-5', className)} {...props}>
      {children}
    </Collapsible>
  )
}

export type ReasoningTriggerProps = React.ComponentProps<typeof CollapsibleTrigger> & {
  title?: string
  isStreaming?: boolean
}

export function ReasoningTrigger({ title = 'Thought', isStreaming, className, ...props }: ReasoningTriggerProps) {
  return (
    <CollapsibleTrigger
      className={cn(
        'group inline-flex h-9 items-center gap-1.5 rounded-full border border-transparent px-3 text-xs font-medium transition-colors backdrop-blur-sm bg-transparent hover:bg-[var(--color-pill-hover)] active:border-[var(--border-color-hover)] active:bg-[var(--color-pill-active)] text-[#807d78] hover:text-[#807d78] dark:text-[#807d78] dark:hover:text-[#807d78] cursor-pointer',
        className
      )}
      {...props}
    >
      <Lightbulb className="size-4" weight="bold" aria-hidden="true" />
      <span className={isStreaming ? 'ai-text-shimmer-white' : undefined}>{title}</span>
      <svg viewBox="0 0 24 24" className="size-4 text-[#807d78] dark:text-[#807d78] transition-transform group-data-[state=open]:rotate-180" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
    </CollapsibleTrigger>
  )
}

export function ReasoningContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className={cn('overflow-hidden mt-3', className)}
      {...props}
    >
      <div className="mt-0 ml-[18px] rounded-lg bg-[var(--color-background)] px-0 py-2">
        <div className="prose-message border-l-[3px] border-neutral-300 pl-3 text-sm leading-relaxed dark:border-neutral-800">
          {children}
        </div>
      </div>
    </CollapsibleContent>
  )
}

export default Reasoning


