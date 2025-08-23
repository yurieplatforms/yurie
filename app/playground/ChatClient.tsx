"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { ModelSelector } from '../components/model-selector'
import { Marked } from 'marked'
import { highlight } from 'sugar-high'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [model, setModel] = useState<string>('gpt-5')
  const outputRef = useRef<HTMLDivElement>(null)

  const placeholder = useMemo(
    () => 'Ask me anything...',
    []
  )

  // Configure a markdown parser with code highlighting once
  const md = useMemo(() => {
    const instance = new Marked({ gfm: true, breaks: true })
    instance.use({
      renderer: {
        code({ text, lang }) {
          const language = (lang || '').trim().split(/\s+/)[0]
          const html = highlight(text)
          const langClass = language ? `language-${language}` : ''
          const label = language || 'text'
          return `
<div class=\"chat-code\">
  <div class=\"chat-code-header\">
    <span class=\"chat-code-lang\">${label}</span>
    <button type=\"button\" class=\"chat-copy\">Copy</button>
  </div>
  <pre><code class=\"${langClass}\">${html}</code></pre>
</div>`
        },
        codespan({ text }) {
          const html = highlight(text)
          return `<code>${html}</code>`
        },
      },
    })
    return instance
  }, [])

  // Attach a delegated handler for copy buttons inside streamed messages
  useEffect(() => {
    const root = outputRef.current
    if (!root) return
    const handle = (e: Event) => {
      const target = e.target as HTMLElement | null
      const btn = target?.closest('.chat-copy') as HTMLButtonElement | null
      if (!btn) return
      const wrapper = btn.closest('.chat-code') as HTMLElement | null
      const codeEl = wrapper?.querySelector('pre code') as HTMLElement | null
      const text = codeEl?.textContent || ''
      try {
        navigator.clipboard.writeText(text)
        const previous = btn.textContent
        btn.textContent = 'Copied'
        setTimeout(() => {
          btn.textContent = previous || 'Copy'
        }, 1200)
      } catch {}
    }
    root.addEventListener('click', handle)
    return () => root.removeEventListener('click', handle)
  }, [])

  // Very small sanitizer to prevent injected HTML from altering the page
  function sanitizeHtml(html: string): string {
    if (!html) return html
    // Remove dangerous whole tags (and their content where applicable)
    const blockedContentTags = ['script', 'style', 'title', 'iframe', 'object', 'embed', 'noscript']
    const contentTagPattern = new RegExp(`<\\s*(${blockedContentTags.join('|')})\\b[\\s\\S]*?<\\/\\s*\\1\\s*>`, 'gi')
    html = html.replace(contentTagPattern, '')

    // Remove dangerous void/standalone tags
    const blockedVoidTags = ['link', 'meta', 'base', 'form', 'input', 'select', 'option', 'textarea', 'frame', 'frameset']
    const voidTagPattern = new RegExp(`<\\s*(${blockedVoidTags.join('|')})\\b[^>]*>`, 'gi')
    html = html.replace(voidTagPattern, '')

    // Strip inline event handlers like onclick="..."
    html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

    // Neutralize javascript: URLs in href/src
    html = html.replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')

    return html
  }

  function renderMessageContent(role: 'user' | 'assistant', content: string) {
    // Supported image tokens:
    // 1) <image:data:image/<type>;base64,...>
    // 2) Legacy square-bracket token with data URL
    const legacyBracketPattern = "\\[" + "data:image" + "\\/[a-zA-Z]+;base64,[^\\]]+" + "\\]"
    const pattern = new RegExp(
      `<image:([^>]+)>|${legacyBracketPattern}`,
      'g'
    )
    const parts: Array<{ type: 'text'; value: string } | { type: 'image'; src: string }> = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
      }
      const full = match[0]
      const anglePayload = match[1]
      const src = anglePayload
        ? anglePayload
        : full.startsWith('[')
          ? full.slice(1, -1)
          : ''
      if (src) {
        parts.push({ type: 'image', src })
      }
      lastIndex = match.index + full.length
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.slice(lastIndex) })
    }

    let labelInjected = false
    const speaker = role === 'user' ? 'You' : 'Yurie'
    return (
      <>
        {parts.map((p, i) => {
          if (p.type === 'text') {
            const rawHtml = md.parse(p.value) as string
            const isParagraph = /^\s*<p[>\s]/.test(rawHtml)
            if (!labelInjected) {
              labelInjected = true
              if (isParagraph) {
                const withLabel = rawHtml.replace(
                  /<p(.*?)>/,
                  `<p$1><span class=\\"font-semibold mr-2\\">${speaker}:&nbsp;</span>`
                )
                return (
                  <div
                    key={i}
                    className="prose-message dark:prose-invert font-sans"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(withLabel) }}
                  />
                )
              }
              return (
                <div key={`block-${i}`} className="prose-message dark:prose-invert font-sans">
                  <div className="font-semibold mb-2">{speaker}:</div>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }} />
                </div>
              )
            }
            return (
              <div
                key={i}
                className="prose-message dark:prose-invert font-sans"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(rawHtml) }}
              />
            )
          }
          // image part
          if (!labelInjected) {
            labelInjected = true
            return (
              <div key={i} className="prose-message dark:prose-invert font-sans">
                <span className="font-semibold mr-2">{speaker}: </span>
                <img
                  src={p.src}
                  alt="Generated image"
                  className="mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full"
                />
              </div>
            )
          }
          return (
            <img
              key={i}
              src={p.src}
              alt="Generated image"
              className="mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full"
            />
          )
        })}
      </>
    )
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages: ChatMessage[] = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setIsLoading(true)

    try {
      // Strip embedded base64 images before sending to the server to keep payloads small
      const stripImageData = (text: string): string => {
        const angleTag = /<image:[^>]+>/gi
        const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
        const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
        return text
          .replace(angleTag, '[image omitted]')
          .replace(bracketDataUrl, '[image omitted]')
          .replace(bareDataUrl, '[image omitted]')
      }
      const payloadMessages = nextMessages.map((m) => ({ ...m, content: stripImageData(m.content) }))
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages, model }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      // Add placeholder assistant message to preserve previous assistant turns
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      // Stream chunks
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = { role: 'assistant', content: assistantText }
          } else {
            updated.push({ role: 'assistant', content: assistantText })
          }
          return updated
        })
        // Keep view scrolled
        queueMicrotask(() => {
          outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
        })
      }

      // Flush any remaining decoded bytes
      const finalChunk = decoder.decode()
      if (finalChunk) {
        assistantText += finalChunk
        setMessages((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
            updated[lastIndex] = { role: 'assistant', content: assistantText }
          }
          return updated
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `There was an error: ${message}` },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section>
      <h1 className="mb-8 text-2xl font-semibold tracking-tighter">Playground</h1>
      <div className="w-full">
        <div
          ref={outputRef}
          className="border border-neutral-200 dark:border-neutral-800 rounded px-3 pt-2 pb-3 h-[32rem] overflow-y-auto text-sm font-sans"
        >
          {messages.length === 0 ? (
            <p className="text-neutral-500">Yurie is ready. Start the conversation below.</p>
          ) : (
            messages.map((m, i) => {
              const isFirst = i === 0
              const speakerChanged = !isFirst && messages[i - 1].role !== m.role
              const topMarginClass = isFirst ? 'mt-1' : speakerChanged ? 'mt-2' : 'mt-0.5'
              return (
                <div key={i} className={`${topMarginClass} mb-0`}>
                  <div className="min-w-0 w-full">
                    {renderMessageContent(m.role, m.content)}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <form onSubmit={sendMessage} className="mt-3 flex items-center gap-2" aria-busy={isLoading}>
          <ModelSelector
            value={model}
            onChange={setModel}
          />
          <input
            className="stable-input flex-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-3 py-2 outline-none transform-gpu will-change-transform placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            aria-label="Send message"
            className="rounded border border-neutral-200 dark:border-neutral-800 bg-white text-black dark:bg-black dark:text-white h-10 w-10 flex items-center justify-center"
          >
            {isLoading ? (
              <div
                className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin"
                aria-hidden="true"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </section>
  )
}