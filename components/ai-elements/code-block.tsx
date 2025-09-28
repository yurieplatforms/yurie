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
          'group relative w-full overflow-hidden rounded-xl border border-[var(--code-border)] bg-[var(--color-chat-input)] shadow-xs ' +
          (className ? ` ${className}` : '')
        }
        {...props}
      >
        <div className="flex items-center justify-between border-b border-[var(--code-border)] bg-gradient-to-br from-[var(--code-header-start)] to-[var(--code-header-end)] px-3 py-2">
          <span className="rounded-full border border-[var(--code-border)] bg-[var(--color-chat-input)] px-2 py-0.5 text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
            {language || 'text'}
          </span>
          <div className="flex items-center gap-1">
            {children ? (
              children
            ) : (
              <button
                type="button"
                onClick={handleCopyInternal}
                title={copied ? 'Copied' : 'Copy to clipboard'}
                aria-label={copied ? 'Copied' : 'Copy to clipboard'}
                className="chat-copy"
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
            )}
          </div>
        </div>
        <div className="bg-[var(--color-chat-input)]">
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
      className={'chat-copy' + (className ? ` ${className}` : '')}
      {...props}
    >
      {copied ? 'Copied' : children || 'Copy'}
    </button>
  )
}

export default CodeBlock


