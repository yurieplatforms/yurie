'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { highlight } from 'sugar-high'
import { cn } from '@/lib/utils'

type MarkdownMessageProps = {
  content: string
  className?: string
}

export function MarkdownMessage({
  content,
  className,
}: MarkdownMessageProps) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-zinc max-w-none dark:prose-invert',
        'prose-headings:mt-3 prose-headings:mb-1 prose-p:mb-2 prose-p:last:mb-0',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
        'prose-pre:my-2',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Narrowly type this as any to avoid conflicts with react-markdown's internal types,
          // while still being able to use the `inline` hint.
          code(codeProps: any) {
            const {
              inline,
              className: codeClassName,
              children,
              ...props
            } = codeProps

            const codeText = String(children ?? '')

            if (inline) {
              return (
                <code
                  className={cn(
                    'rounded bg-zinc-900/5 px-1 py-0.5 text-[0.85em] dark:bg-zinc-50/10',
                    codeClassName,
                  )}
                  {...props}
                >
                  {codeText}
                </code>
              )
            }

            const html = highlight(codeText)

            return (
              <pre className="my-2 overflow-x-auto rounded-xl bg-zinc-950 text-xs text-zinc-50 dark:bg-zinc-900">
                <code
                  className={cn('block px-3 py-2', codeClassName)}
                  dangerouslySetInnerHTML={{ __html: html }}
                  {...props}
                />
              </pre>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}


