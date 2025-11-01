"use client"

import * as React from 'react'
import { cn } from '@/app/lib/utils'

type SearchResultsProps = {
  data: any | null
  className?: string
  section?: 'All' | 'Images' | 'Videos' | 'News'
  onSwitchSection?: (section: 'All' | 'Images' | 'Videos' | 'News') => void
}

export function SearchResults({ data, className, section }: SearchResultsProps) {
  if (!data) return null
  const all = data.all || {}
  const images = data.images || {}
  const videos = data.videos || {}
  const news = data.news || {}
  const showAll = !section || section === 'All'
  const showImages = !section || section === 'Images'
  const showVideos = !section || section === 'Videos'
  const showNews = !section || section === 'News'
  const queryText = String(data?.query || '')
  const [videoItems, setVideoItems] = React.useState<any[]>([])
  const [nextYtToken, setNextYtToken] = React.useState<string | null>(null)
  const [loadingMoreVideos, setLoadingMoreVideos] = React.useState(false)
  const [organicItems, setOrganicItems] = React.useState<any[]>([])
  const [nextAllStart, setNextAllStart] = React.useState<number | null>(null)
  const [loadingMoreAll, setLoadingMoreAll] = React.useState(false)
  const [currentAllPage, setCurrentAllPage] = React.useState<number>(1)
  const [allPageMap, setAllPageMap] = React.useState<Record<number, { start: number; num?: number }>>({})
  const [loadingAllPage, setLoadingAllPage] = React.useState(false)

  const serpAll = all?.serpapi_pagination
  const allPageNumbers = React.useMemo(() => {
    const set = new Set<number>()
    // Always include page 1
    set.add(1)
    const other = (serpAll && serpAll.other_pages) || {}
    for (const k of Object.keys(other)) {
      const n = Number(k)
      if (!isNaN(n) && n > 0) set.add(n)
    }
    if (typeof currentAllPage === 'number' && currentAllPage > 0) set.add(currentAllPage)
    return Array.from(set).sort((a, b) => a - b)
  }, [serpAll, currentAllPage])
  const displayAllPages = React.useMemo(() => {
    const maxToShow = 10
    const pages = allPageNumbers
    // Always show only the first 10 pages (1..10)
    return pages.slice(0, maxToShow)
  }, [allPageNumbers])
  const canPrevAll = React.useMemo(() => currentAllPage > 1, [currentAllPage])
  const canNextAll = React.useMemo(() => {
    const last = displayAllPages.length > 0 ? displayAllPages[displayAllPages.length - 1] : 1
    return currentAllPage < last
  }, [currentAllPage, displayAllPages])
  const toText = (val: any): string => {
    if (val == null) return ''
    const t = typeof val
    if (t === 'string' || t === 'number' || t === 'boolean') return String(val)
    if (Array.isArray(val)) return val.map((v) => toText(v)).filter(Boolean).join(', ')
    if (t === 'object') {
      if (typeof (val as any).name === 'string') return (val as any).name
      if (typeof (val as any).title === 'string') return (val as any).title
    }
    return ''
  }
  const extractYouTubeId = (url: string): string | null => {
    try {
      const u = new URL(url)
      if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//, '') || null
      if (u.hostname.includes('youtube.com')) {
        if (u.pathname === '/watch') return u.searchParams.get('v')
        // shorts or embed
        const m = u.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/)
        return (m && m[1]) || null
      }
    } catch {}
    return null
  }
  const isYouTubeVideo = (v: any): boolean => {
    const href = v?.link || v?.url || ''
    return Boolean(extractYouTubeId(href))
  }
  const videoKey = (v: any): string => {
    const href = v?.link || v?.url || ''
    const yt = extractYouTubeId(href)
    if (yt) return `yt:${yt}`
    try {
      const u = new URL(href)
      return `ln:${u.origin}${u.pathname}`
    } catch {
      return `ln:${href}`
    }
  }
  const getVideoThumb = (v: any): string => {
    const href = v?.link || v?.url || ''
    const yt = extractYouTubeId(href)
    if (yt) {
      // Prefer high quality thumbnail for YouTube
      return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`
    }
    // Avoid returning YouTube-hosted placeholder thumbnails for non-YouTube links
    const list = [v?.thumbnail, v?.thumbnail_url, v?.image, v?.thumbnail_static]
    for (const u of list) {
      if (typeof u !== 'string' || !u) continue
      try {
        const h = new URL(u).hostname
        if (h.includes('i.ytimg.com') || h.includes('img.youtube.com')) continue
        return u
      } catch {
        return u
      }
    }
    return ''
  }
  const getVideoSrcSet = (v: any): string => {
    const href = v?.link || v?.url || ''
    const yt = extractYouTubeId(href)
    if (!yt) return ''
    return [
      `https://i.ytimg.com/vi/${yt}/mqdefault.jpg 320w`,
      `https://i.ytimg.com/vi/${yt}/hqdefault.jpg 480w`,
      `https://i.ytimg.com/vi/${yt}/sddefault.jpg 640w`,
      `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg 1280w`,
    ].join(', ')
  }
  const getVideoDuration = (v: any): string => {
    const ext = Array.isArray(v?.rich_snippet?.top?.extensions) ? v.rich_snippet.top.extensions : []
    const extDuration = (ext || []).find((e: any) => typeof e === 'string' && /\d{1,2}:\d{2}/.test(e))
    return v?.duration || v?.length || extDuration || ''
  }

  const isRenderableVideo = (v: any): boolean => {
    const href = v?.link || v?.url || ''
    const title = v?.title || v?.video_title || v?.name || ''
    if (!href || !title) return false
    const candidates = getVideoFallbackCandidates(v)
    return candidates.length > 0
  }
  const sortVideosYouTubeFirst = (arr: any[]): any[] => {
    return [...arr].sort((a, b) => {
      const ay = isYouTubeVideo(a) ? 0 : 1
      const by = isYouTubeVideo(b) ? 0 : 1
      return ay - by
    })
  }
  const dedupeVideos = (arr: any[]): any[] => {
    const seen = new Set<string>()
    const out: any[] = []
    for (const v of arr) {
      const k = videoKey(v)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(v)
    }
    return out
  }

  // Derive a human-friendly site label and favicon from a result URL
  const getHostname = (href: string): string => {
    try {
      const u = new URL(href)
      return (u.hostname || '').replace(/^www\./, '')
    } catch {
      return ''
    }
  }
  const getFaviconUrl = (hostname: string): string => {
    if (!hostname) return ''
    // Google s2 favicon service returns a small PNG; reliable and fast
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`
  }

  const getResultThumb = (item: any): string => {
    return (
      item?.thumbnail ||
      item?.image ||
      item?.thumbnail_src ||
      item?.rich_snippet?.top?.thumbnail ||
      item?.rich_snippet?.top?.image ||
      ''
    )
  }

  const getResultThumbCandidates = (item: any): string[] => {
    const list = [
      item?.thumbnail,
      item?.thumbnail_src,
      item?.thumbnail_url,
      item?.image,
      item?.thumbnail_static,
      item?.rich_snippet?.top?.image,
      item?.rich_snippet?.top?.thumbnail,
    ]
    return Array.from(new Set(list.filter((u) => typeof u === 'string' && u)))
  }

  const tryUpgradeUrlForHiDpi = (url: string, dpr = 2): string | null => {
    if (!url || typeof url !== 'string') return null
    try {
      const u = new URL(url)
      let updated = false

      // Bump common numeric query params used for resizing
      const bumpKeys = ['w', 'h', 'width', 'height', 's', 'rw', 'rh']
      for (const key of bumpKeys) {
        const val = u.searchParams.get(key)
        if (!val) continue
        const n = parseInt(val, 10)
        if (!isNaN(n) && n > 0) {
          u.searchParams.set(key, String(Math.min(n * dpr, 4096)))
          updated = true
        }
      }

      // Handle Google/LH3 style path directives like =s120 or =w120-h120
      let p = u.pathname
      const p1 = p.replace(/=s(\d+)([-a-z]*)/i, (_m, s: string, tail: string) => {
        updated = true
        return `=s${Math.min(parseInt(s, 10) * dpr, 4096)}${tail || ''}`
      })
      const p2 = p1.replace(/=w(\d+)-h(\d+)([-a-z]*)/i, (_m, w: string, h: string, tail: string) => {
        updated = true
        const nw = Math.min(parseInt(w, 10) * dpr, 4096)
        const nh = Math.min(parseInt(h, 10) * dpr, 4096)
        return `=w${nw}-h${nh}${tail || ''}`
      })
      // WordPress style -150x150 suffix
      const p3 = p2.replace(/-(\d+)x(\d+)(\.[a-z]+)$/i, (_m, w: string, h: string, ext: string) => {
        updated = true
        const nw = Math.min(parseInt(w, 10) * dpr, 4096)
        const nh = Math.min(parseInt(h, 10) * dpr, 4096)
        return `-${nw}x${nh}${ext}`
      })
      // Cloudinary-like w_150,h_150 in the path
      const p4 = p3
        .replace(/([,/_])w_(\d+)/g, (_m, sep: string, w: string) => {
          updated = true
          return `${sep}w_${Math.min(parseInt(w, 10) * dpr, 4096)}`
        })
        .replace(/([,/_])h_(\d+)/g, (_m, sep: string, h: string) => {
          updated = true
          return `${sep}h_${Math.min(parseInt(h, 10) * dpr, 4096)}`
        })
      if (p4 !== u.pathname) {
        u.pathname = p4
      }

      if (!updated) return null
      return u.toString()
    } catch {
      return null
    }
  }

  const SmallThumb: React.FC<{ item?: any; candidates?: string[]; alt?: string; className?: string }> = ({ item, candidates, alt, className }) => {
    const baseCandidates = React.useMemo(() => {
      const list = candidates && candidates.length > 0 ? candidates : getResultThumbCandidates(item || {})
      return Array.from(new Set(list.filter((u) => typeof u === 'string' && u)))
    }, [item, candidates])
    const base = baseCandidates[0] || ''
    const initialSrcSet = React.useMemo(() => {
      const hi = tryUpgradeUrlForHiDpi(base, 2)
      return hi ? `${base} 1x, ${hi} 2x` : ''
    }, [base])
    const [src, setSrc] = React.useState<string>(base)
    const [srcSet, setSrcSet] = React.useState<string>(initialSrcSet)
    const [idx, setIdx] = React.useState<number>(0)
    const [hidden, setHidden] = React.useState<boolean>(false)

    React.useEffect(() => {
      const b = baseCandidates[0] || ''
      const hi = tryUpgradeUrlForHiDpi(b, 2)
      setSrc(b)
      setSrcSet(hi ? `${b} 1x, ${hi} 2x` : '')
      setIdx(0)
      setHidden(false)
    }, [baseCandidates])

    const onError = () => {
      if (srcSet) {
        // Drop srcSet first to force base 1x
        setSrcSet('')
        setSrc(baseCandidates[idx] || base)
        return
      }
      const next = idx + 1
      if (next < baseCandidates.length) {
        setIdx(next)
        setSrc(baseCandidates[next])
      } else {
        setHidden(true)
      }
    }

    if (hidden || !src) return null

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        srcSet={srcSet || undefined}
        sizes="(min-width: 640px) 96px, 80px"
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onError}
        className={className || 'w-20 h-20 sm:w-24 sm:h-24 object-cover rounded'}
      />
    )
  }

  // Prefer higher quality image when available and provide a retina-friendly srcSet
  const getImageSrc = (img: any): string => {
    return img?.thumbnail || img?.image || img?.original || ''
  }
  const getImageSrcSet = (img: any): string => {
    const thumb = img?.thumbnail || img?.image || ''
    const orig = img?.original || ''
    if (thumb && orig && thumb !== orig) {
      // Use DPR-based descriptors so the browser can pick sharper assets on HiDPI
      return `${thumb} 1x, ${orig} 2x`
    }
    return ''
  }
  const getImageCandidates = (img: any): string[] => {
    // Prefer more reliable smaller assets first; we will still try larger ones via srcSet.
    const list = [img?.thumbnail, img?.image, img?.original]
    return Array.from(new Set(list.filter((u) => typeof u === 'string' && u)))
  }

  const getRichExtensions = (obj: any): string => {
    const top = Array.isArray(obj?.rich_snippet?.top?.extensions) ? obj.rich_snippet.top.extensions : []
    const bottom = Array.isArray(obj?.rich_snippet?.bottom?.extensions) ? obj.rich_snippet.bottom.extensions : []
    const any = Array.isArray(obj?.rich_snippet?.extensions) ? obj.rich_snippet.extensions : []
    return (top as any[]).concat(bottom as any[]).concat(any as any[]).filter((e) => typeof e === 'string').join(' · ')
  }

  // Extract a compact, human-friendly summary from detected_extensions
  const getDetectedExtensionsText = (obj: any): string => {
    const bag: Record<string, any> = {
      ...(obj?.detected_extensions || {}),
      ...(obj?.rich_snippet?.detected_extensions || {}),
      ...(obj?.rich_snippet?.top?.detected_extensions || {}),
      ...(obj?.rich_snippet?.bottom?.detected_extensions || {}),
    }
    const parts: string[] = []
    const rating = Number(bag.rating || bag.stars)
    const reviews = Number(bag.rating_count || bag.reviews)
    if (!isNaN(rating) && rating > 0) {
      const ratingStr = rating.toFixed(rating % 1 === 0 ? 0 : 1)
      if (!isNaN(reviews) && reviews > 0) {
        parts.push(`${ratingStr} (${new Intl.NumberFormat('en-US').format(reviews)})`)
      } else {
        parts.push(`${ratingStr}`)
      }
    }
    const price = bag.price || bag.price_from || bag.price_range
    if (typeof price === 'string' && price) parts.push(price)
    if (typeof bag.in_stock === 'boolean') parts.push(bag.in_stock ? 'In stock' : 'Out of stock')
    if (typeof bag.availability === 'string' && bag.availability) parts.push(bag.availability)
    if (typeof bag.duration === 'string' && bag.duration) parts.push(bag.duration)
    return parts.join(' · ')
  }

  const normalizeWhitespace = (s: string): string => s.replace(/\s+/g, ' ').trim()
  const truncateSmart = (s: string, max = 220): string => {
    const text = normalizeWhitespace(s)
    if (text.length <= max) return text
    const slice = text.slice(0, max)
    const punct = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
    const cutAt = punct > 40 ? punct + 1 : slice.lastIndexOf(' ')
    return `${slice.slice(0, Math.max(0, cutAt)).trim()}…`
  }

  const getDescription = (item: any): string => {
    const primaryCandidates = [item?.snippet, item?.description, item?.summary, item?.content]
    const primary = normalizeWhitespace(primaryCandidates.map(toText).find((t) => t) || '')
    const extDetected = getDetectedExtensionsText(item)
    const extStrings = getRichExtensions(item)
    const highlights = Array.isArray(item?.snippet_highlighted_words)
      ? (item.snippet_highlighted_words as any[]).filter((w) => typeof w === 'string').join(' ')
      : ''
    const metaParts = [extDetected, extStrings, highlights].map(normalizeWhitespace).filter(Boolean)
    const meta = Array.from(new Set(metaParts)).join(' · ')
    const combined = [primary, meta].filter(Boolean).join(' · ')
    return truncateSmart(combined)
  }

  // Format a news item's published date as "Aug 11, 2025"
  const parseDateFromUnknown = (input: any): Date | null => {
    if (!input) return null
    // Numeric epoch seconds or ms
    if (typeof input === 'number') {
      const ms = input < 10_000_000_000 ? input * 1000 : input
      const d = new Date(ms)
      return isNaN(d.getTime()) ? null : d
    }
    if (typeof input === 'string') {
      const s = input.trim()
      if (!s) return null

      const lower = s.toLowerCase()
      if (lower === 'yesterday') {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return d
      }
      if (lower === 'today') {
        return new Date()
      }

      // "3 hours ago", "2 days ago", "5 mins ago", "1 yr ago", etc.
      const rel = s.match(/^(\d+)\s*(seconds?|secs?|s|minutes?|mins?|min|hours?|hrs?|hr|h|days?|d|weeks?|wks?|wk|w|months?|mos?|mo|years?|yrs?|yr|y)\s+ago$/i)
      if (rel) {
        const count = parseInt(rel[1], 10)
        const unit = rel[2].toLowerCase()
        const d = new Date()
        if (['second', 'seconds', 'sec', 'secs', 's'].includes(unit)) {
          d.setSeconds(d.getSeconds() - count)
          return d
        }
        if (['minute', 'minutes', 'mins', 'min'].includes(unit)) {
          d.setMinutes(d.getMinutes() - count)
          return d
        }
        if (['hour', 'hours', 'hr', 'hrs', 'h'].includes(unit)) {
          d.setHours(d.getHours() - count)
          return d
        }
        if (['day', 'days', 'd'].includes(unit)) {
          d.setDate(d.getDate() - count)
          return d
        }
        if (['week', 'weeks', 'wk', 'wks', 'w'].includes(unit)) {
          d.setDate(d.getDate() - count * 7)
          return d
        }
        if (['month', 'months', 'mo', 'mos'].includes(unit)) {
          d.setMonth(d.getMonth() - count)
          return d
        }
        if (['year', 'years', 'yr', 'yrs', 'y'].includes(unit)) {
          d.setFullYear(d.getFullYear() - count)
          return d
        }
      }

      // Try native Date parsing for strings like "Aug 11, 2025" or ISO
      const parsed = Date.parse(s)
      if (!isNaN(parsed)) return new Date(parsed)
    }
    return null
  }

  const formatShortUSDate = (d: Date): string => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getNewsDateLabel = (item: any): string => {
    const candidates = [
      item?.date,
      item?.published_at,
      item?.date_published,
      item?.time,
      item?.timestamp,
      item?.published_time,
      item?.date_utc,
    ]
    for (const c of candidates) {
      const d = parseDateFromUnknown(c)
      if (d) return formatShortUSDate(d)
    }
    return ''
  }

  

  React.useEffect(() => {
    const initialAll = Array.isArray(videos.videos_results) ? videos.videos_results.filter(isRenderableVideo) : []
    const initialSorted = sortVideosYouTubeFirst(dedupeVideos(initialAll))
    setVideoItems(initialSorted)
    const token = videos?.serpapi_pagination?.next_page_token || null
    setNextYtToken(token)

    // Initialize All tab organic list and pagination
    setOrganicItems(Array.isArray(all.organic_results) ? all.organic_results : [])
    const getStartFromUrl = (u: string | undefined | null): number | null => {
      if (!u || typeof u !== 'string') return null
      try {
        const url = new URL(u)
        const s = url.searchParams.get('start')
        return s ? Number(s) : null
      } catch {
        return null
      }
    }
    const nextFromSerp = getStartFromUrl(all?.serpapi_pagination?.next_link || all?.serpapi_pagination?.next)
    const nextFromGoogle = getStartFromUrl(all?.pagination?.next)
    setNextAllStart(nextFromSerp ?? nextFromGoogle ?? null)
    const buildMapFromSerp = (sp: any): Record<number, { start: number; num?: number }> => {
      const map: Record<number, { start: number; num?: number }> = {}
      const other = (sp && sp.other_pages) || {}
      for (const [p, u] of Object.entries(other)) {
        try {
          const url = new URL(String(u))
          const startStr = url.searchParams.get('start')
          const numStr = url.searchParams.get('num')
          const pageNum = Number(p)
          const startNum = startStr ? Number(startStr) : (pageNum - 1) * 10
          map[pageNum] = { start: startNum, num: numStr ? Number(numStr) : undefined }
        } catch {}
      }
      // Ensure page 1 is always available
      if (!map[1]) map[1] = { start: 0 }
      return map
    }
    setAllPageMap(buildMapFromSerp(all?.serpapi_pagination))
    setCurrentAllPage(typeof all?.serpapi_pagination?.current === 'number' ? all.serpapi_pagination.current : 1)
  }, [data])

  const handleLoadMoreVideos = async () => {
    if (!nextYtToken || !data?.query) return
    try {
      setLoadingMoreVideos(true)
      const usp = new URLSearchParams({ q: String(data.query), yt_sp: String(nextYtToken) })
      const res = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const newVideosAll = (json?.videos?.videos_results || []).filter((v: any) => isRenderableVideo(v))
      setVideoItems((prev) => {
        const merged = prev.concat(newVideosAll)
        return sortVideosYouTubeFirst(dedupeVideos(merged))
      })
      const nextToken = json?.videos?.serpapi_pagination?.next_page_token || null
      setNextYtToken(nextToken)
    } finally {
      setLoadingMoreVideos(false)
    }
  }
  const getVideoFallbackCandidates = (v: any): string[] => {
    const href = v?.link || v?.url || ''
    const yt = extractYouTubeId(href)
    if (yt) {
      return [
        `https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${yt}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${yt}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${yt}/default.jpg`,
        `https://i.ytimg.com/vi/${yt}/0.jpg`,
      ]
    }
    const list = [v?.thumbnail, v?.thumbnail_url, v?.image, v?.thumbnail_static]
    const clean = list.filter((u) => typeof u === 'string' && u) as string[]
    // Remove YouTube-hosted thumbnails for non-YouTube links
    const nonYt = clean.filter((u) => {
      try {
        const h = new URL(u).hostname
        return !(h.includes('i.ytimg.com') || h.includes('img.youtube.com'))
      } catch {
        return true
      }
    })
    return Array.from(new Set(nonYt))
  }

  const handleLoadMoreAll = async () => {
    if (nextAllStart == null || !data?.query) return
    try {
      setLoadingMoreAll(true)
      const usp = new URLSearchParams({ q: String(data.query), start: String(nextAllStart) })
      const res = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const newOrganic = json?.all?.organic_results || []
      setOrganicItems((prev) => prev.concat(newOrganic))
      const getStartFromUrl = (u: string | undefined | null): number | null => {
        if (!u || typeof u !== 'string') return null
        try {
          const url = new URL(u)
          const s = url.searchParams.get('start')
          return s ? Number(s) : null
        } catch {
          return null
        }
      }
      const nextFromSerp = getStartFromUrl(json?.all?.serpapi_pagination?.next_link || json?.all?.serpapi_pagination?.next)
      const nextFromGoogle = getStartFromUrl(json?.all?.pagination?.next)
      setNextAllStart(nextFromSerp ?? nextFromGoogle ?? null)
    } finally {
      setLoadingMoreAll(false)
    }
  }

  const handleGoToAllPage = async (page: number) => {
    if (!data?.query) return
    if (page === currentAllPage) return
    const lastAllowed = displayAllPages.length > 0 ? displayAllPages[displayAllPages.length - 1] : 1
    if (page < 1 || page > lastAllowed) return
    const entry = allPageMap[page]
    const startVal = entry && typeof entry.start === 'number' ? entry.start : (page - 1) * 10
    const numVal = entry && typeof entry.num === 'number' ? entry.num : undefined
    try {
      setLoadingAllPage(true)
      const usp = new URLSearchParams({ q: String(data.query), start: String(startVal) })
      if (typeof numVal === 'number') usp.set('num', String(numVal))
      const res = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setOrganicItems(Array.isArray(json?.all?.organic_results) ? json.all.organic_results : [])
      const sp = json?.all?.serpapi_pagination
      const map: Record<number, { start: number; num?: number }> = {}
      const other = (sp && sp.other_pages) || {}
      for (const [p, u] of Object.entries(other)) {
        try {
          const url = new URL(String(u))
          const startStr = url.searchParams.get('start')
          const numStr = url.searchParams.get('num')
          const pageNum = Number(p)
          const startNum = startStr ? Number(startStr) : (pageNum - 1) * 10
          map[pageNum] = { start: startNum, num: numStr ? Number(numStr) : undefined }
        } catch {}
      }
      if (!map[1]) map[1] = { start: 0 }
      setAllPageMap(map)
      setCurrentAllPage(typeof sp?.current === 'number' ? sp.current : page)
    } finally {
      setLoadingAllPage(false)
    }
  }

  const getImageDimensions = (img: any): { w: number | null; h: number | null } => {
    const candidatesW = [img?.original_width, img?.width, img?.thumbnail_width]
    const candidatesH = [img?.original_height, img?.height, img?.thumbnail_height]
    const w = Number(candidatesW.find((v: any) => typeof v === 'number' && v > 0) || NaN)
    const h = Number(candidatesH.find((v: any) => typeof v === 'number' && v > 0) || NaN)
    return { w: isNaN(w) ? null : w, h: isNaN(h) ? null : h }
  }

  const ImageResult: React.FC<{ img: any; fit?: 'cover' | 'contain' }> = ({ img, fit }) => {
    const [src, setSrc] = React.useState<string>(getImageSrc(img))
    const [srcSet, setSrcSet] = React.useState<string>(getImageSrcSet(img))
    const candidates = React.useMemo(() => getImageCandidates(img), [img])
    const [idx, setIdx] = React.useState<number>(0)
    const [hidden, setHidden] = React.useState<boolean>(false)
    const dims = React.useMemo(() => getImageDimensions(img), [img])
    const aspect = React.useMemo(() => {
      if (dims.w && dims.h) return `${dims.w} / ${dims.h}`
      return undefined
    }, [dims])

    const onError = () => {
      if (srcSet) {
        // Drop srcSet first; often the high-res pick 404s while the base src works
        setSrcSet('')
        setSrc(candidates[0] || '')
        return
      }
      const next = idx + 1
      if (next < candidates.length) {
        setIdx(next)
        setSrc(candidates[next])
      } else {
        setHidden(true)
      }
    }

    if (hidden || !src) return null

    const imgClass = cn('absolute inset-0 w-full h-full', fit === 'contain' ? 'object-contain' : 'object-cover')

    return (
      <div
        className="relative w-full overflow-hidden rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900/40"
        style={aspect ? { aspectRatio: aspect as any } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet || undefined}
          sizes="(min-width: 768px) 25vw, (min-width: 640px) 25vw, 33vw"
          alt={img.title || 'image'}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onError}
          className={imgClass}
        />
      </div>
    )
  }

  const VideoThumb: React.FC<{ v: any; title: string; duration?: string }> = ({ v, title, duration }) => {
    const initial = getVideoThumb(v) || ''
    const [src, setSrc] = React.useState<string>(initial)
    const [srcSet, setSrcSet] = React.useState<string>(getVideoSrcSet(v) || '')
    const candidates = React.useMemo(() => getVideoFallbackCandidates(v), [v])
    const [idx, setIdx] = React.useState<number>(() => {
      const start = Math.max(0, candidates.indexOf(initial))
      return start
    })
    const [hidden, setHidden] = React.useState<boolean>(false)
    const [loaded, setLoaded] = React.useState<boolean>(false)

    const onError = () => {
      if (srcSet) {
        setSrcSet('')
        setSrc(candidates[idx] || initial)
        return
      }
      const next = idx + 1
      if (next < candidates.length) {
        setIdx(next)
        setSrc(candidates[next])
      } else {
        setHidden(true)
      }
    }

    if (hidden || !src) return null

    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet || undefined}
          sizes="(min-width: 768px) 25vw, (min-width: 640px) 25vw, 33vw"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          alt={title || 'video thumbnail'}
          onError={onError}
          onLoad={(e) => {
            const img = e.currentTarget
            // Hide if the loaded image is very small (common for unavailable placeholders)
            if ((img.naturalWidth && img.naturalWidth < 80) || (img.naturalHeight && img.naturalHeight < 60)) {
              onError()
              return
            }
            setLoaded(true)
          }}
          className="w-full h-28 object-cover rounded border border-neutral-200 dark:border-neutral-800"
        />
        {loaded && duration && (
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-black/70 text-white">
            {duration}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className={cn('w-full flex flex-col gap-10', className)}>
      {showAll && Array.isArray(all.available_on) && all.available_on.length > 0 && (() => {
        const items = all.available_on.slice(0, 12)
        const left = items.filter((_: any, i: number) => i % 2 === 0)
        const right = items.filter((_: any, i: number) => i % 2 === 1)
        const WatchButton: React.FC = () => (
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium border border-neutral-300 dark:border-neutral-700"
            style={{ backgroundColor: 'transparent', color: 'var(--color-accent)' }}
          >
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-neutral-50"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                <polygon points="4,3 9,6 4,9" fill="currentColor" />
              </svg>
            </span>
            Watch
          </span>
        )
        const Row: React.FC<{ svc: any }> = ({ svc }) => {
          const href = svc.link || '#'
          const title = toText(svc.name) || ''
          const price = toText(svc.price) || ''
          const thumb = svc.thumbnail || ''
          const hostname = getHostname(href)
          const faviconUrl = getFaviconUrl(hostname)
          return (
            <li className="leading-snug">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(thumb || faviconUrl) && (
                    <img
                      src={thumb || faviconUrl}
                      alt=""
                      width={32}
                      height={32}
                      referrerPolicy="no-referrer"
                      className="rounded-full shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100 truncate">{title || hostname}</div>
                    {price && <div className="text-[12px] text-neutral-500 truncate">{price}</div>}
                  </div>
                </div>
                <div className="shrink-0">
                  <WatchButton />
                </div>
              </a>
            </li>
          )
        }
        return (
          <section className="pb-4">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-50/60 dark:bg-neutral-900/40">
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Available on</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {left.map((svc: any, idx: number) => (
                    <Row key={`l-${idx}`} svc={svc} />
                  ))}
                </ul>
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 border-t sm:border-t-0 sm:border-l border-neutral-200 dark:border-neutral-800">
                  {right.map((svc: any, idx: number) => (
                    <Row key={`r-${idx}`} svc={svc} />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )
      })()}
      

      {showAll && Array.isArray(organicItems) && organicItems.length > 0 && (
        <section className="pb-16 -mt-4 sm:-mt-5">
          
          <ul className="space-y-6">
            {all.featured_snippet && (() => {
              const fs: any = all.featured_snippet
              const href = fs.link || fs.url || ''
              const title = toText(fs.title) || toText(fs.name) || ''
              const description = getDescription(fs) || toText(fs.snippet) || ''
              const hostname = getHostname(href)
              const faviconUrl = getFaviconUrl(hostname)
              const thumb = fs.image || fs.thumbnail || ''
              return (
                <li key="featured_snippet" className="leading-snug">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {hostname && (
                        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                          {faviconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={faviconUrl} alt="" width={20} height={20} className="rounded-sm shrink-0" />
                          )}
                          <span className="truncate">{hostname}</span>
                        </div>
                      )}
                      {title && href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="block mt-1 text-blue-700 dark:text-blue-400 hover:underline font-medium text-[18px] sm:text-xl">
                          {title}
                        </a>
                      ) : title ? (
                        <div className="block mt-1 font-medium text-[18px] sm:text-xl text-neutral-200">{title}</div>
                      ) : null}
                      {description && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{description}</p>
                      )}
                    </div>
                    {thumb && (
                      <SmallThumb candidates={[thumb]} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded" />
                    )}
                  </div>
                </li>
              )
            })()}
            {all.answer_box && (() => {
              const ab: any = all.answer_box
              const href = ab.link || ab.url || ''
              const title = toText(ab.title) || toText(ab.answer) || ''
              const description = toText(ab.snippet) || toText(ab.answer) || ''
              const hostname = getHostname(href)
              const faviconUrl = getFaviconUrl(hostname)
              return (
                <li key="answer_box" className="leading-snug">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {hostname && (
                        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                          {faviconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={faviconUrl} alt="" width={20} height={20} className="rounded-sm shrink-0" />
                          )}
                          <span className="truncate">{hostname}</span>
                        </div>
                      )}
                      {title && (
                        href ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="block mt-1 text-blue-700 dark:text-blue-400 hover:underline font-medium text-[18px] sm:text-xl">
                            {title}
                          </a>
                        ) : (
                          <div className="block mt-1 font-medium text-[18px] sm:text-xl text-neutral-200">{title}</div>
                        )
                      )}
                      {description && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{description}</p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })()}
            {all.knowledge_graph && (() => {
              const kg: any = all.knowledge_graph
              const firstOrganic = Array.isArray(all.organic_results) && all.organic_results.length > 0 ? all.organic_results[0] : null
              const profileLink = Array.isArray(kg.profiles) && kg.profiles.length > 0 ? (kg.profiles[0].link || kg.profiles[0].url) : ''
              const sourceLink = kg?.source?.link || kg?.source?.url || ''
              const href = kg.website || kg.link || kg.url || profileLink || sourceLink || (firstOrganic?.link || firstOrganic?.url || '') || ''
              const hostname = getHostname(href)
              const siteLabel = toText(kg.source?.name) || hostname
              const faviconUrl = getFaviconUrl(hostname)
              const title = toText(kg.title) || toText(kg.name) || ''
              const thumb = kg.image || (Array.isArray(kg.header_images) ? kg.header_images[0]?.image : '')
              const description = getDescription(kg) || getDescription(firstOrganic || {})
              return (
                <li key="kg" className="leading-snug">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {siteLabel && (
                        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {faviconUrl && (
                            <img src={faviconUrl} alt="" width={20} height={20} className="rounded-sm shrink-0" />
                          )}
                          <span className="truncate">{siteLabel}</span>
                          {title && <span>·</span>}
                          {title && <span className="truncate">{title}</span>}
                        </div>
                      )}
                      {title && href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-1 text-blue-700 dark:text-blue-400 hover:underline font-medium text-[18px] sm:text-xl"
                        >
                          {title}
                        </a>
                      ) : title ? (
                        <div className="block mt-1 font-medium text-[18px] sm:text-xl text-neutral-200">{title}</div>
                      ) : null}
                      {description && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{description}</p>
                      )}
                    </div>
                    {thumb && (
                      <SmallThumb candidates={[thumb]} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded" />
                    )}
                  </div>
                </li>
              )
            })()}
            {organicItems.map((item: any, idx: number) => {
              const href = item.link || item.url || ''
              const hostname = getHostname(href)
              const siteLabel = toText(item.source) || toText(item.displayed_link) || hostname
              const faviconUrl = getFaviconUrl(hostname)
              const thumb = getResultThumb(item)
              return (
                <li key={idx} className="leading-snug">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {siteLabel && (
                        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {faviconUrl && (
                            <img src={faviconUrl} alt="" width={20} height={20} className="rounded-sm shrink-0" />
                          )}
                          <span className="truncate">{siteLabel}</span>
                        </div>
                      )}
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 text-blue-700 dark:text-blue-400 hover:underline font-medium text-[18px] sm:text-xl"
                      >
                        {toText(item.title) || toText(item.name) || toText(item.link)}
                      </a>
                      {getDescription(item) && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{getDescription(item)}</p>
                      )}
                    </div>
                    {thumb && (
                      <SmallThumb item={item} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded" />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {displayAllPages.length > 0 && (
            <nav className="mt-4 flex items-center gap-1 flex-wrap" aria-label="Search results pages">
              <button
                onClick={() => handleGoToAllPage(currentAllPage - 1)}
                disabled={!canPrevAll || loadingAllPage}
                className="px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {displayAllPages.map((p) => (
                <button
                  key={p}
                  onClick={() => handleGoToAllPage(p)}
                  disabled={loadingAllPage || p === currentAllPage}
                  className={cn(
                    'px-2 py-1.5 rounded-md border text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
                    p === currentAllPage
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => handleGoToAllPage(currentAllPage + 1)}
                disabled={!canNextAll || loadingAllPage}
                className="px-2 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}

      {showAll && Array.isArray(all.recipes_results) && all.recipes_results.length > 0 && (
        <section className="pb-16">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Recipes</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {all.recipes_results.map((r: any, idx: number) => (
              <a
                key={idx}
                href={r.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
                title={toText(r.title) || ''}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.thumbnail && (
                  <img
                    src={r.thumbnail}
                    alt={toText(r.title) || 'recipe'}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-28 object-cover rounded border border-neutral-200 dark:border-neutral-800"
                  />
                )}
                <div className="mt-1">
                  <div className="text-[13px] leading-snug font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:underline">
                    {toText(r.title)}
                  </div>
                  {toText(r.source) && (
                    <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{toText(r.source)}</div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {showAll && Array.isArray(all.shopping_results) && all.shopping_results.length > 0 && (
        <section className="pb-16">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Shopping results</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {all.shopping_results.map((p: any, idx: number) => (
              <a
                key={idx}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
                title={toText(p.title) || ''}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.thumbnail && (
                  <img
                    src={p.thumbnail}
                    alt={toText(p.title) || 'product'}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-28 object-cover rounded border border-neutral-200 dark:border-neutral-800"
                  />
                )}
                <div className="mt-1">
                  <div className="text-[13px] leading-snug font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:underline">
                    {toText(p.title)}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {toText(p.source)}{p.price ? ` · ${toText(p.price)}` : ''}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      

      {showImages && Array.isArray(images.images_results) && images.images_results.length > 0 && (
        <section className="pb-16">
          <div className="columns-2 sm:columns-3 md:columns-4 gap-2">
            {images.images_results.map((img: any, idx: number) => (
              <a
                key={idx}
                href={img.link || img.original || img.source}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-inside-avoid mb-2"
                title={img.title || ''}
              >
                <ImageResult img={img} fit="contain" />
              </a>
            ))}
          </div>
        </section>
      )}

      {showVideos && Array.isArray(videoItems) && videoItems.length > 0 && (
        <section className="pb-16">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {videoItems.map((v: any, idx: number) => {
              const href = v.link || v.url
              const title = v.title || v.video_title || ''
              const channel = toText(v.channel) || toText(v.platform) || toText(v.source)
              const duration = getVideoDuration(v)
              return (
                <a
                  key={idx}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                  title={title}
                >
                  <VideoThumb v={v} title={title} duration={duration} />
                  <div className="mt-1">
                    <div className="text-[13px] leading-snug font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:underline">
                      {title}
                    </div>
                    {channel && (
                      <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{channel}</div>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
          {nextYtToken && (
            <div className="mt-3">
              <button
                onClick={handleLoadMoreVideos}
                disabled={loadingMoreVideos}
                className="px-3 py-1.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {loadingMoreVideos ? 'Loading more…' : 'Load more from YouTube'}
              </button>
            </div>
          )}
        </section>
      )}

      {showNews && Array.isArray(news.news_results) && news.news_results.length > 0 && (
        <section className="pb-10">
          <ul className="space-y-6">
            {news.news_results.map((n: any, idx: number) => {
              const href = n.link || n.url || ''
              const hostname = getHostname(href)
              const siteLabel = toText(n.source) || toText(n.publisher) || hostname
              const faviconUrl = getFaviconUrl(hostname)
              const thumb = getResultThumb(n)
              const dateLabel = getNewsDateLabel(n)
              return (
                <li key={idx} className="leading-snug">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {siteLabel && (
                        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {faviconUrl && (
                            <img src={faviconUrl} alt="" width={20} height={20} className="rounded-sm shrink-0" />
                          )}
                          <span className="truncate">{siteLabel}</span>
                          {dateLabel && <span>·</span>}
                          {dateLabel && <span className="truncate">{dateLabel}</span>}
                        </div>
                      )}
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 text-blue-700 dark:text-blue-400 hover:underline font-medium text-[18px] sm:text-xl"
                      >
                        {n.title || n.headline}
                      </a>
                      {getDescription(n) && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{getDescription(n)}</p>
                      )}
                    </div>
                    {thumb && (
                      <SmallThumb item={n} alt="" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded" />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {Array.isArray(news.people_also_search_for) && news.people_also_search_for.length > 0 && (
            <div className="mt-10 border-t border-neutral-200 dark:border-neutral-800 pt-6">
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Related coverage</h3>
              <div className="space-y-8">
                {news.people_also_search_for.map((cluster: any, cIdx: number) => {
                  const name = toText(cluster?.name)
                  const full = cluster?.view_full_coverage_link || cluster?.full_coverage_link || ''
                  const items: any[] = Array.isArray(cluster?.news_results) ? cluster.news_results.slice(0, 3) : []
                  if (!name && items.length === 0) return null
                  return (
                    <div key={cIdx} className="">
                      <div className="flex items-center gap-2 mb-2">
                        {name && <div className="text-[15px] font-medium text-neutral-900 dark:text-neutral-100">{name}</div>}
                        {full && (
                          <a
                            href={full}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            Full coverage
                          </a>
                        )}
                      </div>
                      {items.length > 0 && (
                        <ul className="space-y-4">
                          {items.map((n: any, idx: number) => {
                            const href = n.link || n.url || ''
                            const hostname = getHostname(href)
                            const siteLabel = toText(n.source) || toText(n.publisher) || hostname
                            const faviconUrl = getFaviconUrl(hostname)
                            const thumb = getResultThumb(n)
                            const dateLabel = getNewsDateLabel(n)
                            return (
                              <li key={idx} className="leading-snug">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    {siteLabel && (
                                      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        {faviconUrl && (
                                          <img src={faviconUrl} alt="" width={18} height={18} className="rounded-sm shrink-0" />
                                        )}
                                        <span className="truncate">{siteLabel}</span>
                                        {dateLabel && <span>·</span>}
                                        {dateLabel && <span className="truncate">{dateLabel}</span>}
                                      </div>
                                    )}
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block mt-0.5 text-[15px] sm:text-[16px] text-blue-700 dark:text-blue-400 hover:underline font-medium"
                                    >
                                      {n.title || n.headline}
                                    </a>
                                    {getDescription(n) && (
                                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{getDescription(n)}</p>
                                    )}
                                  </div>
                                  {thumb && (
                                    <SmallThumb item={n} alt="" className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded" />
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}


