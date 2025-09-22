'use client'

import * as React from 'react'
import clsx from 'clsx'

type ClassName = string | undefined

function cn(...parts: Array<ClassName | false | null>): string {
  return clsx(parts.filter(Boolean))
}

export function Artifact({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] shadow-xs',
        className
      )}
      {...props}
    />
  )
}

export function ArtifactHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3',
        'border-b border-[var(--border-color)]/80',
        className
      )}
      {...props}
    />
  )
}

export function ArtifactTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-[15px] font-semibold leading-tight text-neutral-900 dark:text-neutral-100',
        className
      )}
      {...props}
    />
  )
}

export function ArtifactDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'mt-0.5 text-[12px] leading-snug text-neutral-500 dark:text-neutral-400',
        className
      )}
      {...props}
    />
  )
}

export function ArtifactActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} {...props} />
  )
}

// Consumers may pass any button-like props; keep minimal footprint without shadcn dependency
type ArtifactActionProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  tooltip?: string
}

export function ArtifactAction({
  className,
  label,
  icon: Icon,
  tooltip,
  ...props
}: ArtifactActionProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--surface)] text-neutral-900 transition-colors hover:border-[var(--border-color-hover)] hover:bg-[var(--surface-hover)] active:scale-[0.98] dark:text-neutral-100',
        className
      )}
      aria-label={label}
      title={tooltip || label}
      {...props}
    >
      {Icon ? <Icon width={16} height={16} aria-hidden="true" /> : null}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function ArtifactClose({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-md px-2 text-[13px] font-medium text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] dark:text-neutral-300 dark:hover:text-neutral-100',
        className
      )}
      {...props}
    />
  )
}

export function ArtifactContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}

export default Artifact


