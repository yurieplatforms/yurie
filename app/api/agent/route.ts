import { NextResponse } from 'next/server'

type Role = 'system' | 'user' | 'assistant' | 'tool'

type MessageContentSegment =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image_url'
      image_url: {
        url: string
      }
    }
  | {
      type: 'file'
      file: {
        filename: string
        file_data: string
      }
    }

type ChatMessage = {
  role: Role
  content: string | MessageContentSegment[]
}

type AgentRequestBody = {
  messages: ChatMessage[]
  useWebSearch?: boolean
}

const OPENROUTER_API_URL =
  'https://openrouter.ai/api/v1/chat/completions'

export async function POST(request: Request) {
  let body: AgentRequestBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'Request must include at least one message' },
      { status: 400 },
    )
  }

  const { messages, useWebSearch } = body

  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'OPENROUTER_API_KEY is not set. Add it to your environment variables.',
      },
      { status: 500 },
    )
  }

  try {
    const upstreamResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Optional attribution headers per OpenRouter docs:
        // https://openrouter.ai/docs/app-attribution
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': process.env.NEXT_PUBLIC_APP_TITLE ?? '',
      },
      body: JSON.stringify({
        model: '@preset/yurie-ai',
        stream: true,
        messages,
        reasoning: {
          effort: 'high',
        },
        ...(useWebSearch
          ? {
              plugins: [
                {
                  id: 'web',
                },
              ],
            }
          : {}),
      }),
    })

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errorText = await upstreamResponse
        .text()
        .catch(() => '')

      console.error(
        '[agent] OpenRouter error',
        upstreamResponse.status,
        errorText,
      )

      return NextResponse.json(
        { error: 'Failed to generate response from OpenRouter' },
        { status: 502 },
      )
    }

    // Proxy the OpenRouter streaming response (SSE) directly to the client.
    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[agent] Unexpected error', error)

    return NextResponse.json(
      { error: 'Unexpected error while contacting OpenRouter' },
      { status: 500 },
    )
  }
}
