import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

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

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not set' },
      { status: 500 },
    )
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      } as Anthropic.MessageParam)
    )

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      system: 'Generate a 5 to 6 word title summarizing the user\'s specific query. Do not use markdown, quotes, or any formatting. Output only the plain text title.',
      messages: anthropicMessages,
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    const title = textBlock && 'text' in textBlock ? textBlock.text.trim() : 'New Chat'

    return NextResponse.json({ title })
  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 },
    )
  }
}
