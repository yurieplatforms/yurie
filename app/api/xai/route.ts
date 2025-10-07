import { buildMessages } from './lib/messages'
import { truncateWithRelevance, classifyQuery } from './lib/helpers'

export const runtime = 'nodejs'
export const maxDuration = 300

// Global source caps (can be overridden via env)
function getPositiveIntEnv(name: string, fallback: number): number {
  try {
    const raw = process.env[name]
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
  } catch {
    return fallback
  }
}
const MAX_SOURCES_WEB = (() => {
  // Support multiple env names for flexibility
  const primary = getPositiveIntEnv('MAX_SOURCES_WEB', NaN as unknown as number)
  if (Number.isFinite(primary)) return primary as unknown as number
  const alt = getPositiveIntEnv('EXA_MAX_SOURCES_WEB', NaN as unknown as number)
  if (Number.isFinite(alt)) return alt as unknown as number
  return 50
})()
const MAX_SOURCES_RESEARCH = (() => {
  const primary = getPositiveIntEnv('MAX_SOURCES_RESEARCH', NaN as unknown as number)
  if (Number.isFinite(primary)) return primary as unknown as number
  const alt = getPositiveIntEnv('EXA_MAX_SOURCES_RESEARCH', NaN as unknown as number)
  if (Number.isFinite(alt)) return alt as unknown as number
  return 100
})()

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type ChatRequestPayload = {
  messages: ChatMessage[]
  inputImages?: string[]
  inputPdfs?: string[]
  inputAudio?: Array<string | { data: string; format: string }>
  plugins?: unknown
  previousResponseId?: string | null
  model?: string
  reasoning?: { effort?: 'low' | 'medium' | 'high' } | Record<string, unknown>
  search_parameters?: { mode?: 'on' | 'off'; return_citations?: boolean } | Record<string, unknown>
}

function resolveModel(incoming?: string | null): string {
  const envDefault = process.env.XAI_MODEL_DEFAULT
  if (envDefault && typeof envDefault === 'string' && envDefault.trim()) {
    return envDefault.trim()
  }
  if (!incoming || !String(incoming).trim()) {
    return 'grok-4-fast-reasoning'
  }
  const val = String(incoming)
  if (val.toLowerCase().startsWith('x-ai/')) {
    return val.split('/', 1)[0] === 'x-ai' ? val.split('/', 2)[1] : val
  }
  return val
}

function isOpenRouterSelectedModel(model?: string | null): boolean {
  try {
    return typeof model === 'string' && model.toLowerCase().startsWith('openrouter/')
  } catch {
    return false
  }
}

function normalizeOpenRouterModelTag(model?: string | null): string {
  if (!model) return ''
  const s = String(model)
  return s.toLowerCase().startsWith('openrouter/') ? s.slice('openrouter/'.length) : s
}
function streamWithClaudeThinkingThenFinal(payload: ChatRequestPayload): Response {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const requestStart = Date.now()
      const timing: Record<string, number> = {}
      
      // Build messages once and reuse
      const messagesPromise = (async () => await buildMessages(payload))()
      // Extract last user query for external search providers (EXA)
      const lastUserQuery: string = (() => {
        try {
          const arr = Array.isArray(payload?.messages) ? payload.messages : []
          for (let i = arr.length - 1; i >= 0; i--) {
            const m = arr[i]
            if (m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
              return m.content.trim()
            }
          }
        } catch {}
        return ''
      })()
      const webSearchModeOn: boolean = (() => {
        try {
          const sp: any = (payload.search_parameters as any) || {}
          return typeof sp?.mode === 'string' && String(sp.mode).toLowerCase() === 'on'
        } catch {
          return false
        }
      })()
      
      // Detect Research mode (Grok 4 with Live Search)
      const isResearchMode: boolean = (() => {
        try {
          const m = String(payload?.model || '')
          const lower = m.toLowerCase()
          return lower.includes('grok-4-0709')
        } catch {
          return false
        }
      })()
      
      // Classify query to optimize phase selection
      const queryClassification = classifyQuery(lastUserQuery)
      
      const suppressReasoningStreaming: boolean = false
      let webFlagSent = false
      try {
        if (webSearchModeOn) {
          controller.enqueue(encoder.encode(`<web:on>`))
          webFlagSent = true
        }
      } catch {}
      
      // Cache check
      const cacheKey = `${payload.model}:${JSON.stringify((payload.messages || []).slice(-2))}:${webSearchModeOn}`
      const cache = (globalThis as any).__yurie_pipeline_cache__ = (globalThis as any).__yurie_pipeline_cache__ || new Map()
      const now = Date.now()
      const cached = cache.get(cacheKey)
      let qwenReasoningPieces: string[] = []
      let grokResearchPieces: string[] = []
      let grokResearchCitations: string[] | null = null
      let exaResearchPieces: string[] = []
      let exaResearchCitations: string[] | null = null
      
      if (cached && cached.expiresAt > now) {
        qwenReasoningPieces = cached.qwenReasoningPieces || []
        grokResearchPieces = cached.grokResearchPieces || []
        grokResearchCitations = cached.grokResearchCitations || null
        exaResearchPieces = cached.exaResearchPieces || []
        exaResearchCitations = cached.exaResearchCitations || null
        timing.cached = 1
      } else {
        // Run phases in parallel (only if not cached)
        const phases: Promise<any>[] = []
        
        // Phase 1: Claude Sonnet 4.5 (Reasoning) - skip for simple queries (except Research mode)
        const phase1Start = Date.now()
        const shouldRunReasoning = isResearchMode || !queryClassification.isSimple
        if (shouldRunReasoning) {
          const openrouterKey = process.env.OPENROUTER_API_KEY
          if (openrouterKey) {
            phases.push((async () => {
              try {
                const messages = await messagesPromise
                const headers: Record<string, string> = {
                  'Authorization': `Bearer ${openrouterKey}`,
                  'Content-Type': 'application/json',
                }
                try {
                  const ref = process.env.OPENROUTER_HTTP_REFERER
                  const title = process.env.OPENROUTER_X_TITLE
                  if (ref) headers['HTTP-Referer'] = ref
                  if (title) headers['X-Title'] = title
                } catch {}
                const qwenThinkingBody: Record<string, any> = {
                  model: 'anthropic/claude-sonnet-4.5',
                  stream: true,
                  messages,
                  reasoning: { effort: 'low' },
                }
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(qwenThinkingBody),
                })
                if (res.ok && res.body) {
                  const reader = res.body.getReader()
                  let buffer = ''
                  while (true) {
                    const { value, done } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    let idx: number
                    while ((idx = buffer.indexOf('\n')) !== -1) {
                      const line = buffer.slice(0, idx)
                      buffer = buffer.slice(idx + 1)
                      const trimmed = line.trim()
                      if (!trimmed || !trimmed.startsWith('data:')) continue
                      const data = trimmed.slice(5).trim()
                      if (!data || data === '[DONE]') continue
                      let obj: any
                      try {
                        obj = JSON.parse(data)
                      } catch {
                        continue
                      }
                      try {
                        const choices = Array.isArray(obj?.choices) ? obj.choices : []
                        for (const ch of choices) {
                          const delta = ch?.delta
                          // Only forward reasoning signals from Claude Sonnet 4.5 reasoning phase
                          try {
                            const rdCheck: any[] = Array.isArray((delta as any)?.reasoning_details)
                              ? (delta as any).reasoning_details
                              : []
                            const hasDetails = rdCheck.length > 0
                            const reasonDelta: unknown = (delta as any)?.reasoning
                            if (!hasDetails && typeof reasonDelta === 'string' && reasonDelta) {
                              const b64 = Buffer.from(reasonDelta, 'utf8').toString('base64')
                              if (!suppressReasoningStreaming) {
                                controller.enqueue(encoder.encode(`<reasoning_partial:${b64}>`))
                              }
                              qwenReasoningPieces.push(reasonDelta)
                            }
                          } catch {}
                          try {
                            const rd: any[] = Array.isArray((delta as any)?.reasoning_details)
                              ? (delta as any).reasoning_details
                              : []
                            for (const d of rd) {
                              const t = d?.type
                              if (t === 'reasoning.text') {
                                const text: unknown = d?.text
                                if (typeof text === 'string' && text) {
                                  const b64 = Buffer.from(text, 'utf8').toString('base64')
                                  if (!suppressReasoningStreaming) {
                                    controller.enqueue(encoder.encode(`<reasoning_partial:${b64}>`))
                                  }
                                  qwenReasoningPieces.push(text)
                                }
                              }
                            }
                          } catch {}
                          // Emit final reasoning if present on the message
                          try {
                            const finalReasoning: unknown = ch?.message?.reasoning
                            const rdFinal: any[] = Array.isArray(ch?.message?.reasoning_details)
                              ? ch.message.reasoning_details
                              : []
                            if (rdFinal.length > 0) {
                              const parts: string[] = []
                              for (const d of rdFinal) {
                                if (d?.type === 'reasoning.text' && typeof d?.text === 'string') {
                                  parts.push(d.text)
                                }
                              }
                              const joined = parts.join('\n')
                              if (joined) {
                                const b64 = Buffer.from(joined, 'utf8').toString('base64')
                                if (!suppressReasoningStreaming) {
                                  controller.enqueue(encoder.encode(`<reasoning:${b64}>`))
                                }
                                qwenReasoningPieces.push(joined)
                              }
                            } else if (typeof finalReasoning === 'string' && finalReasoning) {
                              const b64 = Buffer.from(finalReasoning, 'utf8').toString('base64')
                              if (!suppressReasoningStreaming) {
                                controller.enqueue(encoder.encode(`<reasoning:${b64}>`))
                              }
                              qwenReasoningPieces.push(finalReasoning)
                            }
                          } catch {}
                        }
                      } catch {}
                    }
                  }
                }
                timing.phase1 = Date.now() - phase1Start
                return { type: 'phase1', reasoning: qwenReasoningPieces }
              } catch (e) {
                timing.phase1 = Date.now() - phase1Start
                return { type: 'phase1', reasoning: [] }
              }
            })())
          }
        }

        // Phase 2: Grok 4 Fast (Live Search) - run in parallel
        const phase2Start = Date.now()
        if (webSearchModeOn) {
          const xaiKey = process.env.XAI_API_KEY
          if (xaiKey) {
            phases.push((async () => {
              try {
                const localGrokResearchPieces: string[] = []
                let localGrokResearchCitations: string[] | null = null
                const grokUrlSet = new Set<string>()
                const messages = await messagesPromise
                const requestBody: Record<string, any> = {
                  model: 'grok-4-fast-reasoning',
                  messages,
                  stream: true,
                  search_parameters: { mode: 'on', return_citations: true },
                }
                const res = await fetch('https://api.x.ai/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${xaiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody),
                })
                if (res.ok && res.body) {
                  const reader = res.body.getReader()
                  let buffer = ''
                  while (true) {
                    const { value, done } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    let idx: number
                    while ((idx = buffer.indexOf('\n')) !== -1) {
                      const line = buffer.slice(0, idx)
                      buffer = buffer.slice(idx + 1)
                      const trimmed = line.trim()
                      if (!trimmed || !trimmed.startsWith('data:')) continue
                      const data = trimmed.slice(5).trim()
                      if (!data || data === '[DONE]') continue
                      let obj: any
                      try {
                        obj = JSON.parse(data)
                      } catch {
                        continue
                      }
                      try {
                        const choices = Array.isArray(obj?.choices) ? obj.choices : []
                        for (const ch of choices) {
                          const delta = ch?.delta
                          const content: unknown = delta?.content
                          if (typeof content === 'string' && content) {
                            localGrokResearchPieces.push(content)
                          }
                        }
                      } catch {}
                      try {
                        const cits = (obj as any)?.citations
                        if (Array.isArray(cits)) {
                          const citStrings = cits.map((u: any) => String(u))
                          for (const u of citStrings) {
                            if (typeof u === 'string' && u) grokUrlSet.add(u)
                          }
                          localGrokResearchCitations = Array.from(grokUrlSet)
                        }
                      } catch {}
                    }
                  }
                }
                timing.phase2 = Date.now() - phase2Start
                return { type: 'phase2', research: localGrokResearchPieces, citations: localGrokResearchCitations }
              } catch (e) {
                timing.phase2 = Date.now() - phase2Start
                return { type: 'phase2', research: [], citations: null }
              }
            })())
          }
        }

        // Phase 2.5: EXA Search - run in parallel
        // Research mode (Grok 4): 3x more sources and deeper context
        // Web mode: Standard configuration for speed
        const phase2_5Start = Date.now()
        // Always run EXA when web search is enabled
        if (webSearchModeOn) {
          const exaKey = process.env.EXA_API_KEY
          if (exaKey && lastUserQuery) {
            phases.push((async () => {
              try {
                const localExaResearchPieces: string[] = []
                let localExaResearchCitations: string[] | null = null
                
                // Research mode gets more sources and richer content
                const exaConfig = isResearchMode ? {
                  // Clamp to provider practical limits and our backend cap
                  numResults: Math.min(100, MAX_SOURCES_RESEARCH),
                  textMaxChars: 2000,
                  highlightsPerUrl: 3,
                  subpages: 3,
                  extraLinks: 8,
                  contextMaxChars: 10000,
                } : {
                  numResults: 80,
                  textMaxChars: 1000,
                  highlightsPerUrl: 1,
                  subpages: 1,
                  extraLinks: 3,
                  contextMaxChars: 4000,
                }
                
                const exaBody: Record<string, any> = {
                  query: lastUserQuery,
                  type: 'neural',
                  numResults: exaConfig.numResults,
                  moderation: true,
                  contents: {
                    text: { maxCharacters: exaConfig.textMaxChars, includeHtmlTags: false },
                    highlights: {
                      numSentences: 2,
                      highlightsPerUrl: exaConfig.highlightsPerUrl,
                      query: lastUserQuery,
                    },
                    summary: { query: 'Key takeaways and evidence' },
                    livecrawl: 'preferred',
                    subpages: exaConfig.subpages,
                    subpageTarget: 'sources',
                    extras: { links: exaConfig.extraLinks, imageLinks: 1 },
                    context: { maxCharacters: exaConfig.contextMaxChars },
                  },
                }
                const res = await fetch('https://api.exa.ai/search', {
                  method: 'POST',
                  headers: {
                    'x-api-key': exaKey,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(exaBody),
                })
                if (res.ok) {
                  const data: any = await res.json().catch(() => null)
                  if (data && Array.isArray(data.results)) {
                    const urlSet = new Set<string>()
                    const domainCounts = new Map<string, number>()
                    
                    // Helper to add URL with domain limit
                    const exaMaxPerDomain = isResearchMode ? 100 : 50
                    const addUrlWithLimit = (url: string, maxPerDomain: number = exaMaxPerDomain): boolean => {
                      try {
                        const parsed = new URL(url)
                        const domain = parsed.hostname.replace(/^www\./i, '')
                        const count = domainCounts.get(domain) || 0
                        
                        if (count < maxPerDomain && !urlSet.has(url)) {
                          urlSet.add(url)
                          domainCounts.set(domain, count + 1)
                          return true
                        }
                        return false
                      } catch {
                        // Invalid URL, include it anyway
                        if (!urlSet.has(url)) {
                          urlSet.add(url)
                          return true
                        }
                        return false
                      }
                    }
                    
                    for (const r of data.results) {
                      try {
                        const lines: string[] = []
                        const title = typeof r?.title === 'string' ? r.title : ''
                        const url = typeof r?.url === 'string' ? r.url : ''
                        const summary = typeof r?.summary === 'string' ? r.summary : ''
                        const author = typeof r?.author === 'string' ? r.author : ''
                        const publishedDate = typeof r?.publishedDate === 'string' ? r.publishedDate : ''
                        const fullText = typeof r?.text === 'string' ? r.text : ''
                        const clippedText = fullText && fullText.length > 1500 ? fullText.slice(0, 1500) : fullText
                        const highlights: string[] = Array.isArray(r?.highlights) ? r.highlights.filter((h: any) => typeof h === 'string') : []
                        
                        if (title) lines.push(title)
                        if (url) { 
                          lines.push(url)
                          addUrlWithLimit(url, exaMaxPerDomain)
                        }
                        if (author) lines.push(`Author: ${author}`)
                        if (publishedDate) lines.push(`Published: ${publishedDate}`)
                        if (summary) lines.push(summary)
                        for (const h of highlights) lines.push(h)
                        if (clippedText) lines.push(clippedText)
                        
                        // Collect subpage URLs if present (with domain limit)
                        try {
                          const subs: any[] = Array.isArray(r?.subpages) ? r.subpages : []
                          for (const sp of subs) {
                            const spTitle = typeof sp?.title === 'string' ? sp.title : ''
                            const spUrl = typeof sp?.url === 'string' ? sp.url : ''
                            const spSummary = typeof sp?.summary === 'string' ? sp.summary : ''
                            const spText = typeof sp?.text === 'string' ? sp.text : ''
                            const spHighlights: string[] = Array.isArray(sp?.highlights) ? sp.highlights.filter((h: any) => typeof h === 'string') : []
                            const spClipped = spText && spText.length > 800 ? spText.slice(0, 800) : spText
                            
                            if (spTitle) lines.push(spTitle)
                            if (spUrl) { 
                              lines.push(spUrl)
                              addUrlWithLimit(spUrl, exaMaxPerDomain)
                            }
                            if (spSummary) lines.push(spSummary)
                            for (const h of spHighlights) lines.push(h)
                            if (spClipped) lines.push(spClipped)
                          }
                        } catch {}
                        
                        // Collect extras.links if present (with domain limit)
                        try {
                          const exLinks: any[] = Array.isArray(r?.extras?.links) ? r.extras.links : []
                          for (const u of exLinks) {
                            if (typeof u === 'string' && u) addUrlWithLimit(u, exaMaxPerDomain)
                          }
                        } catch {}
                        
                        if (lines.length > 0) localExaResearchPieces.push(lines.join('\n'))
                      } catch {}
                    }
                    // Apply a global cap on EXA citations before merging, to keep signal high
                    const exaCap = isResearchMode ? MAX_SOURCES_RESEARCH : MAX_SOURCES_WEB
                    const arr = Array.from(urlSet)
                    localExaResearchCitations = arr.slice(0, Math.max(0, exaCap))
                }
              }
              timing.phase2_5 = Date.now() - phase2_5Start
              return { type: 'phase2_5', research: localExaResearchPieces, citations: localExaResearchCitations }
            } catch (e) {
              timing.phase2_5 = Date.now() - phase2_5Start
              return { type: 'phase2_5', research: [], citations: null }
            }
          })())
        }
      }
      
      // Wait for all phases to complete in parallel
      const results = await Promise.all(phases)
      
      // Extract results from phases
      for (const result of results) {
        if (result.type === 'phase1') {
          qwenReasoningPieces = result.reasoning || []
        } else if (result.type === 'phase2') {
          grokResearchPieces = result.research || []
          grokResearchCitations = result.citations
        } else if (result.type === 'phase2_5') {
          exaResearchPieces = result.research || []
          exaResearchCitations = result.citations
        }
      }
      
      // Cache the results
      const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
      cache.set(cacheKey, {
        qwenReasoningPieces,
        grokResearchPieces,
        grokResearchCitations,
        exaResearchPieces,
        exaResearchCitations,
        expiresAt: now + CACHE_TTL_MS
      })
    }

      // Phase 3: Final answer from selected model
      try {
        const modelRaw = resolveModel(payload.model)
        const isOR = isOpenRouterSelectedModel(payload.model)

        // Inject Claude Sonnet 4.5 reasoning as an extra system message before final generation (hidden; not streamed)
        const baseMessages = await messagesPromise
        let messagesWithNotes = baseMessages
        try {
          // Research mode gets larger context limits for comprehensive analysis
          const contextLimits = isResearchMode ? {
            claude: 5000,
            grok: 5000,
            exa: 12000,
          } : {
            claude: 3000,
            grok: 3000,
            exa: 4000,
          }
          
          const claudeCombined = qwenReasoningPieces.join('\n')
          const claudeTrimmed = truncateWithRelevance(claudeCombined, contextLimits.claude, lastUserQuery)
          const grokCombined = grokResearchPieces.join('')
          const grokTrimmed = truncateWithRelevance(grokCombined, contextLimits.grok, lastUserQuery)
          const exaCombined = exaResearchPieces.join('\n')
          const exaTrimmed = truncateWithRelevance(exaCombined, contextLimits.exa, lastUserQuery)
          const parts: string[] = []
          if (claudeTrimmed) {
            parts.push(`Claude Sonnet 4.5 notes (internal; do not reveal):\n\n${claudeTrimmed}`)
          }
          if (grokTrimmed) {
            parts.push(`Grok 4 Fast (Live Search) research notes (internal; do not reveal):\n\n${grokTrimmed}`)
          }
          if (exaTrimmed) {
            parts.push(`EXA Web Search notes (internal; do not reveal):\n\n${exaTrimmed}`)
          }
          const noteText = parts.length > 0
            ? `Internal notes from prior reasoning and research (do not reveal verbatim). Use only to improve answer quality.\n\n${parts.join('\n\n')}`
            : ''
          if (noteText) {
            const sysNote: any = { role: 'system', content: [{ type: 'text', text: noteText }] }
            if (Array.isArray(baseMessages) && baseMessages.length > 0 && (baseMessages as any)[0]?.role === 'system') {
              messagesWithNotes = [baseMessages[0] as any, sysNote, ...(baseMessages as any).slice(1)]
            } else {
              messagesWithNotes = [sysNote, ...(baseMessages as any)]
            }
          }
        } catch {}

        if (isOR) {
          // OpenRouter final generation
          const apiKey = process.env.OPENROUTER_API_KEY
          if (!apiKey) {
            // Fall back to xAI if no OpenRouter key
            throw new Error('Missing OPENROUTER_API_KEY')
          }
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }
          try {
            const ref = process.env.OPENROUTER_HTTP_REFERER
            const title = process.env.OPENROUTER_X_TITLE
            if (ref) headers['HTTP-Referer'] = ref
            if (title) headers['X-Title'] = title
          } catch {}

          const requestBody: Record<string, any> = {
            model: normalizeOpenRouterModelTag(payload.model),
            messages: messagesWithNotes,
            stream: true,
          }
        // No image-generation modalities
          // Pass-through search params/plugins similar to streamFromOpenRouter
          try {
            const sp: any = (payload.search_parameters as any) || {}
            const mode = sp?.mode
            const shouldUseWeb = typeof mode === 'string' && mode.toLowerCase() === 'on'
            const lowerModel = String(requestBody.model || '').toLowerCase()
            const advancedEngine = typeof sp?.engine === 'string' ? sp.engine : undefined
            const maxResults = typeof sp?.max_results === 'number' ? sp.max_results : undefined
            const searchPrompt = typeof sp?.search_prompt === 'string' ? sp.search_prompt : undefined
            const webSearchOptions = sp?.web_search_options && typeof sp.web_search_options === 'object'
              ? sp.web_search_options
              : undefined
            if (webSearchOptions) {
              ;(requestBody as any).web_search_options = webSearchOptions
            }
            const hasExplicitWebPlugin = Array.isArray((requestBody as any).plugins)
              && (requestBody as any).plugins.some((p: any) => p && typeof p.id === 'string' && p.id === 'web')
            const wantsAdvancedWebPlugin = Boolean(
              advancedEngine || maxResults || searchPrompt || webSearchOptions || hasExplicitWebPlugin
            )
            if (shouldUseWeb) {
              if (wantsAdvancedWebPlugin) {
                const plugins = Array.isArray((requestBody as any).plugins)
                  ? (requestBody as any).plugins.slice()
                  : []
                if (!hasExplicitWebPlugin) {
                  const webPlugin: any = { id: 'web' }
                  const inferredEngine = advancedEngine
                    || ((/^(openai|anthropic)\//.test(lowerModel) || /^perplexity\//.test(lowerModel)) ? 'native' : undefined)
                  if (inferredEngine) webPlugin.engine = inferredEngine
                  if (typeof maxResults === 'number') webPlugin.max_results = maxResults
                  if (typeof searchPrompt === 'string') webPlugin.search_prompt = searchPrompt
                  plugins.push(webPlugin)
                }
                ;(requestBody as any).plugins = plugins
              }
            }
          } catch {}

          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
          })
          if (!res.ok || !res.body) {
            const text = await res.text().catch(() => '')
            controller.enqueue(encoder.encode(text || `HTTP ${res.status}`))
            controller.close()
            return
          }
          const reader = res.body.getReader()
          let buffer = ''
          let firstIdSent = false
          const lastCitations: string[] = []
          const collectAnnotations = (anns: any[]) => {
            try {
              for (const a of anns) {
                try {
                  if (a && a.type === 'url_citation') {
                    const u = a?.url_citation?.url
                    if (typeof u === 'string' && u && !lastCitations.includes(u)) {
                      lastCitations.push(u)
                    }
                  }
                } catch {}
              }
            } catch {}
          }
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let idx: number
            while ((idx = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 1)
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data:')) continue
              const data = trimmed.slice(5).trim()
              if (!data || data === '[DONE]') continue
              let obj: any
              try {
                obj = JSON.parse(data)
              } catch {
                continue
              }
              // Announce web search if not already announced (for OR path too)
              try {
                if (!webFlagSent && webSearchModeOn) {
                  webFlagSent = true
                  controller.enqueue(encoder.encode(`<web:on>`))
                }
              } catch {}
              try {
                if (!firstIdSent && typeof obj?.id === 'string' && obj.id) {
                  firstIdSent = true
                  controller.enqueue(encoder.encode(`<response_id:${obj.id}>`))
                }
              } catch {}
              try {
                const choices = Array.isArray(obj?.choices) ? obj.choices : []
                for (const ch of choices) {
                  const delta = ch?.delta
                  const content: unknown = delta?.content
                  if (typeof content === 'string' && content) {
                    controller.enqueue(encoder.encode(content))
                  }
                  // We intentionally ignore final-stage reasoning tags; Claude Sonnet 4.5 already provided reasoning
                  // Do not stream image deltas; only emit final images when available
                  const msgImages: any[] = Array.isArray(ch?.message?.images) ? ch.message.images : []
                  for (const im of msgImages) {
                    try {
                      const url = im?.image_url?.url
                      if (typeof url === 'string' && url) {
                        controller.enqueue(encoder.encode(`<image:${url}>`))
                      }
                    } catch {}
                  }
                  // Collect URL citations
                  try {
                    const anns = Array.isArray((ch as any)?.message?.annotations)
                      ? (ch as any).message.annotations
                      : []
                    if (anns.length > 0) collectAnnotations(anns)
                  } catch {}
                }
              } catch {}
              try {
                const rootAnns = Array.isArray((obj as any)?.message?.annotations)
                  ? (obj as any).message.annotations
                  : []
                if (rootAnns.length > 0) collectAnnotations(rootAnns)
              } catch {}
            }
          }
          try {
            const merged = Array.from(new Set([...(lastCitations || []), ...((grokResearchCitations || []) as string[]), ...((exaResearchCitations || []) as string[])]))
            const cap = isResearchMode ? MAX_SOURCES_RESEARCH : MAX_SOURCES_WEB
            const mergedCapped = merged.slice(0, Math.max(0, cap))
            if (mergedCapped.length > 0) {
              controller.enqueue(encoder.encode(`<citations:${JSON.stringify(mergedCapped)}>`))
            }
          } catch {}
        } else {
          // xAI final generation
          const apiKey = process.env.XAI_API_KEY
          if (!apiKey) {
            throw new Error('Missing XAI_API_KEY')
          }
          const requestBody: Record<string, any> = {
            model: modelRaw,
            messages: messagesWithNotes,
            stream: true,
          }
          // Include search parameters if provided
          const sp = payload.search_parameters
          if (sp && typeof sp === 'object') {
            requestBody.search_parameters = sp
          }
          const res = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })
          if (!res.ok || !res.body) {
            const text = await res.text().catch(() => '')
            controller.enqueue(encoder.encode(text || `HTTP ${res.status}`))
            controller.close()
            return
          }
          const reader = res.body.getReader()
          let buffer = ''
          let firstIdSent = false
          let sentWebFlag = webFlagSent
          let lastCitations: string[] | null = null
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let idx: number
            while ((idx = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 1)
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data:')) continue
              const data = trimmed.slice(5).trim()
              if (!data || data === '[DONE]') continue
              let obj: any
              try {
                obj = JSON.parse(data)
              } catch {
                continue
              }
              try {
                if (!firstIdSent && typeof obj?.id === 'string' && obj.id) {
                  firstIdSent = true
                  controller.enqueue(encoder.encode(`<response_id:${obj.id}>`))
                }
              } catch {}
              // Announce web search usage once if enabled
              try {
                if (!sentWebFlag && webSearchModeOn) {
                  sentWebFlag = true
                  controller.enqueue(encoder.encode(`<web:on>`))
                }
              } catch {}
              try {
                const choices = Array.isArray(obj?.choices) ? obj.choices : []
                for (const ch of choices) {
                  const delta = ch?.delta
                  const content: unknown = delta?.content
                  if (typeof content === 'string' && content) {
                    controller.enqueue(encoder.encode(content))
                  }
                  // Ignore xAI reasoning here; Claude Sonnet 4.5 handled reasoning
                }
              } catch {}
              // Collect citations if provided by xAI
              try {
                const cits = (obj as any)?.citations
                if (Array.isArray(cits)) {
                  lastCitations = cits.map((u: any) => String(u))
                }
              } catch {}
            }
          }
          try {
            const merged = Array.from(new Set([...(lastCitations || []), ...((grokResearchCitations || []) as string[]), ...((exaResearchCitations || []) as string[])]))
            const cap = isResearchMode ? MAX_SOURCES_RESEARCH : MAX_SOURCES_WEB
            const mergedCapped = merged.slice(0, Math.max(0, cap))
            if (mergedCapped.length > 0) {
              controller.enqueue(encoder.encode(`<citations:${JSON.stringify(mergedCapped)}>`))
            }
          } catch {}
        }
      } catch (e) {
        try {
          const msg = e instanceof Error ? e.message : 'Upstream error'
          controller.enqueue(encoder.encode(msg))
        } catch {}
      } finally {
        // Send timing telemetry
        try {
          timing.total = Date.now() - requestStart
          controller.enqueue(encoder.encode(`\n<!-- Timing: ${JSON.stringify(timing)} -->`))
        } catch {}
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    let payload: ChatRequestPayload
    try {
      payload = JSON.parse(raw)
    } catch {
      return new Response(
        JSON.stringify({ error: { code: 400, message: 'Invalid JSON body' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return streamWithClaudeThinkingThenFinal(payload)
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 500, message: 'Internal server error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: 'ok', message: 'Use POST to /api/xai' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

