"use client"

import { Loader2 } from 'lucide-react'
import { cn } from '@/app/lib/utils'

export function Waiting({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-neutral-600 dark:text-neutral-300 text-sm',
        className
      )}
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <div className="flex items-center">
        <span className="mr-1">Thinking</span>
        <span className="inline-flex gap-1" aria-hidden="true">
          <span
            className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </span>
      </div>
    </div>
  )
}


