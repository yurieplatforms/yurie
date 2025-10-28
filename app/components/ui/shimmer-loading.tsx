"use client"

import { cn } from '@/app/lib/utils'
import { TextShimmer } from './text-shimmer'

export function ShimmerLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 py-2", className)}>
      <TextShimmer
        duration={1.5}
        className="text-sm font-medium [--base-color:theme(colors.neutral.400)] [--base-gradient-color:theme(colors.neutral.600)] dark:[--base-color:theme(colors.neutral.600)] dark:[--base-gradient-color:theme(colors.neutral.300)]"
      >
        Thinking...
      </TextShimmer>
    </div>
  )
}

