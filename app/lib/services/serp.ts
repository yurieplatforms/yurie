import type { SerpApiCommonParams } from '@/app/types/api'
import { extractYouTubeIdFromUrl, normalizeLinkForKey, hasAnyVideoThumbCandidate } from '@/app/lib/serp-utils'

export async function fetchSerp<T>(params: SerpApiCommonParams): Promise<T> {
  const usp = new URLSearchParams()
  const cloned: Record<string, any> = { ...params }
  if (cloned.engine === 'youtube') {
    if (!cloned.search_query && cloned.q) cloned.search_query = cloned.q
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

export function mergeAndFilterVideos(googleVideos: any, yt: any): any[] {
  const merged: any[] = [
    ...(googleVideos?.video_results || googleVideos?.videos_results || []),
    ...(yt?.video_results || yt?.videos_results || []),
  ]
  const seen = new Set<string>()
  const out: any[] = []
  for (const v of merged) {
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
}
