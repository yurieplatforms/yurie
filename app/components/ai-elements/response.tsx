"use client"

import { memo, type ComponentProps } from 'react'
import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Streamdown } from 'streamdown'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'


