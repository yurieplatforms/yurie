'use client'

import { useMemo } from 'react'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'
import { Response } from '@/components/ai-elements/response'
import { cn, sanitizeHtml, decodeBase64Utf8 } from '../utils'
import { MessagePart } from '../types'
import { SourcesList } from './MessageComponents'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'

function mergeWithOverlap(chunks: string[], maxOverlap: number = 120): string {
  if (!Array.isArray(chunks) || chunks.length === 0) return ''
  let merged = ''
  for (const nextRaw of chunks) {
    const next = String(nextRaw || '')
    if (!merged) {
      merged = next
      continue
    }
    const maxK = Math.min(maxOverlap, merged.length, next.length)
    let overlap = 0
    for (let k = maxK; k > 0; k--) {
      if (merged.slice(-k) === next.slice(0, k)) {
        overlap = k
        break
      }
    }
    merged += next.slice(overlap)
  }
  return merged
}

function normalizeReasoningText(input: string): string {
  try {
    let s = String(input || '')
    // Collapse duplicate lines that repeat consecutively
    s = s
      .split(/\r?\n/)
      .reduce<string[]>((acc, line) => {
        const trimmed = line.trim()
        const prev = acc.length > 0 ? acc[acc.length - 1] : ''
        if (trimmed && prev.trim() === trimmed) return acc
        acc.push(line)
        return acc
      }, [])
      .join('\n')
    // Collapse immediate duplicate words (case-insensitive)
    s = s.replace(/\b(\w+)(?:\s+\1\b){1,}/gi, '$1')
    // Compress repeated punctuation like "..!!" -> ".!"
    s = s.replace(/([.,!?;:])\1{1,}/g, '$1')
    // Normalize excessive spaces
    s = s.replace(/[ \t]{2,}/g, ' ')
    // Remove accidental double list markers like "- - "
    s = s.replace(/(^|\n)\s*-\s*-\s+/g, '$1- ')
    return s
  } catch {
    return input
  }
}

export function useMarkdownRenderer() {
  return useMemo(() => {
    const instance = new Marked({ gfm: true, breaks: true })
    instance.use({
      renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
          const language = (lang || '').trim().split(/\s+/)[0]
          const html = highlight(text)
          const langClass = language ? `language-${language}` : ''
          const label = language || 'text'
          return `
<div class="chat-code">
  <div class="chat-code-header">
    <span class="chat-code-lang">${label}</span>
    <button type="button" class="chat-copy">Copy</button>
  </div>
  <pre><code class="${langClass}">${html}</code></pre>
</div>`
        },
        codespan({ text }: { text: string }) {
          const html = highlight(text)
          return `<code>${html}</code>`
        },
      },
    })
    return instance
  }, [])
}

export function renderMessageContent(
  role: 'user' | 'assistant',
  content: string,
  status: 'submitted' | 'streaming' | 'ready' | 'error',
  md: Marked
) {
  const legacyBracketPattern =
    '\\[' + 'data:image' + '\\/[a-zA-Z]+;base64,[^\\]]+' + '\\]'
  const pattern = new RegExp(
    `<image_partial:([^>]+)>|<image:([^>]+)>|<reasoning_partial:([^>]+)>|<reasoning:([^>]+)>|<revised_prompt:([^>]+)>|<response_id:([^>]+)>|<summary_text:([^>]+)>|<incomplete:([^>]+)>|<citations:([^>]+)>|${legacyBracketPattern}`,
    'g'
  )
  
  const parts: MessagePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: content.slice(lastIndex, match.index),
      })
    }
    const full = match[0]
    const partialPayload = match[1]
    const finalPayload = match[2]
    const reasoningPartialPayload = match[3]
    const reasoningFinalPayload = match[4]
    const revisedPayload = match[5]
    const responseIdPayload = match[6]
    const summaryPayload = match[7]
    const incompletePayload = match[8]
    const src = partialPayload
      ? partialPayload
      : finalPayload
        ? finalPayload
        : full.startsWith('[')
          ? full.slice(1, -1)
          : ''
    const citationsPayload = match[9]
    if (src) {
      const isPartial = Boolean(partialPayload)
      parts.push({ type: 'image', src, partial: isPartial })
    }
    if (
      typeof reasoningPartialPayload === 'string' &&
      reasoningPartialPayload
    ) {
      parts.push({
        type: 'reasoning',
        value: reasoningPartialPayload,
        partial: true,
      })
    }
    if (typeof reasoningFinalPayload === 'string' && reasoningFinalPayload) {
      parts.push({ type: 'reasoning', value: reasoningFinalPayload })
    }
    if (typeof revisedPayload === 'string' && revisedPayload) {
      parts.push({
        type: 'meta',
        key: 'revised_prompt',
        value: revisedPayload,
      })
    }
    if (typeof responseIdPayload === 'string' && responseIdPayload) {
      parts.push({
        type: 'meta',
        key: 'response_id',
        value: responseIdPayload,
      })
    }
    if (typeof summaryPayload === 'string' && summaryPayload) {
      parts.push({ type: 'meta', key: 'summary_text', value: summaryPayload })
    }
    if (typeof incompletePayload === 'string' && incompletePayload) {
      parts.push({
        type: 'meta',
        key: 'incomplete',
        value: incompletePayload,
      })
    }
    if (typeof citationsPayload === 'string' && citationsPayload) {
      try {
        const parsed = JSON.parse(citationsPayload)
        if (Array.isArray(parsed)) {
          const urls = parsed
            .map((u) => (typeof u === 'string' ? u : String(u)))
            .filter((u) => u && /^(https?:)?\/\//i.test(u))
          if (urls.length > 0) parts.push({ type: 'citations', urls })
        }
      } catch {}
    }
    lastIndex = match.index + full.length
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  const latestPartialIndex = (() => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (p.type === 'image' && p.partial) return i
    }
    return -1
  })()
  const hasFinalImage = parts.some(
    (p) => p.type === 'image' && !p.partial
  )
  const reasoningParts = parts.filter(
    (p): p is Extract<MessagePart, { type: 'reasoning' }> => p.type === 'reasoning'
  )
  const hasFinalReasoning = reasoningParts.some((r) => !r.partial)
  
  const reasoningDecoded = (() => {
    if (hasFinalReasoning) {
      const finals = reasoningParts
        .filter((r) => !r.partial)
        .map((r) => String(r.value))
      const decoded = finals.map(decodeBase64Utf8)
      return normalizeReasoningText(mergeWithOverlap(decoded))
    }
    const partials = reasoningParts
      .filter((r) => r.partial)
      .map((r) => String(r.value))
    if (partials.length === 0) return ''
    const decoded = partials.map(decodeBase64Utf8)
    return normalizeReasoningText(mergeWithOverlap(decoded))
  })()
  const reasoningHtml = reasoningDecoded
    ? sanitizeHtml(md.parse(reasoningDecoded) as string)
    : ''
  return (
    <>
      {role === 'assistant' && reasoningHtml ? (
        <Reasoning className="w-full" isStreaming={status === 'submitted' || status === 'streaming'}>
          <ReasoningTrigger />
          <ReasoningContent>
            <div dangerouslySetInnerHTML={{ __html: reasoningHtml }} />
          </ReasoningContent>
        </Reasoning>
      ) : null}
      {parts.map((p, i) => {
        if (p.type === 'text') {
          if (role === 'assistant') {
            return (
              <Response
                key={i}
                parseIncompleteMarkdown
                allowedImagePrefixes={["*"]}
                allowedLinkPrefixes={["*"]}
              >
                {p.value}
              </Response>
            )
          }
          // Render user text as plain text paragraphs with consistent spacing
          const paragraphs = String(p.value || '').split(/\n{2,}/)
          return (
            <div key={i} className={cn('w-full min-w-0 space-y-3')}>
              {paragraphs.map((para, idx) => (
                <p key={`u-${i}-${idx}`} className={cn('whitespace-pre-wrap break-words')}>
                  {para}
                </p>
              ))}
            </div>
          )
        }
        if (p.type === 'image') {
          const isPartial = p.partial === true
          const isLatestPartial = latestPartialIndex === i
          if (isPartial && (!isLatestPartial || hasFinalImage)) {
            return null
          }
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`img-${i}`}
              src={p.src}
              alt="Generated image"
              className={cn(
                'mt-2 max-w-full rounded border border-neutral-200 dark:border-neutral-800',
                role === 'assistant' ? 'mb-1' : 'mb-3'
              )}
            />
          )
        }
        return null
      })}
      {parts.map((p, i) => {
        if (p.type === 'meta') {
          const meta = p
          // Skip rendering Response ID
          if (meta.key === 'response_id') {
            return null
          }
          const label =
            meta.key === 'revised_prompt'
              ? 'Revised prompt'
              : meta.key === 'summary_text'
                ? 'Summary'
                : 'Status'
          return (
            <div key={`meta-${i}`} className="mt-1 text-xs text-neutral-500">
              <span className="font-medium">{label}:</span> {meta.value}
            </div>
          )
        }
        return null
      })}
      {(() => {
        const latestCitations = (() => {
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i]
            if (p.type === 'citations' && Array.isArray(p.urls)) {
              return p.urls
            }
          }
          return [] as string[]
        })()
        if (role === 'assistant' && latestCitations.length > 0) {
          return <SourcesList urls={latestCitations} />
        }
        return null
      })()}
    </>
  )
}
