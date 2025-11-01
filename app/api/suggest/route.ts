export const runtime = 'nodejs'

import type { SerpApiCommonParams } from '@/app/types/api'

async function fetchSerp<T>(params: SerpApiCommonParams): Promise<T> {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    usp.set(k, String(v))
  }
  const url = `https://serpapi.com/search.json?${usp.toString()}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch {}
    throw new Error(detail || `SerpApi error: ${res.status}`)
  }
  return (await res.json()) as T
}

async function fetchGoogleChromeSuggest(q: string, hl: string, gl: string): Promise<string[]> {
  const usp = new URLSearchParams({ client: 'chrome', q, hl, gl })
  const url = `https://suggestqueries.google.com/complete/search?${usp.toString()}`
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`Google suggest error: ${res.status}`)
  // Response format: [query, [s1, s2, ...], ...]
  const data = await res.json()
  const arr = Array.isArray(data?.[1]) ? data[1] : []
  return (arr as any[]).filter((v) => typeof v === 'string') as string[]
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    if (!q) return new Response('Missing q', { status: 400 })

    const hl = searchParams.get('hl') || 'en'
    const gl = searchParams.get('gl') || 'us'
    const limit = Math.max(1, Math.min(10, Number(searchParams.get('limit')) || 8))

    const apiKey = process.env.SERPAPI_API_KEY || process.env.NEXT_PUBLIC_SERPAPI_API_KEY

    let raw: any[] = []
    if (apiKey) {
      try {
        const data = await fetchSerp<any>({
          engine: 'google_autocomplete',
          q,
          api_key: apiKey,
          hl,
          gl,
          // @ts-ignore
          client: 'chrome',
        } as any)
        raw = Array.isArray(data?.suggestions) ? data.suggestions : []
      } catch {
        // fall back to Google's public endpoint
        raw = await fetchGoogleChromeSuggest(q, hl, gl)
      }
    } else {
      // No API key configured: graceful fallback
      raw = await fetchGoogleChromeSuggest(q, hl, gl)
    }

    const texts: string[] = raw
      .map((s: any) => {
        if (typeof s === 'string') return s
        if (!s || typeof s !== 'object') return ''
        return (
          (typeof s.value === 'string' && s.value) ||
          (typeof s.term === 'string' && s.term) ||
          (typeof s.query === 'string' && s.query) ||
          (typeof s.phrase === 'string' && s.phrase) ||
          ''
        )
      })
      .filter((v: string) => !!v)

    // De-dupe while preserving order
    const seen = new Set<string>()
    const deduped: string[] = []
    for (const s of texts) {
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(s)
      if (deduped.length >= limit) break
    }

    return new Response(JSON.stringify({ query: q, suggestions: deduped }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}


