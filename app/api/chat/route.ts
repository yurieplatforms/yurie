import OpenAI from 'openai'
export const runtime = 'nodejs'

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
const INSTRUCTIONS = 'You are Yurie, a helpful assistant.'
export async function POST(request: Request) {
  try {
    const { messages, model, reasoningEffort, includeReasoningSummary, useSearch, inputImages } = (await request.json()) as {
      messages?: ChatMessage[]
      model?: string
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
      includeReasoningSummary?: boolean
      useSearch?: boolean
      inputImages?: string[]
    }

    const client = new OpenAI()

    const selectedModel = typeof model === 'string' && model ? model : 'gpt-4.1'

    // Build input with proper OpenAI format for images
    const input = Array.isArray(messages) && messages.length > 0
      ? messages.map((m, idx) => {
          // Only add images to the last user message
          const isLastUserMessage = m.role === 'user' && idx === messages.length - 1
          const hasImages = isLastUserMessage && Array.isArray(inputImages) && inputImages.length > 0
          
          if (hasImages) {
            // Format content as array with text and images
            const content: any[] = []
            
            // Add text if present
            if (m.content) {
              content.push({ type: 'input_text', text: m.content })
            }
            
            // Add images
            inputImages!.forEach((imageDataUrl) => {
              content.push({
                type: 'input_image',
                image_url: imageDataUrl
              })
            })
            
            return { role: m.role, content }
          }
          
          // Regular text message
          return { role: m.role, content: m.content }
        })
      : [{ role: 'user', content: '' }]

    // Only include reasoning params for models that support it (gpt-5)
    const requestParams: any = {
      model: selectedModel,
      input,
      stream: true,
    }

    // Set system-level instructions per OpenAI best practices
    requestParams.instructions = INSTRUCTIONS

    // Add web search tool if enabled
    if (useSearch) {
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

    const stream = await client.responses.create(requestParams)

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