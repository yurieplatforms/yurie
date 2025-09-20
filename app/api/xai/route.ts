export const runtime = 'nodejs'
export const maxDuration = 300

async function proxyPython(rawBody: string): Promise<Response | null> {
  const baseURL =
    process.env.PY_API_URL || process.env.NEXT_PUBLIC_PY_API_URL || ''
  if (!baseURL) return null
  try {
    const res = await fetch(`${baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    })
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '')
      return new Response(
        JSON.stringify({ error: { code: res.status, message: text || `HTTP ${res.status}` } }),
        { status: res.status, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    const py = await proxyPython(raw)
    if (py) return py
    return new Response(
      JSON.stringify({ error: { code: 500, message: 'Python xAI backend not reachable. Set PY_API_URL or NEXT_PUBLIC_PY_API_URL.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 500, message: 'Internal server error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

