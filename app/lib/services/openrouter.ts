import type { ApiRequestBody } from '@/app/types/api'
import type { OpenRouterConfig } from '@/app/lib/env'

export function toText(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map((x) => toText(x)).join('')
  if (typeof v === 'object') {
    if (typeof v.content === 'string') return v.content
    if (Array.isArray(v.content)) return v.content.map((x: any) => toText(x)).join('')
    if (typeof (v as any).text === 'string') return (v as any).text
    if (Array.isArray((v as any).tokens)) return (v as any).tokens.map((x: any) => toText(x)).join('')
  }
  return ''
}

const sanitizeMeta = (s: unknown): string => {
  const str = String(s ?? '')
  return str.replace(/[<>]/g, '')
}

export function buildOpenRouterMessages(body: ApiRequestBody): Array<any> {
  const allMessages = body.messages || []
  // Defensive: drop any assistant messages with empty content
  const filteredMessages = allMessages.filter((msg: any) => {
    if (msg?.role !== 'assistant') return true
    const c = msg?.content
    if (typeof c === 'string') return c.trim().length > 0
    return Boolean(c)
  })

  let lastUserIndex = -1
  for (let i = filteredMessages.length - 1; i >= 0; i--) {
    if ((filteredMessages[i] as any)?.role === 'user') { lastUserIndex = i; break }
  }
  return filteredMessages.map((msg, index) => {
    const isLastUserMessage = msg.role === 'user' && index === lastUserIndex
    if (
      isLastUserMessage &&
      (body.inputImages?.length || body.inputImageUrls?.length || body.inputPdfBase64?.length || body.inputPdfUrls?.length)
    ) {
      const content: Array<{ type: string; [k: string]: any }> = []
      if (msg.content) content.push({ type: 'text', text: msg.content })
      if (body.inputImages?.length) {
        for (const imageData of body.inputImages) {
          content.push({ type: 'image_url', image_url: { url: imageData } })
        }
      }
      if (body.inputImageUrls?.length) {
        for (const imageUrl of body.inputImageUrls) {
          content.push({ type: 'image_url', image_url: { url: imageUrl } })
        }
      }
      if (body.inputPdfBase64?.length) {
        for (let i = 0; i < body.inputPdfBase64.length; i++) {
          const pdfData = body.inputPdfBase64[i]
          const filename = body.inputPdfFilenames?.[i] || `document-${i + 1}.pdf`
          content.push({ type: 'file', file: { filename, file_data: `data:application/pdf;base64,${pdfData}` } })
        }
      }
      if (body.inputPdfUrls?.length) {
        for (const pdfUrl of body.inputPdfUrls) {
          const urlParts = pdfUrl.split('/')
          const filename = urlParts[urlParts.length - 1] || 'document.pdf'
          content.push({ type: 'file', file: { filename, file_data: pdfUrl } })
        }
      }
      return { role: msg.role, content }
    }
    return { role: msg.role, content: msg.content }
  })
}

export function buildPlugins(body: ApiRequestBody): Array<Record<string, unknown>> {
  const plugins: Array<Record<string, unknown>> = []
  if (body.inputPdfBase64?.length || body.inputPdfUrls?.length) {
    plugins.push({ id: 'file-parser', pdf: { engine: body.pdfEngine || 'mistral-ocr' } })
  }
  if (body.useSearch) {
    plugins.push({ id: 'web' })
  }
  return plugins
}

export function buildOpenRouterPayload(body: ApiRequestBody): Record<string, unknown> {
  const model = body.model || '@preset/yurie-ai'
  return {
    model,
    messages: buildOpenRouterMessages(body),
    stream: true,
    max_tokens: body.max_output_tokens,
    max_output_tokens: body.max_output_tokens,
    reasoning: body.reasoning,
    plugins: (() => { const p = buildPlugins(body); return p.length > 0 ? p : undefined })(),
    web_search_options: body.useSearch ? { search_context_size: body.searchContextSize || 'high' } : undefined,
  }
}

export async function fetchOpenRouterStream(
  payload: Record<string, unknown>,
  cfg: OpenRouterConfig,
  signal: AbortSignal,
  requestAbort?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
      'HTTP-Referer': cfg.referrer,
      'X-Title': cfg.title,
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!upstream.ok || !upstream.body) {
    let detail = ''
    try { detail = await upstream.text() } catch {}
    throw new Error(detail || `Upstream error: ${upstream.status}`)
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    start(controllerOut) {
      const reader = upstream.body!.getReader()
      let buffer = ''
      let sentResponseId = false

      const read = async (): Promise<void> => {
        try {
          const { done, value } = await reader.read()
          if (done) { controllerOut.close(); return }
          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const lines = event.split('\n')
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data:')) continue
              const dataStr = trimmed.slice(5).trim()
              if (!dataStr || dataStr === '[DONE]') continue
              try {
                const json = JSON.parse(dataStr)
                const rid = (json?.id || json?.response_id || json?.choices?.[0]?.id)
                if (!sentResponseId && rid) {
                  sentResponseId = true
                  controllerOut.enqueue(encoder.encode(`<response_id:${sanitizeMeta(rid)}>`))
                }
                const delta = json?.choices?.[0]?.delta
                const contentPiece: string = (delta?.content ?? json?.choices?.[0]?.message?.content ?? '') as string

                const message = json?.choices?.[0]?.message
                const annotations = message?.annotations
                if (Array.isArray(annotations) && annotations.length > 0) {
                  for (const annotation of annotations) {
                    if (annotation?.type === 'url_citation') {
                      const citation = annotation.url_citation
                      if (citation?.url) {
                        const citationData = {
                          url: sanitizeMeta(citation.url),
                          title: sanitizeMeta(citation.title || ''),
                          content: sanitizeMeta((citation.content || '').slice(0, 200)),
                        }
                        controllerOut.enqueue(encoder.encode(`<citation:${JSON.stringify(citationData)}>`))
                      }
                    }
                  }
                }

                const r1 = toText(delta?.reasoning)
                const r2 = toText(json?.choices?.[0]?.message?.reasoning)
                const r3 = toText(json?.reasoning)
                const r4 = toText(json?.x_groq?.reasoning)
                let reasoningPiece = (r1 || r2 || r3 || r4)

                const rd = (delta?.reasoning_details || json?.choices?.[0]?.message?.reasoning_details) as any[] | undefined
                if (Array.isArray(rd)) {
                  for (const item of rd) {
                    if (item?.type === 'reasoning.text' && item?.text) {
                      controllerOut.enqueue(encoder.encode(`<thinking:${sanitizeMeta(item.text)}>`))
                    } else if (item?.type === 'reasoning.summary' && item?.summary) {
                      controllerOut.enqueue(encoder.encode(`<summary_text:${sanitizeMeta(item.summary)}>`))
                    }
                  }
                } else if (reasoningPiece) {
                  controllerOut.enqueue(encoder.encode(`<thinking:${sanitizeMeta(reasoningPiece)}>`))
                }

                const s1 = toText(delta?.reasoning?.summary)
                const s2 = toText(json?.choices?.[0]?.message?.reasoning?.summary)
                const summaryText = s1 || s2
                if (summaryText) {
                  controllerOut.enqueue(encoder.encode(`<summary_text:${sanitizeMeta(summaryText)}>`))
                }

                if (contentPiece) controllerOut.enqueue(encoder.encode(contentPiece))
              } catch {}
            }
          }
          read()
        } catch (e) {
          try { controllerOut.error(e as any) } catch {}
        }
      }

      const onAbort = () => {
        try { reader.cancel() } catch {}
        try { controllerOut.close() } catch {}
      }
      requestAbort?.addEventListener('abort', onAbort)
      read()
    },
  })
}

