export const runtime = 'nodejs'

import type { SearchRequest, SerpApiCommonParams } from '@/app/types/api'
import { getSerpConfig } from '@/app/lib/env'
import { json, jsonError } from '@/app/lib/http'
import { fetchSerp, mergeAndFilterVideos } from '@/app/lib/services/serp'
import { extractYouTubeIdFromUrl, normalizeLinkForKey, hasAnyVideoThumbCandidate } from '@/app/lib/serp-utils'

export async function GET(req: Request) {
  try {
    const { apiKey } = getSerpConfig()
    if (!apiKey) {
      return jsonError(500, 'config_error', 'Server not configured: missing SERPAPI_API_KEY')
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
      fetchSerp<any>({ engine: 'google', tbm: 'nws', ...common, kgmid }),
      fetchSerp<any>({ engine: 'youtube', search_query: q, api_key: apiKey, hl, gl, sp: yt_sp }),
    ])

    const mergedVideosFiltered = mergeAndFilterVideos(googleVideos, yt)

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

    return json(result, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return jsonError(500, 'server_error', msg)
  }
}

export async function POST(req: Request) {
  try {
    const { apiKey } = getSerpConfig()
    if (!apiKey) {
      return jsonError(500, 'config_error', 'Server not configured: missing SERPAPI_API_KEY')
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

    return json(result, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return jsonError(500, 'server_error', msg)
  }
}