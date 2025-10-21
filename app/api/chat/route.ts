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
export async function POST(request: Request) {
  try {
    const { messages, model, reasoningEffort, includeReasoningSummary } = (await request.json()) as {
      messages?: ChatMessage[]
      model?: string
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
      includeReasoningSummary?: boolean
    }

    const client = new OpenAI()

    const selectedModel = typeof model === 'string' && model ? model : 'gpt-5'

    const input = Array.isArray(messages) && messages.length > 0
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: 'user', content: '' }]

    const effort: 'minimal' | 'low' | 'medium' | 'high' =
      reasoningEffort === 'minimal' || reasoningEffort === 'low' || reasoningEffort === 'medium' || reasoningEffort === 'high'
        ? reasoningEffort
        : 'medium'

    const reasoningParams: any = { effort }
    if (includeReasoningSummary) reasoningParams.summary = 'auto'

    const stream = await client.responses.create({
      model: selectedModel,
      input,
      reasoning: reasoningParams,
      stream: true,
    })

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