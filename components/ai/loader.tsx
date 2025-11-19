'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Shimmer } from '@/components/ai/shimmer'

export type LoaderVariant =
  | 'circular'
  | 'classic'
  | 'pulse'
  | 'pulse-dot'
  | 'dots'
  | 'typing'
  | 'wave'
  | 'bars'
  | 'terminal'
  | 'text-blink'
  | 'text-shimmer'
  | 'loading-dots'

export type LoaderSize = 'sm' | 'md' | 'lg'

export interface LoaderProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: LoaderVariant
  size?: LoaderSize
  /**
   * Text to display for text-based variants.
   * Falls back to `"Thinking..."` when omitted for text variants.
   */
  text?: string
}

const textSizeBySize: Record<LoaderSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

const iconSizeBySize: Record<LoaderSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export function Loader({
  variant = 'pulse',
  size = 'md',
  text,
  className,
  ...props
}: LoaderProps) {
  const resolvedText =
    text ??
    (variant === 'terminal'
      ? 'Loading'
      : 'Thinking...')

  // Text-only variants -------------------------------------------------------
  if (variant === 'text-shimmer') {
    return (
      <span
        className={cn('inline-flex items-center', className)}
        {...props}
      >
        <Shimmer
          as="span"
          className={cn(textSizeBySize[size])}
          duration={2.5}
        >
          {resolvedText}
        </Shimmer>
      </span>
    )
  }

  if (variant === 'text-blink') {
    return (
      <span
        className={cn(
          'inline-flex items-center',
          textSizeBySize[size],
          className,
        )}
        {...props}
      >
        <span className="loader-text-blink">
          {resolvedText}
        </span>
      </span>
    )
  }

  if (variant === 'loading-dots') {
    return (
      <span
        className={cn(
          'inline-flex items-center',
          textSizeBySize[size],
          className,
        )}
        {...props}
      >
        <span className="loader-loading-dots">
          {resolvedText}
        </span>
      </span>
    )
  }

  // Icon-based variants ------------------------------------------------------
  const iconSize = iconSizeBySize[size]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin dark:border-zinc-700 dark:border-t-zinc-100',
          iconSize,
        )}
        aria-hidden="true"
      />

      {text && (
        <span className={textSizeBySize[size]}>
          {text}
        </span>
      )}
    </span>
  )
}


