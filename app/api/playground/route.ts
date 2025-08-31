import OpenAI, { toFile } from 'openai'
export const runtime = 'nodejs'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid data URL')
  const mime = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  return { mime, buffer }
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const { mime, buffer } = parseDataUrl(dataUrl)
  const blob = new Blob([buffer], { type: mime })
  return await toFile(blob, filename)
}

export async function POST(request: Request) {
  try {
    const {
      messages,
      inputImages,
      maskDataUrl,
      previousResponseId,
      reasoningEffort,
      forceImageGeneration,
    } = (await request.json()) as {
      messages: ChatMessage[]
      inputImages?: string[]
      maskDataUrl?: string | null
      previousResponseId?: string | null
      reasoningEffort?: 'low' | 'medium' | 'high'
      forceImageGeneration?: boolean
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

    const RULES = [
      'SYSTEM RULES:',
      '- You are Yurie, a helpful AI assistant specializing in deep research, writing, storytelling and coding.',
      '- Always format responses in Markdown. Use headings (##, ###) to structure content, bold text for key terms, and bullet/numbered lists when helpful.',
      '- Start with a brief, direct answer or TL;DR when appropriate, then elaborate.',
      "- Structure sections using headings like 'Answer', 'Why', 'Steps', and 'Caveats' when helpful.",
      '- Prefer concise paragraphs and numbered steps for procedures.',
      '- For code, use fenced Markdown code blocks with a language tag. Keep code minimal and focused.',
      '- Avoid raw HTML unless explicitly requested; prefer Markdown.',
      "- Default to the user's language; fall back to English if unclear.",
      "- If the request is ambiguous, ask up to one clarifying question. If you must proceed, list brief assumptions under 'Assumptions'.",
      '- For factual claims, prefer including dates/timeframes and state uncertainty if applicable.',
      "- End with 'Next steps' only when action items will help the user.",
      '- Keep answers concise by default; expand on request.',
      '- For code answers, prefer minimal, runnable snippets and briefly note trade-offs.',
      '- Decide when to use tools automatically: use web_search for up-to-date facts (and always include a Sources list with citations), analyze any attached images, and use image generation only when the user asks to create or edit an image. If a mask is provided, perform inpainting-style edits.',
      '- If tools are unnecessary, answer directly without calling them.',
      '- Do NOT scaffold entire apps.',
    ].join('\n')

    const INSTRUCTIONS_MARKDOWN =
      "You are Yurie, a creative and helpful AI assistant. Begin with a concise answer or TL;DR when appropriate, then provide details. Always format responses in Markdown with clear hierarchy (##, ###), use bold for key points, and bullet/numbered lists when useful. Prefer numbered steps for procedures and include concise caveats when relevant. For code, use fenced Markdown blocks with a language tag and keep snippets minimal. Avoid raw HTML. Autonomously use tools when helpful: use web_search for current facts and include a Sources list; analyze attached images; use image generation only when the user asks to create/edit an image (perform inpainting when a mask is provided). If no tool is needed, answer directly."

    const header = RULES + '\n\nConversation history follows. Respond as Yurie.\n'
    const messagesStr = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Yurie'}: ${stripImageData(m.content)}`)
      .join('\n')
    const tail = '\nYurie:'

    const MAX_PROMPT_CHARS = 100000
    let prompt: string
    if (header.length + messagesStr.length + tail.length <= MAX_PROMPT_CHARS) {
      prompt = header + messagesStr + tail
    } else {
      const budget = MAX_PROMPT_CHARS - header.length - tail.length
      const trimmedHistory = budget > 0 ? messagesStr.slice(messagesStr.length - budget) : ''
      prompt = header + trimmedHistory + tail
    }

    const selectedModel = 'gpt-5'
    const useWebSearchEffective = true

    const buildWebSearchTool = (): any => {
      return { type: 'web_search' as const, search_context_size: 'high' as const }
    }

    const selectedEffort: 'low' | 'medium' | 'high' =
      reasoningEffort === 'low' || reasoningEffort === 'medium' || reasoningEffort === 'high'
        ? reasoningEffort
        : 'high'

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''
    const explicitImageVerb =
      /\b(generate|create|make|draw|paint|illustrate|render|design|produce|show)\b[^\n]*\b(image|picture|photo|photograph|illustration|art|logo|icon|wallpaper)\b/i
    const imageDescriptorTerms =
      /\b(watercolor|illustration|pastel|photorealistic|cinematic|bokeh|portrait|vector|logo|icon|wallpaper|sticker|pixel art|line art|sketch|ink|charcoal|oil|acrylic|concept art|digital painting|3d|isometric|octane|unreal|anime|pixar|8k|hdr)\b/i
    const analysisIntent =
      /\b(describe|explain|analy[sz]e|caption|tell me about)\b[^\n]*\b(image|picture|photo|it|this)\b/i
    const hasInputImages = Array.isArray(inputImages) && inputImages.length > 0
    const webSearchAllowed = useWebSearchEffective && !hasInputImages
    const editIntent = /\b(edit|add|replace|remove|overlay|combine|composite|blend|merge|variation|variations|logo|stamp|put|insert|inpaint|mask|fill|make it|make this|turn this into)\b/i

    if (!forceImageGeneration && hasInputImages && (!explicitImageVerb.test(lastUserMessage) || analysisIntent.test(lastUserMessage)) && !editIntent.test(lastUserMessage)) {
      const encoder = new TextEncoder()
      const visionTools: any[] = []
      if (webSearchAllowed) {
        visionTools.push(buildWebSearchTool())
      }
      const responseCreateParams: any = {
        model: selectedModel,
        instructions: INSTRUCTIONS_MARKDOWN,
        reasoning: ({ effort: selectedEffort as any, summary: 'auto' } as any),
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: lastUserMessage || 'Analyze these images' },
              ...inputImages.map((url) => ({ type: 'input_image', image_url: url })),
            ],
          },
        ],
        tools: visionTools as any,
        previous_response_id: previousResponseId ?? undefined,
        tool_choice: 'auto',
        include: webSearchAllowed ? (['web_search_call.results'] as any) : undefined,
      }
      const stream = await client.responses.stream(responseCreateParams)
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of stream) {
              const type = String((event as any)?.type || '')
              if (type === 'response.output_text.delta') {
                controller.enqueue(encoder.encode((event as any).delta))
                continue
              }
              if (type.startsWith('response.reasoning') && (event as any)?.delta) {
                controller.enqueue(encoder.encode(`\n<thinking:${String((event as any).delta)}>`))
                continue
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            controller.enqueue(encoder.encode(`\n[error] ${message}`))
          } finally {
            try {
              const hasFinal = typeof (stream as any).final === 'function'
              const finalResponse = hasFinal ? await (stream as any).final() : undefined
              try {
                const outputs: any[] = (finalResponse && (finalResponse as any).output) || []
                const citations: { url?: string; title?: string }[] = []
                const addCitation = (url?: string, title?: string) => {
                  if (!url) return
                  if (citations.some((c) => c.url === url)) return
                  citations.push({ url, title })
                }
                let reasoningSummaryText: string | undefined
                for (const out of outputs) {
                  if (out?.type === 'message') {
                    const content = Array.isArray(out.content) ? out.content : []
                    for (const c of content) {
                      if (c?.type === 'output_text' && Array.isArray(c.annotations)) {
                        for (const ann of c.annotations) {
                          if (ann?.type === 'url_citation') addCitation(ann.url, ann.title)
                        }
                      }
                    }
                  }
                  if (out?.type === 'web_search_call') {
                    const srcs = out?.action?.sources
                    if (Array.isArray(srcs)) for (const s of srcs) addCitation(s?.url, s?.title)
                  }
                  if (out?.type === 'reasoning' && Array.isArray(out.summary)) {
                    for (const s of out.summary) {
                      if (s?.type === 'summary_text' && typeof s.text === 'string' && s.text) {
                        reasoningSummaryText = s.text
                        break
                      }
                    }
                  }
                }
                if (citations.length > 0) {
                  controller.enqueue(encoder.encode(`\n\nSources:\n`))
                  for (const s of citations) {
                    const title = s.title && String(s.title).trim().length > 0 ? s.title : s.url
                    controller.enqueue(encoder.encode(`- [${title}](${s.url})\n`))
                  }
                }
                if (reasoningSummaryText) {
                  controller.enqueue(encoder.encode(`\n<summary_text:${reasoningSummaryText}>\n`))
                }
              } catch {}
              const respId: unknown = (finalResponse as any)?.id
              if (typeof respId === 'string' && respId) {
                controller.enqueue(encoder.encode(`\n<response_id:${respId}>\n`))
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
    }

    const wantsImage =
      Boolean(forceImageGeneration) ||
      ((explicitImageVerb.test(lastUserMessage) || imageDescriptorTerms.test(lastUserMessage) || editIntent.test(lastUserMessage)) &&
        !analysisIntent.test(lastUserMessage)) ||
      hasInputImages ||
      Boolean(maskDataUrl)

    if (wantsImage) {
      try {
        const encoder = new TextEncoder()
        const toolOptions: any = {
          type: 'image_generation',
          model: 'gpt-image-1',
          size: 'auto',
          quality: 'high',
          background: 'auto',
          output_format: 'png',
          partial_images: 3,
          input_fidelity: 'high',
          moderation: 'auto',
        }

        if (maskDataUrl) {
          const readable = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                const result = await (async () => {
                  if (maskDataUrl) {
                    const maskFile = maskDataUrl
                      ? await dataUrlToFile(maskDataUrl, 'mask.png')
                      : undefined

                    const editParams: any = {
                      model: 'gpt-image-1',
                      image: inputImages?.[0]
                        ? [await dataUrlToFile(inputImages[0], 'image_1.png')]
                        : undefined,
                      prompt: lastUserMessage,
                      size: 'auto',
                      quality: 'high',
                      background: 'auto',
                      input_fidelity: 'high',
                      output_format: 'png',
                    }
                    if (maskFile) editParams.mask = maskFile

                    return await client.images.edit(editParams)
                  }
                  const genParams: any = {
                    model: 'gpt-image-1',
                    prompt: lastUserMessage,
                    size: 'auto',
                    quality: 'high',
                    background: 'auto',
                    input_fidelity: 'high',
                    output_format: 'png',
                  }
                  return await client.images.generate(genParams)
                })()

                const image_base64 = (result as any).data?.[0]?.b64_json
                if (typeof image_base64 === 'string' && image_base64.length > 0) {
                  controller.enqueue(
                    encoder.encode(`\n<image:data:image/png;base64,${image_base64}>\n`)
                  )
                } else {
                  controller.enqueue(
                    encoder.encode(`\n[error] No image returned from Image API\n`)
                  )
                }
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error'
                controller.enqueue(encoder.encode(`\n[error] ${message}\n`))
              } finally {
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
        }

        const responseCreateParams: any = {
          model: selectedModel,
          instructions: INSTRUCTIONS_MARKDOWN,
          reasoning: ({ effort: selectedEffort as any, summary: 'auto' } as any),
          tools: [toolOptions as any],
          previous_response_id: previousResponseId ?? undefined,
        }
        if (hasInputImages) {
          const content = [
            { type: 'input_text', text: lastUserMessage },
            ...inputImages.map((url) => ({ type: 'input_image', image_url: url })),
          ]
          responseCreateParams.input = [
            {
              role: 'user',
              content,
            },
          ]
        } else {
          responseCreateParams.input = lastUserMessage
        }

        const stream = await client.responses.stream(responseCreateParams)

        const readable = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of stream as any) {
                const type: string = String(event?.type || '')
                if (type === 'response.image_generation_call.partial_image') {
                  const b64 = (event as any).partial_image_b64 as string | undefined
                  if (b64) controller.enqueue(encoder.encode(`\n<image_partial:data:image/png;base64,${b64}>\n`))
                  continue
                }
                if (type.startsWith('response.reasoning') && (event as any)?.delta) {
                  controller.enqueue(encoder.encode(`\n<thinking:${String((event as any).delta)}>`))
                  continue
                }
                if (type.endsWith('.error') || type === 'error') {
                  const msg = (event as any)?.error || 'Unknown image generation error'
                  controller.enqueue(encoder.encode(`\n[error] ${String(msg)}\n`))
                  continue
                }
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Unknown error'
              controller.enqueue(encoder.encode(`\n[error] ${message}\n`))
            } finally {
              try {
                const hasFinal = typeof (stream as any).final === 'function'
                const finalResponse = hasFinal ? await (stream as any).final() : undefined
                const outputs = (finalResponse && (finalResponse as any).output) || []
                const imageCalls = Array.isArray(outputs)
                  ? outputs.filter((o: any) => o && o.type === 'image_generation_call')
                  : []
                let reasoningSummaryText: string | undefined
                for (const call of imageCalls) {
                  const base64: unknown = (call && (call as any).result) as unknown
                  if (typeof base64 === 'string' && base64.length > 0) {
                    controller.enqueue(
                      encoder.encode(`\n<image:data:image/png;base64,${base64}>\n`)
                    )
                  }
                  const revised: unknown = (call as any)?.revised_prompt
                  if (typeof revised === 'string' && revised) {
                    controller.enqueue(
                      encoder.encode(`\n<revised_prompt:${revised}>\n`)
                    )
                  }
                }
                for (const out of outputs) {
                  if (out?.type === 'reasoning' && Array.isArray(out.summary)) {
                    for (const s of out.summary) {
                      if (s?.type === 'summary_text' && typeof s.text === 'string' && s.text) {
                        reasoningSummaryText = s.text
                        break
                      }
                    }
                  }
                }
                if (reasoningSummaryText) {
                  controller.enqueue(encoder.encode(`\n<summary_text:${reasoningSummaryText}>\n`))
                }
                const respId: unknown = (finalResponse as any)?.id
                if (typeof respId === 'string' && respId) {
                  controller.enqueue(encoder.encode(`\n<response_id:${respId}>\n`))
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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return new Response(`There was an error generating the image: ${message}`, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 500,
        })
      }
    }

    const toolList: any[] = [{ type: 'image_generation' } as any]
    if (webSearchAllowed) {
      toolList.push(buildWebSearchTool())
    }
    const includeList: any[] = []
    if (webSearchAllowed) includeList.push('web_search_call.results')
    const stream = await client.responses.stream({
      model: selectedModel,
      reasoning: ({ effort: selectedEffort as any, summary: 'auto' } as any),
      instructions: INSTRUCTIONS_MARKDOWN,
      input: prompt,
      tools: toolList as any,
      previous_response_id: previousResponseId ?? undefined,
      tool_choice: 'auto',
      include: includeList.length > 0 ? (includeList as any) : undefined,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream as any) {
            const type = String((event as any)?.type || '')
            if (type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode((event as any).delta))
              continue
            }
            if (type.startsWith('response.reasoning') && (event as any)?.delta) {
              controller.enqueue(encoder.encode(`\n<thinking:${String((event as any).delta)}>`))
              continue
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          controller.enqueue(encoder.encode(`\n[error] ${message}`))
        } finally {
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
                controller.enqueue(
                  encoder.encode(`\n<image:data:image/png;base64,${base64}>\n`)
                )
              }
            }
            let reasoningSummaryText: string | undefined
            try {
              const outputsAny: any[] = (finalResponse && (finalResponse as any).output) || []
              const citations: { url?: string; title?: string }[] = []
              const addCitation = (url?: string, title?: string) => {
                if (!url) return
                if (citations.some((c) => c.url === url)) return
                citations.push({ url, title })
              }
              for (const out of outputsAny) {
                if (out?.type === 'message') {
                  const content = Array.isArray(out.content) ? out.content : []
                  for (const c of content) {
                    if (c?.type === 'output_text' && Array.isArray(c.annotations)) {
                      for (const ann of c.annotations) {
                        if (ann?.type === 'url_citation') addCitation(ann.url, ann.title)
                      }
                    }
                  }
                }
                if (out?.type === 'web_search_call') {
                  const srcs = out?.action?.sources
                  if (Array.isArray(srcs)) for (const s of srcs) addCitation(s?.url, s?.title)
                }
                if (out?.type === 'reasoning' && Array.isArray(out.summary)) {
                  for (const s of out.summary) {
                    if (s?.type === 'summary_text' && typeof s.text === 'string' && s.text) {
                      reasoningSummaryText = s.text
                      break
                    }
                  }
                }
              }
              if (citations.length > 0) {
                controller.enqueue(encoder.encode(`\n\nSources:\n`))
                for (const s of citations) {
                  const title = s.title && String(s.title).trim().length > 0 ? s.title : s.url
                  controller.enqueue(encoder.encode(`- [${title}](${s.url})\n`))
                }
              }
              if (reasoningSummaryText) {
                controller.enqueue(encoder.encode(`\n<summary_text:${reasoningSummaryText}>\n`))
              }
            } catch {}
            const respId: unknown = (finalResponse as any)?.id
            if (typeof respId === 'string' && respId) {
              controller.enqueue(encoder.encode(`\n<response_id:${respId}>\n`))
            }
            const status: unknown = (finalResponse as any)?.status
            const incompleteReason: unknown = (finalResponse as any)?.incomplete_details?.reason
            if (status === 'incomplete' && typeof incompleteReason === 'string' && incompleteReason) {
              controller.enqueue(encoder.encode(`\n<incomplete:${incompleteReason}>\n`))
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


