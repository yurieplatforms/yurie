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
  { value: 'openrouter/openai/gpt-5', label: 'GPT‑5' },
  { value: 'x-ai/grok-4-0709', label: 'Grok 4' },
  { value: 'openrouter/qwen/qwen-plus-2025-07-28:thinking', label: 'Qwen Plus' },
  { value: 'x-ai/grok-4-fast-reasoning', label: 'Grok 4 Fast' },
  { value: 'openrouter/google/gemini-2.5-flash-image-preview', label: 'Nano Banana' },
  { value: 'openrouter/google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openrouter/anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
]

export function getSelectedModelLabel(modelChoice: string): string {
  const found = modelOptions.find((o) => o.value === modelChoice)
  return found ? found.label : modelChoice
}
