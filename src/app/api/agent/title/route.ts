import { NextResponse } from 'next/server'

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

  // Find the first user message and use it as the title
  const firstUserMessage = messages.find(
    (msg: { role: string; content: string }) => msg.role === 'user'
  )

  const title = firstUserMessage?.content?.trim() || 'New Chat'

  return NextResponse.json({ title })
}
