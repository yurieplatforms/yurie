"use client"

import { memo, type ComponentProps } from 'react'
import { Streamdown } from 'streamdown'
import { CodeBlock, CodeBlockCopyButton } from './codeblock'
import { cn } from '@/app/lib/utils'

type ResponseProps = ComponentProps<typeof Streamdown>

export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => {
    const mergedComponents: any = {
      ...(components as any),
      // Map unknown XML-like tags emitted by some models to safe spans
      // Prevents React warnings like: "The tag <argument> is unrecognized in this browser"
      argument({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      // Common vendor-specific tags observed in model outputs
      invoke({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      tool({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      function({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      tool_call({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      tool_name({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      arguments({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      thought({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      thinking({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      output({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
      result({ children, ...rest }: any) {
        return <span {...rest}>{children}</span>
      },
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
      code({ className: codeClassName, children, ...codeProps }: any) {
        // Keep inline code inline to avoid placing block elements inside <p>
        return (
          <code className={codeClassName} {...codeProps}>
            {children}
          </code>
        )
      },
    }

    return (
      <Streamdown
        className={cn('size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}
        controls={{ code: false, table: false, mermaid: false }}
        components={mergedComponents}
        {...props}
      />
    )
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
)

Response.displayName = 'Response'