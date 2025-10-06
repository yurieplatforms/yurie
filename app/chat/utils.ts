import { ClassValue } from 'clsx'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'
import { SourceDisplayParts } from './types'

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // 20 MiB
export const MAX_PDF_BYTES = 32 * 1024 * 1024 // 32 MiB
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024 // 20 MiB

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeParseUrl(rawUrl: string): URL | null {
  try {
    if (rawUrl.startsWith('//')) return new URL('https:' + rawUrl)
    return new URL(rawUrl)
  } catch {
    return null
  }
}

export function toDisplayParts(rawUrl: string): SourceDisplayParts {
  const parsed = safeParseUrl(rawUrl)
  const hostname = parsed?.hostname || ''
  const domain = hostname.replace(/^www\./i, '') || rawUrl
  const pathname = (parsed?.pathname || '/').replace(/\/$/, '') || '/'
  const search = parsed?.search || ''
  const path = `${pathname}${search}`
  const faviconUrl = hostname
    ? `https://icons.duckduckgo.com/ip3/${hostname}.ico`
    : ''
  return {
    href: parsed ? parsed.href : rawUrl,
    hostname,
    domain,
    path,
    faviconUrl,
  }
}

// Derive a clean, human-friendly site name from a hostname.
// Handles locale/service subdomains (e.g. en., m.), multi-part TLDs (e.g. co.uk),
// and common brand/acronym mappings.
export function getSiteDisplayNameFromHostname(hostnameRaw: string): string {
  try {
    let hostname = String(hostnameRaw || '').toLowerCase()
    hostname = hostname.replace(/^www\./, '')
    if (!hostname) return ''

    // Remove noisy leading subdomains (locales, mobile, amp, etc.)
    const noisyPrefixes = new Set<string>([
      'm', 'mobile', 'amp',
      // Common locale/language codes
      'en', 'de', 'fr', 'es', 'pt', 'it', 'ru', 'ja', 'zh', 'zh-cn', 'zh-tw', 'ko', 'ar',
      'nl', 'sv', 'no', 'fi', 'da', 'pl', 'cs', 'hu', 'el', 'he', 'id', 'vi', 'th', 'hi', 'bn',
      'tr', 'uk', 'ca'
    ])
    let parts = hostname.split('.').filter(Boolean)
    while (parts.length > 2 && noisyPrefixes.has(parts[0])) {
      parts = parts.slice(1)
    }

    // Handle common multi-part TLDs so we can reliably pick the registrable domain
    const multiPartTlds = new Set<string>([
      'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
      'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
      'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
      'com.cn', 'net.cn', 'org.cn', 'gov.cn',
      'com.br', 'com.mx', 'com.tr', 'com.sg', 'co.kr', 'or.kr', 'ac.kr', 'go.kr',
      'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
      'co.id'
    ])
    const lastTwo = parts.slice(-2).join('.')
    const baseIndex = multiPartTlds.has(lastTwo) ? parts.length - 3 : parts.length - 2
    const base = parts[Math.max(0, baseIndex)] || ''
    const cleaned = base.replace(/[^a-z0-9-]/g, '')
    const lower = cleaned.toLowerCase()

    const acronyms: Record<string, string> = {
      cnn: 'CNN',
      cnbc: 'CNBC',
      bbc: 'BBC',
      npr: 'NPR',
      wsj: 'WSJ',
      ft: 'FT',
      mit: 'MIT',
      ieee: 'IEEE',
      nytimes: 'NYTimes',
      ibm: 'IBM',
    }
    if (acronyms[lower]) return acronyms[lower]

    const brands: Record<string, string> = {
      wikipedia: 'Wikipedia',
      theguardian: 'The Guardian',
      bloomberg: 'Bloomberg',
      github: 'GitHub',
      stackoverflow: 'Stack Overflow',
      ycombinator: 'Y Combinator',
      medium: 'Medium',
      arxiv: 'arXiv',
    }
    if (brands[lower]) return brands[lower]

    // Title-case hyphenated names: new-yorker -> New Yorker
    return lower
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  } catch {
    return hostnameRaw || ''
  }
}

function toTitleCase(input: string): string {
  try {
    const lower = input.toLowerCase()
    return lower.replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase())
  } catch {
    return input
  }
}

function deriveSlugTitleFromPath(pathname: string): string {
  try {
    const withoutQuery = pathname.split('?')[0]
    const segments = withoutQuery.split('/').filter(Boolean)
    const last = segments[segments.length - 1] || ''
    let candidate = decodeURIComponent(last)
    candidate = candidate.replace(/\.(html?|php|aspx?)$/i, '')
    candidate = candidate.replace(/[-_]+/g, ' ').trim()
    // If it looks like just an ID (no letters), ignore
    if (!/[a-zA-Z]/.test(candidate)) return ''
    // Collapse extra spaces
    candidate = candidate.replace(/\s{2,}/g, ' ')
    return toTitleCase(candidate)
  } catch {
    return ''
  }
}

export function inferSourceMeta(rawUrl: string): {
  href: string
  title: string
  subtitle?: string
  faviconUrl: string
} {
  const parts = toDisplayParts(rawUrl)
  const href = parts.href
  const hostname = (parts.hostname || '').toLowerCase()
  const isX = /^(?:mobile\.)?(?:twitter\.com|x\.com)$/.test(hostname)
  if (isX) {
    const parsed = safeParseUrl(href)
    const path = parsed?.pathname || '/'
    const segs = path.split('/').filter(Boolean)
    // Typical: /{username}/status/{id}
    const username = segs[0] || ''
    const atName = username ? `@${username}` : parts.domain
    return {
      href,
      title: atName,
      subtitle: 'Post on X',
      faviconUrl: parts.faviconUrl,
    }
  }

  const prettyFromSlug = deriveSlugTitleFromPath(parts.path)
  const title = prettyFromSlug || parts.domain
  return {
    href,
    title,
    subtitle: parts.domain,
    faviconUrl: parts.faviconUrl,
  }
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const parsed = safeParseUrl(u)
    const key = parsed ? `${parsed.hostname}${parsed.pathname}${parsed.search}` : u
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}

// Attempts to extract a publish/update date from a URL using common patterns.
// Returns a timestamp in milliseconds if found, otherwise null.
export function extractDateFromUrl(rawUrl: string): number | null {
  try {
    const parsed = safeParseUrl(rawUrl)
    const haystack = `${parsed?.pathname || ''}${parsed?.search || ''}`

    // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    const ymd = /(20\d{2})[\/-_.](0?[1-9]|1[0-2])[\/-_.](0?[1-9]|[12][0-9]|3[01])/i.exec(haystack)
    if (ymd) {
      const y = Number(ymd[1])
      const m = Number(ymd[2])
      const d = Number(ymd[3])
      const ts = Date.UTC(y, Math.max(0, m - 1), Math.max(1, d))
      if (isFinite(ts)) return ts
    }

    // YYYY-MM or YYYY/MM or YYYY.MM
    const ym = /(20\d{2})[\/-_.](0?[1-9]|1[0-2])(?:\D|$)/i.exec(haystack)
    if (ym) {
      const y = Number(ym[1])
      const m = Number(ym[2])
      const ts = Date.UTC(y, Math.max(0, m - 1), 1)
      if (isFinite(ts)) return ts
    }

    // YYYYMMDD (no separators)
    const yyyymmdd = /(?:^|\D)(20\d{2})(0[1-9]|1[0-2])([0-3][0-9])(?:\D|$)/.exec(haystack)
    if (yyyymmdd) {
      const y = Number(yyyymmdd[1])
      const m = Number(yyyymmdd[2])
      const d = Number(yyyymmdd[3])
      const ts = Date.UTC(y, Math.max(0, m - 1), Math.max(1, d))
      if (isFinite(ts)) return ts
    }

    // Common query param forms like ?date=YYYY-MM-DD or ?published=YYYY-MM-DD
    const query = parsed?.search || ''
    const qdate = /(?:date|published|updated|time|timestamp)=([^&]+)/i.exec(query)
    if (qdate) {
      const val = decodeURIComponent(qdate[1])
      const m1 = /(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])/.exec(val)
      if (m1) {
        const y = Number(m1[1])
        const m = Number(m1[2])
        const d = Number(m1[3])
        const ts = Date.UTC(y, Math.max(0, m - 1), Math.max(1, d))
        if (isFinite(ts)) return ts
      }
      const m2 = /(20\d{2})-(0?[1-9]|1[0-2])/.exec(val)
      if (m2) {
        const y = Number(m2[1])
        const m = Number(m2[2])
        const ts = Date.UTC(y, Math.max(0, m - 1), 1)
        if (isFinite(ts)) return ts
      }
    }

    return null
  } catch {
    return null
  }
}

// Compute a heuristic relevance and recency score for a URL.
// Relevance prioritizes article-like pages and authoritative domains.
// Recency favors URLs with recent dates in the path/query.
export function computeSourceHeuristicScore(rawUrl: string): { relevance: number; recency: number; total: number } {
  let relevance = 0
  let recency = 0

  try {
    const parsed = safeParseUrl(rawUrl)
    const hostname = (parsed?.hostname || '').toLowerCase()
    const path = (parsed?.pathname || '/').toLowerCase()
    const fullPath = `${path}${parsed?.search || ''}`

    // Hard negatives: search result pages
    const isSearch =
      /google\.[^/]+\/search/i.test(rawUrl) ||
      /bing\.[^/]+\/search/i.test(rawUrl) ||
      /duckduckgo\.[^/]+/i.test(rawUrl) ||
      /search\.yahoo\./i.test(rawUrl)
    if (isSearch) relevance -= 10

    // Authority bonuses
    const authorityBonuses: Record<string, number> = {
      'arxiv.org': 6,
      'nature.com': 5,
      'science.org': 5,
      'bloomberg.com': 5,
      'reuters.com': 5,
      'ft.com': 4,
      'theguardian.com': 4,
      'nytimes.com': 4,
      'washingtonpost.com': 4,
      'bbc.co.uk': 4,
      'wsj.com': 4,
      'apnews.com': 4,
      'npr.org': 4,
      'github.com': 4,
      'docs.google.com': 3,
      'medium.com': 3,
    }
    for (const domain in authorityBonuses) {
      if (hostname.endsWith(domain)) {
        relevance += authorityBonuses[domain]
        break
      }
    }

    // Social/news/video neutral or small bonus
    if (/^(?:x\.com|twitter\.com)$/i.test(hostname)) relevance += 1
    if (/^(?:youtube\.com|youtu\.be)$/i.test(hostname)) relevance += 1

    // Penalize low-signal platforms
    if (/reddit\.com$/i.test(hostname)) relevance -= 1
    if (/pinterest\.\w+$/i.test(hostname)) relevance -= 2
    if (/facebook\.com$/i.test(hostname)) relevance -= 1

    // Path heuristics
    const segments = path.split('/').filter(Boolean)
    const lastSeg = segments[segments.length - 1] || ''
    if (segments.length > 2) relevance += 1
    if (/[a-z].*[-_].*[a-z]/i.test(lastSeg)) relevance += 2 // sluggy
    if (/\.(pdf)(?:$|[?#])/i.test(fullPath)) relevance += 3
    if (/\b(blog|news|article|stories|posts|docs|guide|paper)\b/.test(fullPath)) relevance += 2
    if (/\b(about|privacy|terms|login|signin|signup|contact|subscribe|account)\b/.test(fullPath)) relevance -= 3
    if (path === '/' || segments.length <= 1) relevance -= 1 // likely homepage

    const ts = extractDateFromUrl(rawUrl)
    if (ts) {
      const now = Date.now()
      const days = Math.max(0, Math.floor((now - ts) / 86400000))
      if (days <= 7) recency = 100
      else if (days <= 30) recency = 80
      else if (days <= 90) recency = 60
      else if (days <= 365) recency = 40
      else if (days <= 730) recency = 20
      else recency = 0
    } else {
      recency = 0
    }
  } catch {
    // noop
  }

  const total = relevance * 1000 + recency
  return { relevance, recency, total }
}

// Sort URLs by relevance first, then recency (both descending). Stable on ties.
export function sortUrlsByRelevanceAndRecency(urls: string[]): string[] {
  try {
    const scored = urls.map((u, idx) => ({
      url: u,
      idx,
      score: computeSourceHeuristicScore(u),
    }))
    scored.sort((a, b) => {
      if (b.score.relevance !== a.score.relevance) return b.score.relevance - a.score.relevance
      if (b.score.recency !== a.score.recency) return b.score.recency - a.score.recency
      return a.idx - b.idx
    })
    return scored.map((s) => s.url)
  } catch {
    return urls
  }
}

// Compute heuristic score for images using filename patterns, resolution hints, and host authority
export function computeImageHeuristicScore(rawUrl: string): { relevance: number; recency: number; total: number } {
  let relevance = 0
  let recency = 0
  try {
    const parsed = safeParseUrl(rawUrl)
    const hostname = (parsed?.hostname || '').toLowerCase()
    const path = (parsed?.pathname || '').toLowerCase()
    const search = (parsed?.search || '').toLowerCase()
    const full = `${path}${search}`

    // Authority bonuses (CDNs under these domains also count)
    const authorityBonuses: Record<string, number> = {
      'theguardian.com': 3,
      'nytimes.com': 3,
      'bbc.co.uk': 3,
      'bloomberg.com': 3,
      'reuters.com': 3,
      'ft.com': 3,
      'npr.org': 2,
      'apnews.com': 2,
      'githubusercontent.com': 1,
      'github.com': 1,
      'static01.nyt.com': 2,
      'media.guim.co.uk': 2,
    }
    for (const domain in authorityBonuses) {
      if (hostname.endsWith(domain)) {
        relevance += authorityBonuses[domain]
        break
      }
    }

    // File extension preference
    if (/\.(?:jpg|jpeg)(?:$|[?#])/.test(full)) relevance += 2
    else if (/\.(?:png)(?:$|[?#])/.test(full)) relevance += 1
    else if (/\.(?:gif)(?:$|[?#])/.test(full)) relevance -= 1

    // Resolution hints like 1200x630, 2048x1024, etc.
    const res = /(\d{3,4})x(\d{3,4})/.exec(full)
    if (res) {
      const w = Number(res[1])
      const h = Number(res[2])
      const area = w * h
      if (area >= 1600 * 900) relevance += 4
      else if (area >= 1200 * 630) relevance += 3
      else if (area >= 800 * 450) relevance += 2
      else relevance += 1
    }

    // Prefer descriptive filenames over hashed
    const file = path.split('/').filter(Boolean).pop() || ''
    const name = file.replace(/\.(jpg|jpeg|png|webp|gif)$/, '')
    const isHashedLike = /^(?:[a-f0-9]{16,}|[A-Z0-9]{16,})$/.test(name)
    if (isHashedLike) relevance -= 1
    if (/\b(hero|featured|share|og|social|header|cover|main)\b/.test(full)) relevance += 2

    // Query hints for size
    const wq = /(?:[?&])(w|width)=(\d{3,4})/.exec(search)
    const hq = /(?:[?&])(h|height)=(\d{3,4})/.exec(search)
    const qArea = (wq ? Number(wq[2]) : 0) * (hq ? Number(hq[2]) : 0)
    if (qArea >= 1200 * 630) relevance += 2

    // Recency from URL date patterns
    const ts = extractDateFromUrl(rawUrl)
    if (ts) {
      const now = Date.now()
      const days = Math.max(0, Math.floor((now - ts) / 86400000))
      if (days <= 7) recency = 100
      else if (days <= 30) recency = 80
      else if (days <= 90) recency = 60
      else if (days <= 365) recency = 40
      else if (days <= 730) recency = 20
      else recency = 0
    }
  } catch {
    // noop
  }
  const total = relevance * 1000 + recency
  return { relevance, recency, total }
}

export function sortImageUrlsByRelevanceAndRecency(urls: string[]): string[] {
  try {
    const scored = urls.map((u, idx) => ({ url: u, idx, score: computeImageHeuristicScore(u) }))
    scored.sort((a, b) => {
      if (b.score.relevance !== a.score.relevance) return b.score.relevance - a.score.relevance
      if (b.score.recency !== a.score.recency) return b.score.recency - a.score.recency
      return a.idx - b.idx
    })
    return scored.map((s) => s.url)
  } catch {
    return urls
  }
}

export function sanitizeHtml(html: string): string {
  if (!html) return html
  const blockedContentTags = [
    'script',
    'style',
    'title',
    'iframe',
    'object',
    'embed',
    'noscript',
  ]
  const contentTagPattern = new RegExp(
    `<\\s*(${blockedContentTags.join('|')})\\b[\\s\\S]*?<\\/\\s*\\1\\s*>`,
    'gi'
  )
  html = html.replace(contentTagPattern, '')
  const blockedVoidTags = [
    'link',
    'meta',
    'base',
    'form',
    'input',
    'select',
    'option',
    'textarea',
    'frame',
    'frameset',
  ]
  const voidTagPattern = new RegExp(
    `<\\s*(${blockedVoidTags.join('|')})\\b[^>]*>`,
    'gi'
  )
  html = html.replace(voidTagPattern, '')
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  html = html.replace(
    /(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
    '$1="#"'
  )

  return html
}

export function decodeBase64Utf8(b64: string): string {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

export function stripImageData(text: string): string {
  const angleTag = /<(?:image|image_partial):[^>]+>/gi
  const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
  const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
  const audioBracket = /\[data:audio\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
  const audioBare = /data:audio\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
  const pdfBracket = /\[data:application\/pdf;base64,[^\]]+\]/gi
  const pdfBare = /data:application\/pdf;base64,[A-Za-z0-9+/=]+/gi
  return text
    .replace(angleTag, '[image omitted]')
    .replace(bracketDataUrl, '[image omitted]')
    .replace(bareDataUrl, '[image omitted]')
    .replace(audioBracket, '[audio omitted]')
    .replace(audioBare, '[audio omitted]')
    .replace(pdfBracket, '[pdf omitted]')
    .replace(pdfBare, '[pdf omitted]')
}

export function extractHttpImageUrls(text: string): string[] {
  try {
    const urlRegex = /https?:\/\/[\w\-._~:?#\[\]@!$&'()*+,;=%/]+/gi
    const candidates = (text.match(urlRegex) || [])
  const filtered = candidates.filter((u) => /\.(?:jpg|jpeg|png|webp|gif)(?:$|[?#])/i.test(u))
    // Basic validation that they are valid URLs
    const valid = filtered.filter((u) => {
      try {
        const p = new URL(u)
        return p.protocol === 'http:' || p.protocol === 'https:'
      } catch {
        return false
      }
    })
    return Array.from(new Set(valid))
  } catch {
    return []
  }
}

export function extractHttpPdfUrls(text: string): string[] {
  try {
    const urlRegex = /https?:\/\/[\w\-._~:?#\[\]@!$&'()*+,;=%/]+/gi
    const candidates = (text.match(urlRegex) || [])
    const filtered = candidates.filter((u) => /\.pdf(?:$|[?#])/i.test(u))
    const valid = filtered.filter((u) => {
      try {
        const p = new URL(u)
        return p.protocol === 'http:' || p.protocol === 'https:'
      } catch {
        return false
      }
    })
    return Array.from(new Set(valid))
  } catch {
    return []
  }
}

export function isOnlyWhitespace(text: string): boolean {
  return !/[^\s]/.test(text)
}

export function getTimeOfDayWord(): 'today' | 'tonight' {
  try {
    const hours = new Date().getHours()
    const isNight = hours < 6 || hours >= 18
    return isNight ? 'tonight' : 'today'
  } catch {
    return 'today'
  }
}

export const modelOptions = [
  { value: 'openrouter/qwen/qwen-plus-2025-07-28:thinking', label: 'Qwen Plus' },
  { value: 'x-ai/grok-4-fast-reasoning', label: 'Grok 4 Fast' },
  { value: 'openrouter/openai/gpt-oss-120b', label: 'gpt-oss-120b' },
]

export function getSelectedModelLabel(modelChoice: string): string {
  const found = modelOptions.find((o) => o.value === modelChoice)
  return found ? found.label : modelChoice
}
