/**
 * Shared helpers for SERP and video URL handling
 */

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


