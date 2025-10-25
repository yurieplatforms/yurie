import OpenAI from 'openai'
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Shared streaming response headers
const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const
const INSTRUCTIONS = 'You are Yurie, a helpful assistant. When up-to-date, real-world, or hard-to-remember facts are needed, and the web_search tool is available, call it to gather information before answering. Use web_search sparingly and only when it will materially improve accuracy or timeliness. If you do not need it, answer directly.'

// Simple heuristic to decide whether a query likely needs web search
function shouldEnableSearchFromQuery(text: string | undefined | null): boolean {
  if (!text) return false
  const t = text.toLowerCase()

  // Explicit user intent to search/browse
  const explicitSearchRe = /(search|look up|google|bing|browse|check (?:online|the web|the internet)|find (?:online|on the web)|web results|browse the web)/i
  if (explicitSearchRe.test(t)) return true

  // Recency-sensitive keywords
  const recencyRe = /(latest|current|today|now|recent|breaking|news|update|up[- ]to[- ]date|live|this (?:week|month|year))/i
  if (recencyRe.test(t)) return true

  // Common live/volatile info triggers
  const volatileRe = /(stock|price|weather|score|earnings|release date|schedule|deadline|launch|trending|trend|ranking|rank)/i
  if (volatileRe.test(t)) return true

  // Questions about very recent years suggest recency
  if (/\b202[4-9]\b/.test(t) && /(what|who|when|where|is|are)/i.test(t)) return true

  // Presence of URLs often benefits from web context
  if (/https?:\/\//i.test(t)) return true

  // Docs/help queries
  const docsRe = /(docs|documentation|api reference|how to (?:use|install|configure)|error code|stack trace)/i
  if (docsRe.test(t)) return true

  return false
}
export async function POST(request: Request) {
  try {
    const { messages, model, reasoningEffort, includeReasoningSummary, useSearch, inputImages, inputPdfs, inputImageUrls, inputPdfUrls, max_output_tokens } = (await request.json()) as {
      messages?: ChatMessage[]
      model?: string
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
      includeReasoningSummary?: boolean
      useSearch?: boolean
      inputImages?: string[]
      inputPdfs?: { filename: string; dataUrl: string }[]
      inputImageUrls?: string[]
      inputPdfUrls?: string[]
      max_output_tokens?: number
    }

    const client = new OpenAI()

    // Default to gpt-4o which supports vision and PDF inputs
    const selectedModel = typeof model === 'string' && model ? model : 'gpt-4o'

    // Log incoming file attachments for debugging
    if (inputImages && inputImages.length > 0) {
      console.log('[API] Received images (base64):', inputImages.length, 'files')
    }
    if (inputPdfs && inputPdfs.length > 0) {
      console.log('[API] Received PDFs (base64):', inputPdfs.length, 'files')
    }
    if (inputImageUrls && inputImageUrls.length > 0) {
      console.log('[API] Received image URLs:', inputImageUrls.length, 'files')
    }
    if (inputPdfUrls && inputPdfUrls.length > 0) {
      console.log('[API] Received PDF URLs:', inputPdfUrls.length, 'files')
    }

    // Build input with proper OpenAI Responses API format for images and PDFs
    const input = Array.isArray(messages) && messages.length > 0
      ? messages.map((m, idx) => {
          // Only add images/PDFs to the last user message
          const isLastUserMessage = m.role === 'user' && idx === messages.length - 1
          const hasImages = isLastUserMessage && Array.isArray(inputImages) && inputImages.length > 0
          const hasImageUrls = isLastUserMessage && Array.isArray(inputImageUrls) && inputImageUrls.length > 0
          const hasPdfs = isLastUserMessage && Array.isArray(inputPdfs) && inputPdfs.length > 0
          const hasPdfUrls = isLastUserMessage && Array.isArray(inputPdfUrls) && inputPdfUrls.length > 0

          if (hasImages || hasImageUrls || hasPdfs || hasPdfUrls) {
            const content: any[] = []
            const textToUse = (typeof m.content === 'string' && m.content.trim().length > 0)
              ? m.content
              : 'Please analyze the attached files.'
            content.push({ type: 'input_text', text: textToUse })

            if (hasImages) {
              inputImages!.forEach((imageDataUrl) => {
                console.log('[API] Adding base64 image to content (length:', imageDataUrl.length, ')')
                content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' })
              })
            }

            if (hasImageUrls) {
              inputImageUrls!.forEach((imageUrl) => {
                console.log('[API] Adding image URL to content:', imageUrl.substring(0, 50) + '...')
                content.push({ type: 'input_image', image_url: imageUrl, detail: 'high' })
              })
            }

            if (hasPdfs) {
              inputPdfs!.forEach(({ filename, dataUrl }) => {
                console.log('[API] Adding base64 PDF to content:', filename, '(length:', dataUrl.length, ')')
                content.push({
                  type: 'input_file',
                  filename,
                  file_data: dataUrl,
                })
              })
            }

            if (hasPdfUrls) {
              inputPdfUrls!.forEach((fileUrl) => {
                console.log('[API] Adding PDF URL to content:', fileUrl.substring(0, 50) + '...')
                content.push({
                  type: 'input_file',
                  file_url: fileUrl,
                })
              })
            }

            console.log('[API] Built content array with', content.length, 'items')
            return { role: m.role, content }
          }

          return { role: m.role, content: m.content }
        })
      : [{ role: 'user', content: '' }]

    // Only include reasoning params for models that support it (gpt-5)
    const requestParams: any = {
      model: selectedModel,
      input,
      stream: true,
    }
    if (typeof max_output_tokens === 'number' && Number.isFinite(max_output_tokens) && max_output_tokens > 0) {
      requestParams.max_output_tokens = Math.floor(max_output_tokens)
    }

    // Set system-level instructions per OpenAI best practices
    requestParams.instructions = INSTRUCTIONS

    // Decide whether to enable web search tool automatically based on the latest user message
    const lastUserMessage = Array.isArray(messages)
      ? [...messages].reverse().find((m) => m.role === 'user')
      : undefined
    const autoEnableSearch = shouldEnableSearchFromQuery(lastUserMessage?.content)

    // Add web search tool if explicitly requested or auto-detected
    if (useSearch || autoEnableSearch) {
      requestParams.tools = [{ type: 'web_search' }]
    }

    // Add reasoning parameters only if reasoningEffort is provided (for gpt-5)
    if (reasoningEffort) {
      const effort: 'minimal' | 'low' | 'medium' | 'high' =
        reasoningEffort === 'minimal' || reasoningEffort === 'low' || reasoningEffort === 'medium' || reasoningEffort === 'high'
          ? reasoningEffort
          : 'medium'

      const reasoningParams: any = { effort }
      if (includeReasoningSummary) reasoningParams.summary = 'auto'
      requestParams.reasoning = reasoningParams
    }

    console.log('[API] Calling OpenAI with model:', selectedModel, 'tools:', requestParams.tools ? 'enabled' : 'none')

    // Use the streaming helper per OpenAI SDK best practices
    const stream = await client.responses.stream(requestParams as any)

    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream as any) {
            const type = String((event as any)?.type || '')
            if (type === 'response.output_text.delta') {
              const delta = String((event as any).delta || '')
              if (delta) controller.enqueue(encoder.encode(delta))
            }
            if (type.startsWith('response.reasoning') && (event as any)?.delta) {
              const thought = String((event as any).delta || '')
              if (thought) controller.enqueue(encoder.encode(`\n<thinking:${thought}>`))
            }
          }
        } catch {
          controller.enqueue(encoder.encode(`\n[error] Something went wrong. Please try again.\n`))
        } finally {
          try {
            const hasFinal = typeof (stream as any).final === 'function'
            const finalResponse = hasFinal ? await (stream as any).final() : undefined
            const outputs = (finalResponse && (finalResponse as any).output) || []
            for (const out of outputs as any[]) {
              if (out && out.type === 'reasoning' && Array.isArray(out.summary)) {
                for (const s of out.summary) {
                  if (s && s.type === 'summary_text' && typeof s.text === 'string' && s.text) {
                    controller.enqueue(encoder.encode(`\n<summary_text:${s.text}>\n`))
                    break
                  }
                }
              }
            }
          } catch {}
          controller.close()
        }
      },
    })

    return new Response(readable, { headers: { ...STREAM_HEADERS } })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}