"use client"

import { memo, type ComponentProps } from 'react'
import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Streamdown } from 'streamdown'
import { CodeBlock, CodeBlockCopyButton } from './code-block'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => (
    <Streamdown
      className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
      controls={{ code: false, table: true, mermaid: true }}
      components={{
        ...components,
        pre(preProps: any) {
          const child: any = Array.isArray(preProps.children) ? preProps.children[0] : preProps.children
          const codeClassName = child?.props?.className || ''
          const match = /language-(\w+)/.exec(codeClassName)
          const raw = child?.props?.children
          const code = typeof raw === 'string' ? raw : String(Array.isArray(raw) ? raw.join('') : raw || '')
          return (
            <CodeBlock code={code.replace(/\n$/, '')} language={match?.[1] || 'text'} showLineNumbers>
              <CodeBlockCopyButton />
            </CodeBlock>
          )
        },
        code({ inline, className: codeClassName, children, ...codeProps }) {
          // Keep inline code inline to avoid placing block elements inside <p>
          return (
            <code className={codeClassName} {...codeProps}>
              {children}
            </code>
          )
        },
      }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'


