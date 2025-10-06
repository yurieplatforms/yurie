export const runtime = 'nodejs'
export const maxDuration = 15

type MetaResult = {
  url: string
  hostname: string
  title?: string
  description?: string
  images?: string[]
}

function isLikelyIconOrLowQualityUrl(input: string): boolean {
  try {
    const s = String(input || '').toLowerCase()
    // Disallow non-photo extensions early
    if (!/(\.)(jpg|jpeg|png|webp|gif)(?:$|[?#])/i.test(s)) return true
    // Common icon/logo/tracker patterns
    if (/(^|[\/_.-])favicon(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_.-])apple-touch-icon(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_.-])android-chrome(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_.-])mstile(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_.-])safari-pinned(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_-])icons?(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_-])logo(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_-])sprite(\.|[\/_-]|$)/i.test(s)) return true
    if (/(^|[\/_-])(pixel|beacon|tracker|spacer)(\.|[\/_-]|$)/i.test(s)) return true
    if (/([?&])(w|width|h|height|s|size)=(?:1|2|8|12|16|24|32|40|48|56|64)\b/i.test(s)) return true
    if (/(^|[\/_-])(thumb|thumbnail|min|tiny|small)(\.|[\/_-]|$)/i.test(s)) return true
    // Known ad/analytics hosts
    if (/doubleclick\.net|googletagmanager\.com|adservice|adsystem|analytics/i.test(s)) return true
    return false
  } catch {
    return true
  }
}

function parseAttributes(tagHtml: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  try {
    const regex = /(\w+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/gi
    let m: RegExpExecArray | null
    while ((m = regex.exec(tagHtml))) {
      const key = (m[1] || '').toLowerCase()
      const val = (m[3] ?? m[4] ?? m[5] ?? '').trim()
      if (key) attrs[key] = val
    }
  } catch {}
  return attrs
}

function resolveUrlMaybe(relativeOrAbsolute: string, baseUrl: string): string | null {
  try {
    if (!relativeOrAbsolute) return null
    return new URL(relativeOrAbsolute, baseUrl).toString()
  } catch {
    return null
  }
}

function extractMeta(html: string, baseUrl: string): Omit<MetaResult, 'url' | 'hostname'> {
  let title: string | undefined
  let description: string | undefined
  const images: string[] = []
  let baseTagHref: string | undefined

  try {
    const baseMatch = /<base\b[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = baseMatch.exec(html))) {
      try {
        const attrs = parseAttributes(m[0])
        const href = attrs['href']
        const resolved = href ? resolveUrlMaybe(href, baseUrl) : null
        if (resolved) baseTagHref = resolved
      } catch {}
    }
  } catch {}
  const effectiveBase = baseTagHref || baseUrl

  try {
    const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
    if (titleTag && titleTag[1]) {
      const txt = titleTag[1].replace(/\s+/g, ' ').trim()
      if (txt) title = txt
    }
  } catch {}

  try {
    const metaRegex = /<meta\b[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = metaRegex.exec(html))) {
      const attrs = parseAttributes(m[0])
      const key = (attrs['property'] || attrs['name'] || '').toLowerCase()
      const content = (attrs['content'] || '').trim()
      if (!key || !content) continue
      if (!description && (key === 'og:description' || key === 'description')) {
        description = content
      }
      if (!title && (key === 'og:title' || key === 'twitter:title')) {
        title = content
      }
      if (
        key === 'og:image' ||
        key === 'og:image:url' ||
        key === 'og:image:secure_url' ||
        key === 'twitter:image' ||
        key === 'twitter:image:src'
      ) {
        const abs = resolveUrlMaybe(content, effectiveBase)
        if (abs && !images.includes(abs) && !isLikelyIconOrLowQualityUrl(abs)) images.push(abs)
      }
    }
  } catch {}

  try {
    const linkRegex = /<link\b[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = linkRegex.exec(html))) {
      const attrs = parseAttributes(m[0])
      const rel = (attrs['rel'] || '').toLowerCase()
      const href = (attrs['href'] || '').trim()
      if (!href) continue
      // Intentionally exclude generic icons (favicon/apple-touch-icon/mask-icon)
      if (rel === 'image_src' || rel === 'thumbnail') {
        const abs = resolveUrlMaybe(href, effectiveBase)
        if (abs && !images.includes(abs) && !isLikelyIconOrLowQualityUrl(abs)) images.push(abs)
      }
    }
  } catch {}

  return { title, description, images }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const target = url.searchParams.get('url')
    if (!target) {
      return new Response(
        JSON.stringify({ error: { code: 400, message: 'Missing url parameter' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    let targetUrl: URL
    try {
      targetUrl = new URL(target)
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol')
      }
    } catch {
      return new Response(
        JSON.stringify({ error: { code: 400, message: 'Invalid url' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Basic in-memory cache with TTL and in-flight request deduplication
    type CacheEntry = { expiresAt: number; body: string }
    const MEMO_TTL_MS = 10 * 60 * 1000
    const cache = globalThis as unknown as {
      __yurie_meta_cache__?: Map<string, CacheEntry>
      __yurie_meta_inflight__?: Map<string, Promise<string>>
    }
    if (!cache.__yurie_meta_cache__) cache.__yurie_meta_cache__ = new Map()
    if (!cache.__yurie_meta_inflight__) cache.__yurie_meta_inflight__ = new Map()

    const cacheKey = targetUrl.toString()
    const now = Date.now()
    const hit = cache.__yurie_meta_cache__!.get(cacheKey)
    if (hit && hit.expiresAt > now) {
      return new Response(hit.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        },
      })
    }
    if (cache.__yurie_meta_inflight__!.has(cacheKey)) {
      const body = await cache.__yurie_meta_inflight__!.get(cacheKey)!
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        },
      })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    let html = ''
    let finalUrl = targetUrl.toString()
    const fetchTask = (async () => {
      try {
        const res = await fetch(finalUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; YurieBot/1.0; +https://yurie.ai)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        })
        clearTimeout(timer)
        finalUrl = res.url || finalUrl
        const contentType = String(res.headers.get('content-type') || '').toLowerCase()
        if (!contentType.includes('text/html')) {
          const out: MetaResult = {
            url: finalUrl,
            hostname: new URL(finalUrl).hostname,
          }
          return JSON.stringify(out)
        }
        html = await res.text()
        const baseUrl = new URL(finalUrl).toString()
        const extracted = extractMeta(html, baseUrl)
        const out: MetaResult = {
          url: finalUrl,
          hostname: new URL(finalUrl).hostname,
          ...extracted,
        }
        return JSON.stringify(out)
      } catch (e) {
        clearTimeout(timer)
        const out: MetaResult = {
          url: finalUrl,
          hostname: new URL(finalUrl).hostname,
        }
        return JSON.stringify(out)
      }
    })()

    cache.__yurie_meta_inflight__!.set(cacheKey, fetchTask)
    const body = await fetchTask
    cache.__yurie_meta_inflight__!.delete(cacheKey)
    cache.__yurie_meta_cache__!.set(cacheKey, { body, expiresAt: now + MEMO_TTL_MS })

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return new Response(
      JSON.stringify({ error: { code: 500, message: msg } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}


