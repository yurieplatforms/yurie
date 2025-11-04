import type { SerpApiCommonParams } from '@/app/types/api'

export function extractYouTubeIdFromUrl(href: string | undefined | null): string | null {
  if (!href) return null
  try {
    const u = new URL(href)
    if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//, '') || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/(?:shorts|embed)\/([^\/?#]+)/)
      return (m && m[1]) || null
    }
  } catch {}
  return null
}

export function normalizeLinkForKey(href: string | undefined | null): string {
  if (!href) return ''
  try {
    const u = new URL(href)
    return `${u.origin}${u.pathname}`
  } catch {
    return String(href)
  }
}

export function hasAnyVideoThumbCandidate(item: any): boolean {
  const link = item?.link || item?.url || ''
  const yt = extractYouTubeIdFromUrl(link)
  if (yt) return true
  const list = [item?.thumbnail, item?.thumbnail_url, item?.image, item?.thumbnail_static]
  const candidates = (list.filter((u) => typeof u === 'string' && !!u) as string[])
  if (candidates.length === 0) return false
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


