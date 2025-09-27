'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type CollapsibleRootProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

type CollapsibleContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

export function Collapsible({ open, defaultOpen, onOpenChange, className, children, ...props }: CollapsibleRootProps) {
  const isControlled = typeof open === 'boolean'
  const [internalOpen, setInternalOpen] = React.useState<boolean>(Boolean(defaultOpen))
  const currentOpen = isControlled ? Boolean(open) : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      if (onOpenChange) onOpenChange(next)
    },
    [isControlled, onOpenChange]
  )
  const ctx = React.useMemo<CollapsibleContextValue>(() => ({ open: currentOpen, setOpen }), [currentOpen, setOpen])
  return (
    <CollapsibleContext.Provider value={ctx}>
      <div data-state={currentOpen ? 'open' : 'closed'} className={cn(className)} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

export type CollapsibleTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function CollapsibleTrigger({ className, onClick, children, ...props }: CollapsibleTriggerProps) {
  const ctx = React.useContext(CollapsibleContext)
  const handleClick = React.useCallback<NonNullable<typeof onClick>>(
    (e) => {
      if (onClick) onClick(e)
      if (!e.defaultPrevented && ctx) ctx.setOpen(!ctx.open)
    },
    [onClick, ctx]
  )
  const state = ctx?.open ? 'open' : 'closed'
  return (
    <button type="button" data-state={state} className={cn('group', className)} onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

export type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement>

export function CollapsibleContent({ className, children, ...props }: CollapsibleContentProps) {
  const ctx = React.useContext(CollapsibleContext)
  const open = Boolean(ctx?.open)
  return (
    <div
      data-state={open ? 'open' : 'closed'}
      aria-hidden={!open}
      className={cn(open ? '' : 'hidden', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export default Collapsible


