import OpenAI from 'openai'
export const runtime = 'nodejs'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  try {
    const { messages, model } = (await request.json()) as {
      messages: ChatMessage[]
      model?: string
    }

    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid body: messages[] required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY server env var' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const client = new OpenAI({ apiKey })

    // Remove embedded base64 image payloads from history to keep requests small
    const stripImageData = (text: string): string => {
      if (!text) return text
      const angleTag = /<image:[^>]+>/gi
      const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
      const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
      return text
        .replace(angleTag, '[image omitted]')
        .replace(bracketDataUrl, '[image omitted]')
        .replace(bareDataUrl, '[image omitted]')
    }

    // Strong system rules to keep answers concise and code-only when appropriate
    const RULES = [
      'SYSTEM RULES:',
      '- You are Yurie, a helpful AI assistant specializing in deep research, writing, storytelling and coding.',
      '- Do NOT scaffold entire apps.',
      '- For code, output valid fenced Markdown.',
    ].join('\n')

    const promptRaw =
      RULES +
      '\n\nConversation history follows. Respond as Yurie.\n' +
      messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Yurie'}: ${stripImageData(m.content)}`)
        .join('\n') +
      '\nYurie:'

    // Keep prompt within a reasonable character budget to avoid large requests
    const MAX_PROMPT_CHARS = 100000
    const prompt =
      promptRaw.length > MAX_PROMPT_CHARS
        ? promptRaw.slice(promptRaw.length - MAX_PROMPT_CHARS)
        : promptRaw

    const selectedModel = typeof model === 'string' && model.trim() ? model : 'gpt-5'

    // Heuristic: if the latest user message looks like an image request,
    // call the dedicated image generation endpoint for reliability.
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''
    // Only treat as an image-generation request when the user explicitly asks
    // to create/draw/render something visual, not merely when they mention an image.
    const explicitImageVerb =
      /\b(generate|create|make|draw|paint|illustrate|render|design|produce|show)\b[^\n]*\b(image|picture|photo|photograph|illustration|art|logo|icon|wallpaper)\b/i
    const imageDescriptorTerms =
      /\b(watercolor|illustration|pastel|photorealistic|cinematic|bokeh|portrait|vector|logo|icon|wallpaper|sticker|pixel art|line art|sketch|ink|charcoal|oil|acrylic|concept art|digital painting|3d|isometric|octane|unreal|anime|pixar|8k|hdr)\b/i
    const analysisIntent =
      /\b(describe|explain|analy[sz]e|caption|tell me about)\b[^\n]*\b(image|picture|photo|it|this)\b/i
    const wantsImage =
      (explicitImageVerb.test(lastUserMessage) || imageDescriptorTerms.test(lastUserMessage)) &&
      !analysisIntent.test(lastUserMessage)

    if (wantsImage) {
      try {
        const img = await client.images.generate({
          model: 'gpt-image-1',
          prompt: lastUserMessage || 'Generate an image based on the conversation context',
          size: '1024x1024',
        })
        const b64 = (img as any)?.data?.[0]?.b64_json as string | undefined
        if (!b64) {
          return new Response('Sorry, no image was returned.', {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
        const body = `Here is your image.\n<image:data:image/png;base64,${b64}>\n`
        return new Response(body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return new Response(`There was an error generating the image: ${message}`, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 500,
        })
      }
    }

    const stream = await client.responses.stream({
      model: selectedModel,
      reasoning: { effort: "high" },
      instructions:
        "You are Yurie, a creative and helpful AI assistant.",
      input: prompt,
      // Cast for SDK compatibility: some versions don't include 'image_generation' in Tool union
      tools: [{ type: 'image_generation' } as any],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode(event.delta))
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          controller.enqueue(encoder.encode(`\n[error] ${message}`))
        } finally {
          // Try to finalize, then emit any generated images at the end
          try {
            const hasFinal = typeof (stream as any).final === 'function'
            const finalResponse = hasFinal ? await (stream as any).final() : undefined
            const outputs = (finalResponse && finalResponse.output) || []
            const imageCalls = Array.isArray(outputs)
              ? outputs.filter((o: any) => o && o.type === 'image_generation_call')
              : []

            for (const call of imageCalls) {
              const base64: unknown = (call && call.result) as unknown
              if (typeof base64 === 'string' && base64.length > 0) {
                // Emit as data URL (angle-bracket sentinel) so the client can render it inline
                controller.enqueue(
                  encoder.encode(`\n<image:data:image/png;base64,${base64}>\n`)
                )
              }
            }
          } catch {}
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}


