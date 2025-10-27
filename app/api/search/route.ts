export const runtime = 'nodejs'

import type { SearchRequest, SerpApiCommonParams } from '@/app/types/api'

function extractYouTubeIdFromUrl(href: string | undefined | null): string | null {
  if (!href) return null
  try {
    const u = new URL(href)
    if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//, '') || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)
      return (m && m[1]) || null
    }
  } catch {}
  return null
}

function normalizeLinkForKey(href: string | undefined | null): string {
  if (!href) return ''
  try {
    const u = new URL(href)
    // Use origin + path to avoid duplicate keys due to tracking params
    return `${u.origin}${u.pathname}`
  } catch {
    return String(href)
  }
}

function hasAnyVideoThumbCandidate(item: any): boolean {
  const link = item?.link || item?.url || ''
  const yt = extractYouTubeIdFromUrl(link)
  if (yt) return true
  const list = [item?.thumbnail, item?.thumbnail_url, item?.image, item?.thumbnail_static]
  const candidates = (list.filter((u) => typeof u === 'string' && !!u) as string[])
  if (candidates.length === 0) return false
  // Exclude items whose only thumbnails are YouTube-hosted (often "unavailable" placeholders)
  const nonYt = candidates.filter((u) => {
    try {
      const h = new URL(u).hostname
      return !(h.includes('i.ytimg.com') || h.includes('img.youtube.com'))
    } catch {
      return true
    }
  })
  return nonYt.length > 0
}

async function fetchSerp<T>(params: SerpApiCommonParams): Promise<T> {
  const usp = new URLSearchParams()
  const cloned: Record<string, any> = { ...params }
  // Map q -> search_query for YouTube engine per SerpApi docs
  if (cloned.engine === 'youtube') {
    if (!cloned.search_query && cloned.q) {
      cloned.search_query = cloned.q
    }
    delete cloned.q
  }
  for (const [k, v] of Object.entries(cloned)) {
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

export async function GET(req: Request) {
  try {
    const apiKey = process.env.SERPAPI_API_KEY || process.env.NEXT_PUBLIC_SERPAPI_API_KEY
    if (!apiKey) {
      return new Response('Server not configured: missing SERPAPI_API_KEY', { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    if (!q) return new Response('Missing q', { status: 400 })

    const location = searchParams.get('location') || undefined
    const hl = searchParams.get('hl') || undefined
    const gl = searchParams.get('gl') || undefined
    const google_domain = searchParams.get('google_domain') || undefined
    const safe = (searchParams.get('safe') as 'active' | 'off' | null) || undefined
    const num = searchParams.get('num') ? Number(searchParams.get('num')) : undefined
    const start = searchParams.get('start') ? Number(searchParams.get('start')) : undefined
    const kgmid = searchParams.get('kgmid') || undefined

    const base: Omit<SerpApiCommonParams, 'engine' | 'q' | 'api_key'> = {
      location,
      hl,
      gl,
      google_domain,
      safe,
      num,
      start,
    }

    const common = { ...base, q, api_key: apiKey }

    const yt_sp = searchParams.get('yt_sp') || undefined

    const [all, images, googleVideos, news, yt] = await Promise.all([
      fetchSerp<any>({ engine: 'google', ...common }),
      fetchSerp<any>({ engine: 'google_images', ...common }),
      fetchSerp<any>({ engine: 'google_videos', ...common }),
      // Per SerpApi docs, use tbm=nws for Google News to unlock clusters
      fetchSerp<any>({ engine: 'google', tbm: 'nws', ...common, kgmid }),
      fetchSerp<any>({ engine: 'youtube', search_query: q, api_key: apiKey, hl, gl, sp: yt_sp }),
    ])

    // Merge and sanitize video results (YouTube + Google Videos)
    const mergedVideosRaw: any[] = [
      ...(googleVideos?.video_results || googleVideos?.videos_results || []),
      ...(yt?.video_results || yt?.videos_results || []),
    ]
    const seen = new Set<string>()
    const mergedVideosFiltered: any[] = []
    for (const v of mergedVideosRaw) {
      const link = v?.link || v?.url
      const title = v?.title || v?.video_title || v?.name
      if (!link || !title) continue
      if (!hasAnyVideoThumbCandidate(v)) continue
      const ytid = extractYouTubeIdFromUrl(link)
      const key = ytid ? `yt:${ytid}` : `ln:${normalizeLinkForKey(link)}`
      if (seen.has(key)) continue
      seen.add(key)
      mergedVideosFiltered.push(v)
    }

    const result = {
      query: q,
      all: {
        search_information: all?.search_information,
        organic_results: all?.organic_results || [],
        related_questions: all?.related_questions || [],
        related_searches: all?.related_searches || [],
        knowledge_graph: all?.knowledge_graph,
        top_stories: all?.top_stories || [],
          inline_images: all?.inline_images || [],
          inline_images_suggested_searches: all?.inline_images_suggested_searches || [],
        // Pass through additional All tab sources
        answer_box: all?.answer_box,
        featured_snippet: all?.featured_snippet,
        recipes_results: all?.recipes_results || [],
        shopping_results: all?.shopping_results || [],
        available_on: all?.available_on || [],
        local_map: all?.local_map,
        local_results: all?.local_results,
        pagination: all?.pagination,
        serpapi_pagination: all?.serpapi_pagination,
      },
      images: {
        images_results: images?.images_results || [],
        suggested_searches: images?.suggested_searches || [],
      },
      videos: {
        videos_results: mergedVideosFiltered,
        related_searches: (yt?.related_searches || []).concat(googleVideos?.related_searches || []),
        serpapi_pagination: yt?.serpapi_pagination,
      },
      news: {
        news_results: news?.news_results || news?.top_stories || [],
        people_also_search_for: news?.people_also_search_for || [],
        serpapi_pagination: news?.serpapi_pagination,
      },
      sources: {
        all_endpoint: 'https://serpapi.com/search-api',
        api_query: 'https://serpapi.com/search.json?engine=google&q=' + encodeURIComponent(q),
        youtube_query: 'https://serpapi.com/search.json?engine=youtube&search_query=' + encodeURIComponent(q),
        youtube_endpoint: 'https://serpapi.com/youtube-search-api',
        videos_results_endpoint: 'https://serpapi.com/videos-results',
        google_videos_endpoint: 'https://serpapi.com/google-videos-api',
        news_endpoint: 'https://serpapi.com/news-results',
        news_query: 'https://serpapi.com/search.json?q=' + encodeURIComponent(q) + '&tbm=nws' + (kgmid ? `&kgmid=${encodeURIComponent(kgmid)}` : ''),
        available_on_endpoint: 'https://serpapi.com/available-on',
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.SERPAPI_API_KEY || process.env.NEXT_PUBLIC_SERPAPI_API_KEY
    if (!apiKey) {
      return new Response('Server not configured: missing SERPAPI_API_KEY', { status: 500 })
    }
    const body = (await req.json()) as SearchRequest
    const q = (body.q || '').trim()
    if (!q) return new Response('Missing q', { status: 400 })
    const kgmid = (body.kgmid || '').trim() || undefined

    const base: Omit<SerpApiCommonParams, 'engine' | 'q' | 'api_key'> = {
      location: body.location,
      hl: body.hl,
      gl: body.gl,
      google_domain: body.google_domain,
      safe: body.safe,
      num: body.num,
      start: body.start,
    }
    const common = { ...base, q, api_key: apiKey }

    const [all, images, videos, news] = await Promise.all([
      fetchSerp<any>({ engine: 'google', ...common }),
      fetchSerp<any>({ engine: 'google_images', ...common }),
      fetchSerp<any>({ engine: 'google_videos', ...common }),
      fetchSerp<any>({ engine: 'google', tbm: 'nws', ...common, kgmid }),
    ])

    const result = {
      query: q,
      all: {
        search_information: all?.search_information,
        organic_results: all?.organic_results || [],
        related_questions: all?.related_questions || [],
        related_searches: all?.related_searches || [],
        knowledge_graph: all?.knowledge_graph,
        top_stories: all?.top_stories || [],
          inline_images: all?.inline_images || [],
          inline_images_suggested_searches: all?.inline_images_suggested_searches || [],
        // Pass through additional All tab sources
        answer_box: all?.answer_box,
        featured_snippet: all?.featured_snippet,
        recipes_results: all?.recipes_results || [],
        shopping_results: all?.shopping_results || [],
        available_on: all?.available_on || [],
        local_map: all?.local_map,
        local_results: all?.local_results,
        pagination: all?.pagination,
        serpapi_pagination: all?.serpapi_pagination,
      },
      images: {
        images_results: images?.images_results || [],
        suggested_searches: images?.suggested_searches || [],
      },
      videos: {
        videos_results: (() => {
          const raw = (videos?.video_results || videos?.videos_results || []) as any[]
          const seen = new Set<string>()
          const out: any[] = []
          for (const v of raw) {
            const link = v?.link || v?.url
            const title = v?.title || v?.video_title || v?.name
            if (!link || !title) continue
            if (!hasAnyVideoThumbCandidate(v)) continue
            const ytid = extractYouTubeIdFromUrl(link)
            const key = ytid ? `yt:${ytid}` : `ln:${normalizeLinkForKey(link)}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push(v)
          }
          return out
        })(),
        related_searches: videos?.related_searches || [],
      },
      news: {
        news_results: news?.news_results || news?.top_stories || [],
        people_also_search_for: news?.people_also_search_for || [],
        serpapi_pagination: news?.serpapi_pagination,
      },
      sources: {
        all_endpoint: 'https://serpapi.com/search-api',
        api_query: 'https://serpapi.com/search.json?engine=google&q=' + encodeURIComponent(q),
        youtube_endpoint: 'https://serpapi.com/youtube-search-api',
        videos_results_endpoint: 'https://serpapi.com/videos-results',
        google_videos_endpoint: 'https://serpapi.com/google-videos-api',
        news_endpoint: 'https://serpapi.com/news-results',
        news_query: 'https://serpapi.com/search.json?q=' + encodeURIComponent(q) + '&tbm=nws' + (kgmid ? `&kgmid=${encodeURIComponent(kgmid)}` : ''),
        available_on_endpoint: 'https://serpapi.com/available-on',
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}


