'use client'

import * as React from 'react'
import { Streamdown } from 'streamdown'
import { CodeBlock, CodeBlockCopyButton } from '@/app/components/ai-elements/code-block'

export type ResponseProps = React.HTMLAttributes<HTMLDivElement> & {
  children: string
  parseIncompleteMarkdown?: boolean
  components?: Record<string, React.ComponentType<any>>
  allowedImagePrefixes?: string[]
  allowedLinkPrefixes?: string[]
  defaultOrigin?: string
  rehypePlugins?: any[]
  remarkPlugins?: any[]
}

export function Response({
  children,
  className,
  parseIncompleteMarkdown,
  components,
  allowedImagePrefixes,
  allowedLinkPrefixes,
  defaultOrigin,
  rehypePlugins,
  remarkPlugins,
  ...props
}: ResponseProps) {
  const defaultComponents = React.useMemo(() => {
    const Pre = ({ children }: any) => {
      try {
        const only = React.Children.only(children as any) as any
        const className = (only?.props?.className as string) || ''
        const languageMatch = /language-([\w-]+)/.exec(className)
        const language = languageMatch ? languageMatch[1] : undefined
        const raw = only?.props?.children
        const text = Array.isArray(raw) ? raw.join('') : String(raw ?? '')
        return (
          <CodeBlock code={text.replace(/\n$/, '')} language={language} showLineNumbers>
            <CodeBlockCopyButton />
          </CodeBlock>
        )
      } catch {
        return <pre>{children}</pre>
      }
    }
    return { pre: Pre } as Record<string, React.ComponentType<any>>
  }, [])

  const mergedComponents = React.useMemo(() => {
    return { ...defaultComponents, ...(components || {}) }
  }, [components, defaultComponents])
  return (
    <div className={className} {...props}>
      <Streamdown
        className="prose prose-neutral dark:prose-invert prose-message"
        parseIncompleteMarkdown={parseIncompleteMarkdown}
        components={mergedComponents}
        allowedImagePrefixes={allowedImagePrefixes}
        allowedLinkPrefixes={allowedLinkPrefixes}
        defaultOrigin={defaultOrigin}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
      >
        {children || ''}
      </Streamdown>
    </div>
  )
}

export default Response


