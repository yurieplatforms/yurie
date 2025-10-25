import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Shared streaming response headers
const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const
const INSTRUCTIONS = 'You are Yurie, a helpful assistant. When up-to-date, real-world, or hard-to-remember facts are needed, and web search is available, use it to gather information before answering. Use web search sparingly and only when it will materially improve accuracy or timeliness. If you do not need it, answer directly.'
const SEARCH_SOURCES_SUFFIX = '\n\nIf you used web search for this answer, end with a short Sources section listing the 3–5 most relevant links as markdown bullets `[Title](URL)` (avoid duplicates). Do not include a Sources section if you did not use web search.'

// Simple heuristic to decide whether a query likely needs web search
function shouldEnableSearchFromQuery(text: string | undefined | null): boolean {
  if (!text) return false
  const t = text.toLowerCase()

  // Explicit user intent to search/browse
  const explicitSearchRe = /(search|look up|google|bing|browse|check (?:online|the web|the internet)|find (?:online|on the web)|web results|browse the web)/i
  if (explicitSearchRe.test(t)) return true

  // Recency-sensitive keywords
  const recencyRe = /(latest|current|today|now|recent|breaking|news|update|up[- ]to[- ]date|live|this (?:week|month|year))/i
  if (recencyRe.test(t)) return true

  // Common live/volatile info triggers
  const volatileRe = /(stock|price|weather|score|earnings|release date|schedule|deadline|launch|trending|trend|ranking|rank)/i
  if (volatileRe.test(t)) return true

  // Questions about very recent years suggest recency
  if (/\b202[4-9]\b/.test(t) && /(what|who|when|where|is|are)/i.test(t)) return true

  // Presence of URLs often benefits from web context
  if (/https?:\/\//i.test(t)) return true

  // Docs/help queries
  const docsRe = /(docs|documentation|api reference|how to (?:use|install|configure)|error code|stack trace)/i
  if (docsRe.test(t)) return true

  return false
}
export async function POST(request: Request) {
  try {
    const { messages, model, useSearch, inputImages, inputImageUrls, inputPdfBase64, inputPdfUrls, max_output_tokens, web_search, search_results, thinking } = (await request.json()) as {
      messages?: ChatMessage[]
      model?: string
      useSearch?: boolean
      inputImages?: string[]
      inputImageUrls?: string[]
      inputPdfBase64?: string[]
      inputPdfUrls?: string[]
      max_output_tokens?: number
      web_search?: {
        max_uses?: number
        allowed_domains?: string[]
        blocked_domains?: string[]
        user_location?: {
          type: 'approximate'
          city?: string
          region?: string
          country?: string
          timezone?: string
        }
      }
      search_results?: Array<{
        source: string
        title: string
        content: Array<{ type?: 'text'; text: string }>
        citations?: { enabled?: boolean }
        cache_control?: { type: 'ephemeral' }
      }>
      thinking?: {
        type?: 'enabled'
        budget_tokens?: number
      }
    }

    // Default to Claude Sonnet 4.5
    const selectedModel = model && typeof model === 'string' && model.trim().length > 0
      ? model
      : 'claude-sonnet-4-5'

    // Log incoming file attachments for debugging
    if (inputImages && inputImages.length > 0) {
      console.log('[API] Received images (base64):', inputImages.length, 'files')
    }
    if (inputImageUrls && inputImageUrls.length > 0) {
      console.log('[API] Received image URLs:', inputImageUrls.length, 'files')
    }
    if (inputPdfBase64 && inputPdfBase64.length > 0) {
      console.log('[API] Received PDFs (base64):', inputPdfBase64.length, 'files')
    }
    if (inputPdfUrls && inputPdfUrls.length > 0) {
      console.log('[API] Received PDF URLs:', inputPdfUrls.length, 'files')
    }

    // Build Claude Messages API input (supports mixed text and images on the last user message)
    const hasClientMessages = Array.isArray(messages) && messages.length > 0
    const lastUserIndex = hasClientMessages ? [...messages].reverse().findIndex((m) => m.role === 'user') : -1
    const absoluteLastUserIndex = lastUserIndex === -1 ? -1 : (messages!.length - 1 - lastUserIndex)
    const anyCitationsEnabled = Array.isArray(search_results) && search_results.some((sr: any) => sr && sr.citations && sr.citations.enabled === true)

    const claudeMessages = hasClientMessages
      ? messages!.map((m, idx) => {
          const isLastUser = m.role === 'user' && idx === absoluteLastUserIndex
          const hasImages = isLastUser && Array.isArray(inputImages) && inputImages.length > 0
          const hasImageUrls = isLastUser && Array.isArray(inputImageUrls) && inputImageUrls.length > 0
          const hasSearchResults = isLastUser && Array.isArray(search_results) && search_results.length > 0
          const hasPdfBase64 = isLastUser && Array.isArray(inputPdfBase64) && inputPdfBase64.length > 0
          const hasPdfUrls = isLastUser && Array.isArray(inputPdfUrls) && inputPdfUrls.length > 0
          if (hasImages || hasImageUrls || hasSearchResults || hasPdfBase64 || hasPdfUrls) {
            const content: any[] = []
            const textToUse = (typeof m.content === 'string' && m.content.trim().length > 0)
              ? m.content
              : 'Please analyze the attached images.'
            // 1) Optional search results (appear before the user's text)
            if (hasSearchResults) {
              const normalized = (search_results || []).map((sr: any) => {
                const blocks = Array.isArray(sr?.content)
                  ? sr.content
                      .map((b: any) => ({ type: 'text', text: String(b?.text || '') }))
                      .filter((b: any) => b.text && b.text.length > 0)
                  : []
                const out: any = {
                  type: 'search_result',
                  source: String(sr?.source || ''),
                  title: String(sr?.title || ''),
                  content: blocks,
                }
                if (anyCitationsEnabled) out.citations = { enabled: true }
                if (sr?.cache_control && sr.cache_control.type === 'ephemeral') {
                  out.cache_control = { type: 'ephemeral' }
                }
                return out
              }).filter((sr: any) => sr.source && sr.title && Array.isArray(sr.content) && sr.content.length > 0)
              content.push(...normalized)
            }
            // 2) User text
            content.push({ type: 'text', text: textToUse })
            // 3) PDFs (base64)
            if (hasPdfBase64) {
              inputPdfBase64!.forEach((b64) => {
                if (typeof b64 === 'string' && b64.trim().length > 0) {
                  content.push({
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: b64 },
                  })
                }
              })
            }
            // 4) PDFs (URLs)
            if (hasPdfUrls) {
              inputPdfUrls!.forEach((url) => {
                if (typeof url === 'string' && url.startsWith('http')) {
                  content.push({
                    type: 'document',
                    source: { type: 'url', url },
                  })
                }
              })
            }
            if (hasImages) {
              inputImages!.forEach((imageDataUrl) => {
                try { console.log('[API] Adding base64 image to content (length:', imageDataUrl.length, ')') } catch {}
                try {
                  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/)
                  if (match) {
                    const mediaType = match[1]
                    const data = match[2]
                    content.push({
                      type: 'image',
                      source: { type: 'base64', media_type: mediaType, data },
                    })
                  } else {
                    // Fallback: if not a data URL, treat as URL
                    content.push({ type: 'image', source: { type: 'url', url: imageDataUrl } })
                  }
                } catch {}
              })
            }
            if (hasImageUrls) {
              inputImageUrls!.forEach((imageUrl) => {
                try { console.log('[API] Adding image URL to content:', imageUrl.substring(0, 50) + '...') } catch {}
                content.push({ type: 'image', source: { type: 'url', url: imageUrl } })
              })
            }
            return { role: m.role, content }
          }
          return { role: m.role, content: m.content }
        })
      : [{ role: 'user', content: '' }]

    // Auto-detect if the query likely needs search
    const autoEnableSearch = (() => {
      const lastUserMessage = Array.isArray(messages)
        ? [...messages].reverse().find((m) => m.role === 'user')
        : undefined
      return shouldEnableSearchFromQuery(lastUserMessage?.content)
    })()
    const wantsSearch = Boolean(useSearch || autoEnableSearch || web_search)

    // Guard: ensure API key present
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const encoder = new TextEncoder()

    // Prepare Claude Messages payload
    const payload: any = {
      model: selectedModel,
      max_tokens: (() => {
        if (typeof max_output_tokens === 'number' && Number.isFinite(max_output_tokens) && max_output_tokens > 0) {
          const SAFE_MAX_TOKENS = 8192
          return Math.min(SAFE_MAX_TOKENS, Math.max(1, Math.floor(max_output_tokens)))
        }
        return 1024
      })(),
      system: (() => wantsSearch ? (INSTRUCTIONS + SEARCH_SOURCES_SUFFIX) : INSTRUCTIONS)(),
      messages: claudeMessages,
      stream: true,
    }
    // Optional extended thinking per docs
    if (thinking && thinking.type === 'enabled') {
      const budget = typeof thinking.budget_tokens === 'number' && Number.isFinite(thinking.budget_tokens)
        ? Math.max(1024, Math.floor(thinking.budget_tokens))
        : undefined
      if (budget !== undefined) {
        // Ensure budget is < max_tokens per docs; clamp if needed
        const safeBudget = Math.max(1, Math.min((payload.max_tokens || 1024) - 1, budget))
        payload.thinking = { type: 'enabled', budget_tokens: safeBudget }
      } else {
        payload.thinking = { type: 'enabled' }
      }
    }
    if (wantsSearch) {
      const tool: any = { type: 'web_search_20250305', name: 'web_search' }
      // If client provided config, apply it per docs (can't use both allow+block)
      if (web_search && typeof web_search.max_uses === 'number' && Number.isFinite(web_search.max_uses) && web_search.max_uses > 0) {
        tool.max_uses = Math.min(10, Math.max(1, Math.floor(web_search.max_uses)))
      } else {
        tool.max_uses = 5
      }
      if (web_search && Array.isArray(web_search.allowed_domains) && web_search.allowed_domains.length > 0) {
        tool.allowed_domains = web_search.allowed_domains
      } else if (web_search && Array.isArray(web_search.blocked_domains) && web_search.blocked_domains.length > 0) {
        tool.blocked_domains = web_search.blocked_domains
      }
      if (web_search && web_search.user_location && web_search.user_location.type === 'approximate') {
        tool.user_location = web_search.user_location
      }
      payload.tools = [tool]
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const stream: any = await anthropic.messages.create({ ...payload, stream: true })
          for await (const event of stream) {
            try {
              const type = String(event?.type || '')
              if (type === 'content_block_delta') {
                const delta = (event as any)?.delta
                if (delta && delta.type === 'text_delta' && typeof delta.text === 'string') {
                  controller.enqueue(encoder.encode(delta.text))
                }
                if (delta && delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
                  controller.enqueue(encoder.encode(`<thinking:${delta.thinking}>`))
                }
              }
            } catch {}
          }
        } catch {
          controller.enqueue(encoder.encode(`\n[error] Something went wrong. Please try again.\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, { headers: { ...STREAM_HEADERS } })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}