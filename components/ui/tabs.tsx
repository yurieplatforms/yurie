'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

function useTabsContext() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs component')
  }
  return context
}

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(
    defaultValue || ''
  )

  const value = controlledValue !== undefined ? controlledValue : internalValue
  const setValue = React.useCallback(
    (newValue: string) => {
      if (controlledValue === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [controlledValue, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        // Ultra-minimal tabs container with full-width separator inline with tab underlines
        'relative w-full',
        className
      )}
    >
      <div
        className="inline-flex items-end gap-2 relative z-10"
        role="tablist"
      >
        {children}
      </div>
      <div className="absolute bottom-[6px] left-0 right-0 h-[1px] bg-neutral-300/60 dark:bg-neutral-700/60" />
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled = false,
}: TabsTriggerProps) {
  const { value: selectedValue, onValueChange } = useTabsContext()
  const isSelected = selectedValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => !disabled && onValueChange(value)}
      className={cn(
        // Minimal professional tabs - subtle and clean
        'group relative px-3 py-1.5 cursor-pointer select-none',
        'transition-all duration-200 ease-out',
        'disabled:pointer-events-none disabled:opacity-50',
        'rounded-t-lg',
        className
      )}
    >
      <span
        className={cn(
          'relative flex items-center gap-1.5 text-[13px] font-semibold border-b-[2.5px] pb-3.5',
          'transition-all duration-200 ease-out',
          isSelected
            ? 'text-neutral-900 dark:text-neutral-50 border-neutral-900 dark:border-neutral-50'
            : 'text-neutral-500 dark:text-neutral-400 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
        )}
      >
        {children}
      </span>
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue } = useTabsContext()

  if (selectedValue !== value) {
    return null
  }

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  )
}

