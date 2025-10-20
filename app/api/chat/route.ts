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
  // Wrap Node Buffer in a Uint8Array to satisfy BlobPart typing
  const uint8Array = new Uint8Array(buffer)
  const blob = new Blob([uint8Array], { type: mime })
  return await toFile(blob, filename)
}

// Shared streaming response headers
const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const

type UrlCitation = { url?: string; title?: string }

function collectCitationsAndSummary(outputs: any[]): {
  citations: UrlCitation[]
  summaryText?: string
} {
  const citations: UrlCitation[] = []
  const addCitation = (url?: string, title?: string) => {
    if (!url) return
    if (citations.some((c) => c.url === url)) return
    citations.push({ url, title })
  }
  let summaryText: string | undefined
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
    if (out?.type === 'reasoning' && Array.isArray(out.summary)) {
      for (const s of out.summary) {
        if (s?.type === 'summary_text' && typeof s.text === 'string' && s.text) {
          summaryText = s.text
          break
        }
      }
    }
  }
  return { citations, summaryText }
}

function enqueueSourcesIfAny(controller: any, encoder: TextEncoder, citations: UrlCitation[]) {
  if (!Array.isArray(citations) || citations.length === 0) return
  controller.enqueue(encoder.encode(`\n\nSources:\n`))
  for (const s of citations) {
    const title = s.title && String(s.title).trim().length > 0 ? s.title : s.url
    controller.enqueue(encoder.encode(`- [${title}](${s.url})\n`))
  }
}

function enqueueSummaryIfAny(controller: any, encoder: TextEncoder, summaryText?: string) {
  if (!summaryText) return
  controller.enqueue(encoder.encode(`\n<summary_text:${summaryText}>\n`))
}

function enqueueResponseIdIfAny(controller: any, encoder: TextEncoder, finalResponse: any) {
  const respId = finalResponse?.id
  if (typeof respId === 'string' && respId) {
    controller.enqueue(encoder.encode(`\n<response_id:${respId}>\n`))
  }
}

export async function POST(request: Request) {
  try {
    const {
      messages,
      inputImages,
      inputPdfs,
      maskDataUrl,
      previousResponseId,
      reasoningEffort,
      max_output_tokens,
      includeReasoningSummary,
      includeEncryptedReasoning,
      forceImageGeneration,
      model: requestedModel,
    } = (await request.json()) as {
      messages: ChatMessage[]
      inputImages?: string[]
      inputPdfs?: { filename: string; dataUrl: string }[]
      maskDataUrl?: string | null
      previousResponseId?: string | null
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
      max_output_tokens?: number
      includeReasoningSummary?: boolean
      includeEncryptedReasoning?: boolean
      forceImageGeneration?: boolean
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

    const INSTRUCTIONS_MARKDOWN = [
      '<SystemPrompt v="2025-10-20">',
      'You are Yurie — a friendly, knowledgeable AI assistant with a warm, human-like personality. 🌟',
      '',
      '**Format:** Always respond in **markdown**. Use headings, bullets, tables, code blocks, and emojis when they enhance clarity or engagement.',
      '',
      '**Code:** When providing code, return it inline using fenced code blocks (```language). Do not create attachments or downloadable files. Avoid linking to generated files; paste the complete code snippet instead.',
      '',
      '**Style:** Be conversational yet concise. Show personality while staying helpful. When presenting data or comparisons, use tables. Add relevant emojis to make responses more engaging.',
      '',
      '**Behavior:** Use tools when needed, cite sources, verify information, and admit uncertainty. Keep reasoning internal unless asked.',
      '',
      '**Safety:** Decline harmful requests politely and suggest better alternatives.',
      '</SystemPrompt>',
      '',
    ].join('\n')

    const header = 'Conversation history follows. Respond as Yurie.\n'
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

    const allowedModels = new Set(['gpt-5-nano', 'gpt-5-mini', 'gpt-5'])
    const selectedModel =
      typeof requestedModel === 'string' && allowedModels.has(requestedModel)
        ? requestedModel
        : 'gpt-5-nano'
    const effectiveModel = selectedModel
    const isProModel = false

    // Code interpreter tool removed as per product decision

    const selectedEffort: 'minimal' | 'low' | 'medium' | 'high' =
      reasoningEffort === 'minimal' || reasoningEffort === 'low' || reasoningEffort === 'medium' || reasoningEffort === 'high'
        ? reasoningEffort
        : 'low'
    const enforcedEffort: 'minimal' | 'low' | 'medium' | 'high' = isProModel ? 'high' : selectedEffort

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''
    const explicitImageVerb =
      /\b(generate|create|make|draw|paint|illustrate|render|design|produce|show)\b[^\n]*\b(image|picture|photo|photograph|illustration|art|logo|icon|wallpaper)\b/i
    const imageDescriptorTerms =
      /\b(watercolor|illustration|pastel|photorealistic|cinematic|bokeh|portrait|vector|logo|icon|wallpaper|sticker|pixel art|line art|sketch|ink|charcoal|oil|acrylic|concept art|digital painting|3d|isometric|octane|unreal|anime|pixar|8k|hdr)\b/i
    const analysisIntent =
      /\b(describe|explain|analy[sz]e|caption|tell me about)\b[^\n]*\b(image|picture|photo|it|this)\b/i
    const hasInputImages = Array.isArray(inputImages) && inputImages.length > 0
    const hasInputPdfs = Array.isArray(inputPdfs) && inputPdfs.length > 0
    const editIntent = /\b(edit|add|replace|remove|overlay|combine|composite|blend|merge|variation|variations|logo|stamp|put|insert|inpaint|mask|fill|make it|make this|turn this into)\b/i

    if (!forceImageGeneration && (hasInputImages || hasInputPdfs) && (!explicitImageVerb.test(lastUserMessage) || analysisIntent.test(lastUserMessage)) && !editIntent.test(lastUserMessage)) {
      const encoder = new TextEncoder()
      const visionTools: any[] = []
      const responseCreateParams: any = {
        model: effectiveModel,
        instructions: INSTRUCTIONS_MARKDOWN,
        reasoning: {
          effort: enforcedEffort,
          ...(includeReasoningSummary ? { summary: 'auto' } : {}),
        },
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: lastUserMessage || 'Analyze the attached files' },
            ...(inputImages || []).map((url) => ({ type: 'input_image', image_url: url })),
            ...(inputPdfs || []).map((p) => ({ type: 'input_file', filename: p.filename, file_data: p.dataUrl })),
          ],
        }],
        tools: visionTools,
        previous_response_id: previousResponseId ?? undefined,
        tool_choice: 'auto',
        include: [
          ...(includeEncryptedReasoning ? ['reasoning.encrypted_content'] as string[] : []),
        ],
        ...(typeof max_output_tokens === 'number' && max_output_tokens > 0 ? { max_output_tokens } : {}),
      }
      
      if (isProModel) {
        responseCreateParams.background = true
        responseCreateParams.store = true
      }
      const stream = await client.responses.stream(responseCreateParams)
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of stream) {
              const type = String((event as any)?.type || '')
              if (type === 'response.output_text.delta') {
                const delta = String((event as any).delta || '')
                controller.enqueue(encoder.encode(delta))
                continue
              }
            if (type.startsWith('response.reasoning') && (event as any)?.delta) {
              const thought = String((event as any).delta)
              controller.enqueue(encoder.encode(`\n<thinking:${thought}>`))
              continue
            }
            }
          } catch (error) {
            console.error('Vision stream error', error)
            controller.enqueue(encoder.encode(`\n[error] A server error occurred. Please try again.\n`))
          } finally {
            try {
              const hasFinal = typeof (stream as any).final === 'function'
              const finalResponse = hasFinal ? await (stream as any).final() : undefined
              try {
                const outputs: any[] = (finalResponse && (finalResponse as any).output) || []
                const { citations, summaryText } = collectCitationsAndSummary(outputs)
                enqueueSourcesIfAny(controller, encoder, citations)
                enqueueSummaryIfAny(controller, encoder, summaryText)
              } catch {}
              enqueueResponseIdIfAny(controller, encoder, finalResponse)
            } catch {}
            controller.close()
          }
        },
      })

      return new Response(readable, { headers: { ...STREAM_HEADERS } })
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

        if (maskDataUrl) {
          const readable = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                const maskFile = await dataUrlToFile(maskDataUrl, 'mask.png')
                const editParams: any = {
                  model: 'gpt-image-1',
                  image: inputImages?.[0] ? [await dataUrlToFile(inputImages[0], 'image_1.png')] : undefined,
                  mask: maskFile,
                  prompt: lastUserMessage,
                  size: 'auto',
                  quality: 'high',
                  background: 'auto',
                  input_fidelity: 'high',
                  output_format: 'png',
                }

                const result = await client.images.edit(editParams)
                const image_base64 = (result as any).data?.[0]?.b64_json
                
                if (typeof image_base64 === 'string' && image_base64.length > 0) {
                  controller.enqueue(encoder.encode(`\n<image:data:image/png;base64,${image_base64}>\n`))
                } else {
                  controller.enqueue(encoder.encode(`\n[error] No image returned from Image API\n`))
                }
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error'
                controller.enqueue(encoder.encode(`\n[error] ${message}\n`))
              } finally {
                controller.close()
              }
            },
          })

          return new Response(readable, { headers: { ...STREAM_HEADERS } })
        }

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

        const responseCreateParams: any = {
          model: effectiveModel,
          instructions: INSTRUCTIONS_MARKDOWN,
          reasoning: {
            effort: enforcedEffort,
            ...(includeReasoningSummary ? { summary: 'auto' } : {}),
          },
          tools: [toolOptions],
          previous_response_id: previousResponseId ?? undefined,
          input: hasInputImages
            ? [{
                role: 'user',
                content: [
                  { type: 'input_text', text: lastUserMessage },
                  ...inputImages.map((url) => ({ type: 'input_image', image_url: url })),
                ],
              }]
            : lastUserMessage,
          ...(typeof max_output_tokens === 'number' && max_output_tokens > 0 ? { max_output_tokens } : {}),
        }
        
        if (isProModel) {
          responseCreateParams.background = true
          responseCreateParams.store = true
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
                  const thought = String((event as any).delta)
                  controller.enqueue(encoder.encode(`\n<thinking:${thought}>`))
                  continue
                }
                if (type.endsWith('.error') || type === 'error') {
                  controller.enqueue(encoder.encode(`\n[error] Image generation error. Please try again.\n`))
                  continue
                }
              }
            } catch (err) {
              console.error('Image generation stream error', err)
              controller.enqueue(encoder.encode(`\n[error] Image generation failed. Please try again.\n`))
            } finally {
              try {
                const hasFinal = typeof (stream as any).final === 'function'
                const finalResponse = hasFinal ? await (stream as any).final() : undefined
                const outputs = (finalResponse && (finalResponse as any).output) || []
                const imageCalls = Array.isArray(outputs)
                  ? outputs.filter((o: any) => o && o.type === 'image_generation_call')
                  : []
                
                for (const call of imageCalls) {
                  const base64 = call?.result
                  if (typeof base64 === 'string' && base64.length > 0) {
                    controller.enqueue(encoder.encode(`\n<image:data:image/png;base64,${base64}>\n`))
                  }
                  const revised = call?.revised_prompt
                  if (typeof revised === 'string' && revised) {
                    controller.enqueue(encoder.encode(`\n<revised_prompt:${revised}>\n`))
                  }
                }
                try {
                  const { citations, summaryText } = collectCitationsAndSummary(outputs)
                  enqueueSourcesIfAny(controller, encoder, citations)
                  enqueueSummaryIfAny(controller, encoder, summaryText)
                } catch {}
                enqueueResponseIdIfAny(controller, encoder, finalResponse)
              } catch {}
              controller.close()
            }
          },
        })

        return new Response(readable, { headers: { ...STREAM_HEADERS } })
      } catch (err) {
        console.error('Image generation error', err)
        return new Response('There was an error generating the image. Please try again.', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 500,
        })
      }
    }

    // Only include compute tools that are supported for this model
    const toolList: any[] = []
    const responseParams: any = {
      model: effectiveModel,
      reasoning: {
        effort: enforcedEffort,
        ...(includeReasoningSummary ? { summary: 'auto' } : {}),
      },
      instructions: INSTRUCTIONS_MARKDOWN,
      input: prompt,
      tools: toolList,
      previous_response_id: previousResponseId ?? undefined,
      tool_choice: 'auto',
      include: [
        ...(includeEncryptedReasoning ? ['reasoning.encrypted_content'] as string[] : []),
      ],
      ...(typeof max_output_tokens === 'number' && max_output_tokens > 0 ? { max_output_tokens } : {}),
    }
    
    if (isProModel) {
      responseParams.background = true
      responseParams.store = true
    }
    const stream = await client.responses.stream(responseParams as any)

    const encoder = new TextEncoder()
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream as any) {
            const type = String((event as any)?.type || '')
            if (type === 'response.output_text.delta') {
              const delta = String((event as any).delta || '')
              controller.enqueue(encoder.encode(delta))
              continue
            }
            if (type.startsWith('response.reasoning') && (event as any)?.delta) {
              const thought = String((event as any).delta)
              controller.enqueue(encoder.encode(`\n<thinking:${thought}>`))
              continue
            }
          }
        } catch (error) {
          console.error('Text stream error', error instanceof Error ? { message: error.message, stack: error.stack } : error)
          controller.enqueue(encoder.encode(`\n[error] A server error occurred. Please try again.`))
        } finally {
          try {
            const hasFinal = typeof (stream as any).final === 'function'
            const finalResponse = hasFinal ? await (stream as any).final() : undefined
            const outputs = (finalResponse && finalResponse.output) || []

            try {
              const { citations, summaryText } = collectCitationsAndSummary(outputs)
              enqueueSourcesIfAny(controller, encoder, citations)
              enqueueSummaryIfAny(controller, encoder, summaryText)
            } catch {}
            enqueueResponseIdIfAny(controller, encoder, finalResponse)
            const status = finalResponse?.status
            const incompleteReason = finalResponse?.incomplete_details?.reason
            if (status === 'incomplete' && typeof incompleteReason === 'string' && incompleteReason) {
              controller.enqueue(encoder.encode(`\n<incomplete:${incompleteReason}>\n`))
            }
          } catch {}
          controller.close()
        }
      },
    })

    return new Response(readable, { headers: { ...STREAM_HEADERS } })
  } catch (error) {
    console.error('Playground API error', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}