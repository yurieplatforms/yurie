import { NextResponse } from 'next/server'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function POST(request: Request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { messages } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'No messages provided' },
      { status: 400 },
    )
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY not set' },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': process.env.NEXT_PUBLIC_APP_TITLE ?? '',
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          {
            role: 'system',
            content:
              'Generate a 5 to 6 word title summarizing the user\'s specific query. Do not use markdown, quotes, or any formatting. Output only the plain text title.',
          },
          ...messages,
        ],
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate title')
    }

    const data = await response.json()
    const title = data.choices[0]?.message?.content?.trim() || 'New Chat'

    return NextResponse.json({ title })
  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 },
    )
  }
}

