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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inputImages, setInputImages] = useState<string[]>([])
  const [lastResponseId, setLastResponseId] = useState<string | null>(null)
  const [useWebSearch, setUseWebSearch] = useState<boolean>(
    String(process.env.NEXT_PUBLIC_ENABLE_WEB_SEARCH || '').toLowerCase() === 'true'
  )
  const defaultWeb = String(process.env.NEXT_PUBLIC_ENABLE_WEB_SEARCH || '').toLowerCase() === 'true'
  type ReasoningEffort = 'low' | 'medium' | 'high'
  const [selectedTool, setSelectedTool] = useState<'file' | 'web' | 'r_low' | 'r_medium' | 'r_high'>(
    defaultWeb ? 'web' : 'r_high'
  )
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>('high')
  const [thinkingOpen, setThinkingOpen] = useState<boolean>(false)
  const [thinkingText, setThinkingText] = useState<string>('')
  // Advanced web search settings removed; server enforces sources and high context

  
  
  

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
      `<image_partial:([^>]+)>|<image:([^>]+)>|<revised_prompt:([^>]+)>|<response_id:([^>]+)>|<summary_text:([^>]+)>|<incomplete:([^>]+)>|${legacyBracketPattern}`,
      'g'
    )
    const parts: Array<
      { type: 'text'; value: string } |
      { type: 'image'; src: string; partial?: boolean } |
      { type: 'meta'; key: 'revised_prompt' | 'response_id' | 'summary_text' | 'incomplete'; value: string }
    > = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
      }
      const full = match[0]
      const partialPayload = match[1]
      const finalPayload = match[2]
      const revisedPayload = match[3]
      const responseIdPayload = match[4]
      const summaryPayload = match[5]
      const incompletePayload = match[6]
      const src = partialPayload
        ? partialPayload
        : finalPayload
          ? finalPayload
          : full.startsWith('[')
            ? full.slice(1, -1)
            : ''
      if (src) {
        const isPartial = Boolean(partialPayload)
        parts.push({ type: 'image', src, partial: isPartial })
      }
      if (typeof revisedPayload === 'string' && revisedPayload) {
        parts.push({ type: 'meta', key: 'revised_prompt', value: revisedPayload })
      }
      if (typeof responseIdPayload === 'string' && responseIdPayload) {
        parts.push({ type: 'meta', key: 'response_id', value: responseIdPayload })
      }
      if (typeof summaryPayload === 'string' && summaryPayload) {
        parts.push({ type: 'meta', key: 'summary_text', value: summaryPayload })
      }
      if (typeof incompletePayload === 'string' && incompletePayload) {
        parts.push({ type: 'meta', key: 'incomplete', value: incompletePayload })
      }
      lastIndex = match.index + full.length
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.slice(lastIndex) })
    }

    // All <thinking:...> tokens are stripped during streaming; nothing to do here

    let labelInjected = false

    // Coalesce partial frames: render only the latest partial until a final image appears
    const latestPartialIndex = (() => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        if ((p as any).type === 'image' && (p as any).partial) return i
      }
      return -1
    })()
    const hasFinalImage = parts.some((p) => (p as any).type === 'image' && !(p as any).partial)
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
          if (p.type === 'image') {
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
            // Only render latest partial image; once a final image arrives, ignore older partials
            const isPartial = p.partial === true
            const isLatestPartial = latestPartialIndex === i
            if (isPartial && (!isLatestPartial || hasFinalImage)) {
              return null
            }
            return (
              <img
                key={i}
                src={p.src}
                alt="Generated image"
                className="mt-2 rounded border border-neutral-200 dark:border-neutral-800 max-w-full"
              />
            )
          }
          return null
        })}
        {parts.map((p, i) => {
          if ((p as any).type === 'meta') {
            const meta = p as any
            const label =
              meta.key === 'revised_prompt'
                ? 'Revised prompt'
                : meta.key === 'response_id'
                  ? 'Response ID'
                  : meta.key === 'summary_text'
                    ? 'Reasoning summary'
                    : 'Status'
            return (
              <div key={`meta-${i}`} className="text-xs text-neutral-500 mt-1">
                <span className="font-medium">{label}:</span> {meta.value}
              </div>
            )
          }
          return null
        })}
      </>
    )
  }

  // Keep web search flag in sync with the selected tool
  useEffect(() => {
    setUseWebSearch(selectedTool === 'web')
  }, [selectedTool])

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
      // reset thinking on new request
      setThinkingText('')
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
        body: JSON.stringify({
          messages: payloadMessages,
          model,
          inputImages,
          useWebSearch,
          previousResponseId: lastResponseId,
          // Advanced options removed; server uses defaults
          webSearchOptions: undefined,
          reasoningEffort,
          
          
          
        }),
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
        const chunk = decoder.decode(value, { stream: true })
        // Peel out thinking tokens and accumulate separately without showing in assistant message
        const thoughtRegex = /<thinking:([^>]+)>/g
        let cleanChunk = chunk
        let tm: RegExpExecArray | null
        while ((tm = thoughtRegex.exec(chunk)) !== null) {
          const delta = tm[1]
          if (delta) setThinkingText((prev) => prev + delta)
        }
        cleanChunk = cleanChunk.replace(thoughtRegex, '')
        assistantText += cleanChunk
        // Capture response_id for follow-ups
        const idMatch = /<response_id:([^>]+)>/g.exec(cleanChunk)
        if (idMatch && idMatch[1]) setLastResponseId(idMatch[1])
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
        const thoughtRegex = /<thinking:([^>]+)>/g
        let cleanFinal = finalChunk
        let tm: RegExpExecArray | null
        while ((tm = thoughtRegex.exec(finalChunk)) !== null) {
          const delta = tm[1]
          if (delta) setThinkingText((prev) => prev + delta)
        }
        cleanFinal = cleanFinal.replace(thoughtRegex, '')
        assistantText += cleanFinal
        const idMatch = /<response_id:([^>]+)>/g.exec(cleanFinal)
        if (idMatch && idMatch[1]) setLastResponseId(idMatch[1])
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
              const isLastAssistant = i === messages.length - 1 && m.role === 'assistant'
              return (
                <div key={i} className={`${topMarginClass} mb-0`}>
                  {thinkingText && isLastAssistant && (
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={() => setThinkingOpen((v) => !v)}
                        className="text-xs text-neutral-600 dark:text-neutral-300 underline"
                      >
                        {thinkingOpen ? 'Hide thinking' : 'Show thinking'}
                      </button>
                      {thinkingOpen && (
                        <div className="mt-1 max-h-40 overflow-auto rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2">
                          <div
                            className="prose-message dark:prose-invert font-sans text-xs"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(md.parse(thinkingText) as string) }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 w-full">
                    {renderMessageContent(m.role, m.content)}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <form onSubmit={sendMessage} className="mt-3 flex items-center gap-2 flex-wrap" aria-busy={isLoading}>
          <ModelSelector
            value={model}
            onChange={setModel}
          />
          <select
            className="appearance-none no-native-arrow rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-2 h-10 text-sm"
            value={selectedTool}
            onChange={(e) => {
              const next = e.target.value as 'file' | 'web' | 'r_low' | 'r_medium' | 'r_high'
              setSelectedTool(next)
              if (next !== 'file') {
                setInputImages([])
              }
              if (next === 'r_low' || next === 'r_medium' || next === 'r_high') {
                setReasoningEffort(next === 'r_low' ? 'low' : next === 'r_medium' ? 'medium' : 'high')
              }
            }}
            aria-label="Select tool"
          >
            <option value="r_low">Reasoning: Low</option>
            <option value="r_medium">Reasoning: Medium</option>
            <option value="r_high">Reasoning: High</option>
            <option value="file">Upload images</option>
            <option value="web">Web search</option>
          </select>
          {/* image routing and follow-up toggles removed */}
          {/* Advanced search settings removed */}
          <input
            className="stable-input flex-1 min-w-[12rem] rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-3 py-2 outline-none transform-gpu will-change-transform placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
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
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
          {(selectedTool === 'r_low' || selectedTool === 'r_medium' || selectedTool === 'r_high') && (
            <div className="rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-700 dark:text-neutral-300">
              Reasoning effort: {selectedTool === 'r_low' ? 'Low' : selectedTool === 'r_medium' ? 'Medium' : 'High'}
            </div>
          )}
          {selectedTool === 'file' && (
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || [])
                  const urls: string[] = []
                  for (const f of files) {
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => resolve(String(reader.result))
                      reader.onerror = () => reject(reader.error)
                      reader.readAsDataURL(f)
                    })
                    urls.push(dataUrl)
                  }
                  if (urls.length > 0) setSelectedTool('file')
                  setInputImages(urls)
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-between rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-3 h-10 text-sm text-left"
                  aria-label="Choose image files"
                >
                  <span className="truncate text-neutral-600 dark:text-neutral-300">
                    {inputImages.length > 0 ? `${inputImages.length} image(s) selected` : 'Choose images...'}
                  </span>
                  <span className="shrink-0 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-200">
                    Browse
                  </span>
                </button>
                {inputImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInputImages([])}
                    className="rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-3 h-10 text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
              {inputImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {inputImages.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={src}
                        alt={`Selected ${idx + 1}`}
                        className="h-16 w-16 object-cover rounded border border-neutral-200 dark:border-neutral-800"
                      />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() =>
                          setInputImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedTool === 'web' && (
            <div className="rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-neutral-700 dark:text-neutral-300">
              Web search is enabled. I may browse and cite sources in my answer.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}