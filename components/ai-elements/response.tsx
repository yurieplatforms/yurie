'use client'

import * as React from 'react'
import { Streamdown } from 'streamdown'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

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

function uniquePlugins<T>(plugins: T[]): T[] {
  return Array.from(new Set(plugins))
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
  const normalizeMathDelimiters = React.useCallback((input: string): string => {
    if (!input) return ''
    const codeBlocks: string[] = []
    const inlineCodes: string[] = []

    let text = input.replace(/```[\s\S]*?```/g, (m) => {
      codeBlocks.push(m)
      return `[[[CODE_BLOCK_${codeBlocks.length - 1}]]]`
    })

    text = text.replace(/`[^`]*`/g, (m) => {
      inlineCodes.push(m)
      return `[[[INLINE_CODE_${inlineCodes.length - 1}]]]`
    })

    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`)
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `$$${inner}$$`)

    text = text.replace(/\[([^\]]*?\\[a-zA-Z][^\]]*?)\](?!\()/g, (_m, inner) => `$$${inner}$$`)

    text = text.replace(/\[\[\[INLINE_CODE_(\d+)\]\]\]/g, (_m, idx) => inlineCodes[Number(idx)] || '')
    text = text.replace(/\[\[\[CODE_BLOCK_(\d+)\]\]\]/g, (_m, idx) => codeBlocks[Number(idx)] || '')
    return text
  }, [])

  const normalizedChildren = React.useMemo(() => normalizeMathDelimiters(children || ''), [children, normalizeMathDelimiters])
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
          <CodeBlock code={text.replace(/\n$/, '')} language={language}>
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

  // Prefer parsing math before GFM to avoid conflicts (e.g., underscores in math)
  const defaultRemarkPlugins = React.useMemo(() => [remarkMath, remarkGfm], [])
  const katexOptions = React.useMemo(
    () => ({ strict: false, throwOnError: false } as any),
    []
  )
  const defaultRehypePlugins = React.useMemo(() => [[rehypeKatex, katexOptions]], [katexOptions])

  const mergedRemarkPlugins = React.useMemo(() => {
    return uniquePlugins([...
      defaultRemarkPlugins,
      ...(remarkPlugins || []),
    ])
  }, [defaultRemarkPlugins, remarkPlugins])

  const mergedRehypePlugins = React.useMemo(() => {
    return uniquePlugins([...
      defaultRehypePlugins,
      ...(rehypePlugins || []),
    ])
  }, [defaultRehypePlugins, rehypePlugins])
  return (
    <div className={className} {...props}>
      <Streamdown
        className="prose prose-neutral dark:prose-invert prose-message"
        parseIncompleteMarkdown={parseIncompleteMarkdown ?? true}
        components={mergedComponents}
        allowedImagePrefixes={allowedImagePrefixes ?? ['*']}
        allowedLinkPrefixes={allowedLinkPrefixes ?? ['*']}
        defaultOrigin={defaultOrigin}
        rehypePlugins={mergedRehypePlugins}
        remarkPlugins={mergedRemarkPlugins}
      >
        {normalizedChildren}
      </Streamdown>
    </div>
  )
}

export default Response


