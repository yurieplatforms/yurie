'use client'

import * as React from 'react'
import { Check, CopySimple } from '@phosphor-icons/react'
import { highlight } from 'sugar-high'

const CodeBlockContext = React.createContext<string | null>(null)

type CodeBlockProps = React.HTMLAttributes<HTMLDivElement> & {
  code: string
  language?: string
  children?: React.ReactNode
}

export function CodeBlock({
  code,
  language,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const preRef = React.useRef<HTMLPreElement>(null)
  const [copied, setCopied] = React.useState(false)

  const handleCopyInternal = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      const id = window.setTimeout(() => setCopied(false), 2000)
      return () => window.clearTimeout(id)
    } catch {}
    return undefined
  }, [code])

  const highlightedCode = React.useMemo(() => {
    try {
      return highlight(code)
    } catch {
      return code
    }
  }, [code])

  return (
    <CodeBlockContext.Provider value={code}>
      <div
        className={
          'group relative w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface)]/70 shadow-xs backdrop-blur ' +
          (className ? ` ${className}` : '')
        }
        {...props}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)]/80 bg-gradient-to-br from-[#f8f9fa] to-[#f1f3f4] px-3 py-2 dark:from-[#0d1117] dark:to-[#161b22]">
          <div className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-flex size-[9px] rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: '#ff5f57' }} />
            <span aria-hidden className="inline-flex size-[9px] rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: '#ffbd2e' }} />
            <span aria-hidden className="inline-flex size-[9px] rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: '#27c93f' }} />
            <span className="ml-2 rounded-full border border-[var(--border-color)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-300">
              {language || 'text'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {children}
            {!children ? (
              <button
                type="button"
                onClick={handleCopyInternal}
                title={copied ? 'Copied' : 'Copy to clipboard'}
                aria-label={copied ? 'Copied' : 'Copy to clipboard'}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--surface)] px-2.5 text-[11px] font-medium text-neutral-700 transition-colors hover:border-[var(--border-color-hover)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 dark:text-neutral-200 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" weight="bold" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <CopySimple className="size-3.5" weight="bold" aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
        <div className="bg-gradient-to-br from-[#f8f9fa] to-[#f1f3f4] dark:from-[#0d1117] dark:to-[#161b22]">
          <pre ref={preRef} className="m-0 overflow-x-auto p-3 font-mono text-[13px] leading-relaxed bg-transparent">
          <code 
            className={language ? `language-${language}` : undefined}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
          </pre>
        </div>
      </div>
    </CodeBlockContext.Provider>
  )
}

type CodeBlockCopyButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onCopy?: () => void
  onError?: (error: Error) => void
  timeout?: number
  targetText?: string
}

export function CodeBlockCopyButton({
  onCopy,
  onError,
  timeout = 2000,
  targetText,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) {
  const [copied, setCopied] = React.useState(false)
  const ctx = React.useContext(CodeBlockContext)
  const handleCopy = React.useCallback(async () => {
    try {
      const text = targetText ?? ctx ?? ''
      await navigator.clipboard.writeText(text)
      setCopied(true)
      onCopy?.()
      const id = window.setTimeout(() => setCopied(false), timeout)
      return () => window.clearTimeout(id)
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Copy failed')
      onError?.(err)
    }
    return undefined
  }, [onCopy, onError, targetText, timeout, ctx])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        'inline-flex items-center rounded-md border border-[var(--border-color)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-[var(--surface-hover)] dark:text-neutral-200 cursor-pointer' +
        (className ? ` ${className}` : '')
      }
      {...props}
    >
      {copied ? 'Copied' : children || 'Copy'}
    </button>
  )
}

export default CodeBlock


