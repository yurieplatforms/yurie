import { tavily } from '@tavily/core'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const { query } = (await request.json()) as { query?: string }
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing TAVILY_API_KEY server env var' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tvly = tavily({ apiKey })
    const q = typeof query === 'string' && query.trim().length > 0 ? query.trim() : 'Who is Leo Messi?'
    const response = await tvly.search(q)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ usage: 'POST { query: string } to /api/tavily' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}


