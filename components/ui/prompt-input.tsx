'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type PromptInputContextValue = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
}

const PromptInputContext =
  React.createContext<PromptInputContextValue | null>(null)

function usePromptInputContext() {
  return React.useContext(PromptInputContext)
}

interface PromptInputProps
  extends React.HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
}

/**
 * PromptInput
 *
 * A PromptKit-style input container that mirrors the component API from:
 * https://www.prompt-kit.com/docs/prompt-input
 */
export function PromptInput({
  isLoading,
  value,
  onValueChange,
  maxHeight = 240,
  onSubmit,
  className,
  ...props
}: PromptInputProps) {
  const contextValue = React.useMemo(
    () => ({ isLoading, value, onValueChange, maxHeight, onSubmit }),
    [isLoading, value, onValueChange, maxHeight, onSubmit],
  )

  return (
    <PromptInputContext.Provider value={contextValue}>
      <div
        className={cn(
          // Layout
          'flex flex-col gap-1',
          // Shape & border
          'rounded-3xl border pl-5 pr-2 py-3',
          // Light theme (fully opaque)
          'border-zinc-300 bg-zinc-50 text-zinc-900',
          // Dark theme (fully opaque)
          'dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50',
          // Subtle shadow
          'shadow-sm shadow-black/20',
          className,
        )}
        {...props}
      />
    </PromptInputContext.Provider>
  )
}

interface PromptInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  disableAutosize?: boolean
}

export function PromptInputTextarea({
  className,
  rows = 1,
  disableAutosize, // accepted for API compatibility; currently not used
  onKeyDown,
  disabled,
  ...props
}: PromptInputTextareaProps) {
  const context = usePromptInputContext()

  const controlledValue =
    props.value !== undefined ? props.value : context?.value
  const isDisabled =
    disabled !== undefined ? disabled : context?.isLoading
  const maxHeight = context?.maxHeight ?? 240

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (
    event,
  ) => {
    props.onChange?.(event)
    context?.onValueChange?.(event.target.value)
  }

  const handleKeyDown: React.KeyboardEventHandler<
    HTMLTextAreaElement
  > = (event) => {
    onKeyDown?.(event)

    if (
      event.defaultPrevented ||
      !context?.onSubmit ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return
    }

    event.preventDefault()
    context.onSubmit()
  }

  return (
    <textarea
      value={controlledValue}
      disabled={isDisabled}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      style={{ maxHeight, ...(props.style ?? {}) }}
      rows={rows}
      className={cn(
        'flex-1 w-full resize-none bg-transparent text-sm text-zinc-900 outline-none ring-0 transition',
        'placeholder:text-zinc-400',
        'focus:border-none focus:ring-0 focus:outline-none',
        'dark:text-zinc-50 dark:placeholder:text-zinc-500',
        className,
      )}
      {...props}
    />
  )
}

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>

export function PromptInputActions({
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center justify-end gap-2',
        className,
      )}
      {...props}
    />
  )
}

interface PromptInputActionProps
  extends React.HTMLAttributes<HTMLDivElement> {
  tooltip?: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}

export function PromptInputAction({
  tooltip,
  disabled,
  className,
  children,
  ...props
}: PromptInputActionProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      aria-disabled={disabled ? 'true' : undefined}
      title={typeof tooltip === 'string' ? tooltip : undefined}
      {...props}
    >
      {children}
    </div>
  )
}


