export const runtime = 'nodejs'

type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type RequestBody = {
  messages: ChatMessage[]
  model?: string
  max_output_tokens?: number
  reasoning?: unknown
  useSearch?: boolean
  searchContextSize?: 'low' | 'medium' | 'high'
  inputImages?: string[]
  inputImageUrls?: string[]
  inputPdfBase64?: string[]
  inputPdfFilenames?: string[]
  inputPdfUrls?: string[]
  previousResponseId?: string | null
  pdfEngine?: 'pdf-text' | 'mistral-ocr' | 'native'
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return new Response('Server not configured: missing OPENROUTER_API_KEY', { status: 500 })
    }

    const body = (await req.json()) as RequestBody
    const model = body.model || '@preset/yurie-ai'

    // Build multimodal messages according to OpenRouter's format
    const messages = (body.messages || []).map((msg, index) => {
      // Only add images/PDFs to the last user message (most recent)
      const isLastUserMessage = msg.role === 'user' && index === body.messages.length - 1
      
      if (isLastUserMessage && (body.inputImages?.length || body.inputImageUrls?.length || body.inputPdfBase64?.length || body.inputPdfUrls?.length)) {
        // Build content array with text first, then images, then PDFs (as recommended by OpenRouter)
        const content: Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
          | { type: 'file'; file: { filename: string; file_data: string } }
        > = []
        
        // Add text content first
        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content
          })
        }
        
        // Add base64 images
        if (body.inputImages?.length) {
          for (const imageData of body.inputImages) {
            content.push({
              type: 'image_url',
              image_url: {
                url: imageData
              }
            })
          }
        }
        
        // Add image URLs
        if (body.inputImageUrls?.length) {
          for (const imageUrl of body.inputImageUrls) {
            content.push({
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            })
          }
        }
        
        // Add base64 PDFs using the 'file' content type
        if (body.inputPdfBase64?.length) {
          for (let i = 0; i < body.inputPdfBase64.length; i++) {
            const pdfData = body.inputPdfBase64[i]
            // Use actual filename from client or fallback to generic name
            const filename = body.inputPdfFilenames?.[i] || `document-${i + 1}.pdf`
            content.push({
              type: 'file',
              file: {
                filename: filename,
                file_data: `data:application/pdf;base64,${pdfData}`
              }
            })
          }
        }
        
        // Add PDF URLs using the 'file' content type
        if (body.inputPdfUrls?.length) {
          for (const pdfUrl of body.inputPdfUrls) {
            // Extract filename from URL or use default
            const urlParts = pdfUrl.split('/')
            const filename = urlParts[urlParts.length - 1] || 'document.pdf'
            content.push({
              type: 'file',
              file: {
                filename: filename,
                file_data: pdfUrl
              }
            })
          }
        }
        
        return {
          role: msg.role,
          content: content
        }
      }
      
      // For all other messages, keep them as simple string content
      return {
        role: msg.role,
        content: msg.content
      }
    })

    // Configure plugins (PDF processing and web search)
    const plugins: Array<Record<string, unknown>> = []
    
    // Add PDF processing plugin if PDFs are being sent
    if (body.inputPdfBase64?.length || body.inputPdfUrls?.length) {
      plugins.push({
        id: 'file-parser',
        pdf: {
          // Use Mistral OCR for better scanned document support
          engine: body.pdfEngine || 'mistral-ocr'
        }
      })
    }
    
    // Add web search plugin if search is enabled
    if (body.useSearch) {
      plugins.push({
        id: 'web',
        // Follow OpenRouter defaults: do not force engine; provider-native when available, otherwise Exa
        // Omit engine to allow model-native search; leave max_results undefined to use default (5)
      })
    }

    const payload: Record<string, unknown> = {
      model,
      messages: messages,
      stream: true,
      // Provide both for best cross-provider compatibility
      max_tokens: body.max_output_tokens,
      max_output_tokens: body.max_output_tokens,
      reasoning: body.reasoning,
      plugins: plugins.length > 0 ? plugins : undefined,
      // For native search models (OpenAI, Anthropic), set search context size
      web_search_options: body.useSearch ? {
        search_context_size: body.searchContextSize || 'high'
      } : undefined,
    }

    const controller = new AbortController()
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // These headers help OpenRouter attribute traffic; adjust for your deployment
        'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_TITLE || 'Yurie',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!upstream.ok || !upstream.body) {
      let detail = ''
      try { detail = await upstream.text() } catch {}
      return new Response(detail || `Upstream error: ${upstream.status}`, { status: upstream.status })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream<Uint8Array>({
      start(controllerOut) {
        const reader = upstream.body!.getReader()
        let buffer = ''
        let sentResponseId = false

        const sanitizeMeta = (s: unknown): string => {
          const str = String(s ?? '')
          // Prevent breaking out of angle-tags
          return str.replace(/[<>]/g, '')
        }

        const toText = (v: any): string => {
          if (!v) return ''
          if (typeof v === 'string') return v
          if (Array.isArray(v)) return v.map((x) => toText(x)).join('')
          if (typeof v === 'object') {
            if (typeof v.content === 'string') return v.content
            if (Array.isArray(v.content)) return v.content.map((x: any) => toText(x)).join('')
            if (typeof v.text === 'string') return v.text
            if (Array.isArray(v.tokens)) return v.tokens.map((x: any) => toText(x)).join('')
          }
          return ''
        }

        const read = async (): Promise<void> => {
          try {
            const { done, value } = await reader.read()
            if (done) {
              controllerOut.close()
              return
            }
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
                  // Emit response id once for client-side tracking
                  const rid = (json?.id || json?.response_id || json?.choices?.[0]?.id)
                  if (!sentResponseId && rid) {
                    sentResponseId = true
                    controllerOut.enqueue(encoder.encode(`<response_id:${sanitizeMeta(rid)}>`))
                  }

                  const delta = json?.choices?.[0]?.delta
                  const contentPiece: string = (delta?.content ?? json?.choices?.[0]?.message?.content ?? '') as string

                  // Handle web search annotations (citations from web plugin)
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
                            content: sanitizeMeta((citation.content || '').slice(0, 200))
                          }
                          controllerOut.enqueue(encoder.encode(`<citation:${JSON.stringify(citationData)}>`))
                        }
                      }
                    }
                  }

                  // Try to extract reasoning tokens from several possible shapes
                  // Reasoning (multiple shapes across providers)
                  const r1 = toText(delta?.reasoning)
                  const r2 = toText(json?.choices?.[0]?.message?.reasoning)
                  const r3 = toText(json?.reasoning)
                  const r4 = toText(json?.x_groq?.reasoning)
                  let reasoningPiece = (r1 || r2 || r3 || r4)

                  // New: OpenRouter-normalized reasoning_details (recommended)
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

                  // Optional: legacy summary shapes
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
            try { controllerOut.error(e) } catch {}
          }
        }

        // If client aborts, stop upstream too
        const onAbort = () => {
          try { controller.abort() } catch {}
          try { reader.cancel() } catch {}
          try { controllerOut.close() } catch {}
        }
        ;(req.signal as AbortSignal).addEventListener('abort', onAbort)

        read()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return new Response(`Server error: ${msg}`, { status: 500 })
  }
}

export function GET() {
  return new Response('Method Not Allowed', { status: 405 })
}

