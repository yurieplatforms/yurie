"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { createPortal } from 'react-dom'

type Props = {
  title: string
  content: string
  inline?: boolean
  className?: string
  portalTargetId?: string
}

export default function AskAISummary({ title, content, inline, className, portalTargetId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>("")
  const abortRef = useRef<AbortController | null>(null)

  const renderedHtml = useMemo(() => {
    if (!summary) return ''
    try {
      return marked.parse(summary) as string
    } catch {
      return summary
    }
  }, [summary])

  const prompt = useMemo(() => {
    const stripped = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return `Summarize the following Yurie Blog/Research post in 5-7 concise bullet points.\n- Focus on the key facts and outcomes.\n- Keep each bullet under 20 words.\n- End with \\\"Why it matters\\\": 1 short line.\n\nTitle: ${title}\n\nContent:\n${stripped}`
  }, [title, content])

  // Abort is handled on unmount; clicking while loading is disabled (no stop action)

  const onAsk = useCallback(async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setSummary('')
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: prompt },
          ],
          provider: 'gateway',
          gatewayModel: 'anthropic/claude-3.5-haiku',
        }),
        signal: ac.signal,
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed: ${res.status}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const sanitize = (raw: string): string => {
        if (!raw) return raw
        let txt = raw
        // Remove internal tags: thinking, meta, images, revised prompts
        txt = txt.replace(/<(?:thinking|response_id|summary_text|incomplete|revised_prompt|image|image_partial):[^>]*>/gi, '')
        // Remove legacy inline data URLs like [data:image...]
        txt = txt.replace(/\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/g, '')
        // Strip Sources block if present
        txt = txt.replace(/\n+Sources:\n(?:- .*\n)*/gi, '\n')
        // Collapse excessive blank lines
        txt = txt.replace(/\n{3,}/g, '\n\n')
        return txt
      }
      let out = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const clean = sanitize(chunk)
        // Skip whitespace-only deltas to avoid growing an empty panel
        if (/[^\s]/.test(clean)) {
          out += clean
          setSummary((prev) => prev + clean)
        }
      }
      const finalChunk = decoder.decode()
      if (finalChunk) {
        const clean = sanitize(finalChunk)
        if (/[^\s]/.test(clean)) {
          out += clean
          setSummary((prev) => prev + clean)
        }
      }
      // If nothing meaningful was produced, show a friendly message
      if (!/[^\s]/.test(out)) {
        setSummary('')
        setError('No summary generated. Please try again.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [prompt])

  const handleClick = useCallback(() => {
    if (loading) {
      return
    }
    if (open) {
      setOpen(false)
      setSummary('')
      setError(null)
      return
    }
    onAsk()
  }, [loading, open, onAsk])

  useEffect(() => {
    return () => {
      try { abortRef.current?.abort() } catch {}
    }
  }, [])

  const panel = open && (error || summary) ? (
    <div className="mt-1 rounded-2xl border p-4 text-[13px] leading-snug font-semibold prose prose-neutral dark:prose-invert prose-p:my-0.5 prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0.5 prose-ul:pl-3 prose-ol:pl-3 prose-headings:mt-1 prose-headings:mb-0.5 prose-headings:text-inherit bg-[#F0F0F3] dark:bg-[#0C0C0C] text-[var(--text-primary)] border-[var(--border-color)]">
      {error ? (
        <div className="text-red-600 dark:text-red-400">{error}</div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      )}
    </div>
  ) : null

  const portalTarget = typeof window !== 'undefined' && portalTargetId
    ? document.getElementById(portalTargetId)
    : null

  return (
    <>
      <div className={(inline ? '' : 'mt-4') + (className ? ` ${className}` : '')}>
        {(() => { const isActive = loading || open; return (
        <button
          type="button"
          onClick={handleClick}
          className={
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors text-[var(--text-primary)] dark:bg-[#0C0C0C] dark:active:bg-[#0C0C0C] " +
            (loading ? "cursor-default " : "cursor-pointer ") +
            (isActive
              ? "ring-1 ring-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-accent)] bg-[#F0F0F3]"
              : "border-[var(--border-color)] bg-[#F0F0F3] hover:border-[var(--border-color-hover)]") +
            " active:border-[var(--color-accent)] active:text-[var(--color-accent)] active:bg-[var(--color-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ai-hover-glow" +
            (loading ? " ai-border-glow" : "")
          }
          aria-busy={loading}
          aria-pressed={isActive}
          disabled={loading}
        >
          <img src="/favicon.ico" alt="" className="h-4 w-4" aria-hidden="true" />
          <span className={loading ? 'ai-text-shimmer' : undefined}>{loading ? 'Generating summary…' : 'Ask AI'}</span>
        </button>
        ) })()}
      </div>
      {portalTarget ? createPortal(panel, portalTarget) : panel}
    </>
  )
}


