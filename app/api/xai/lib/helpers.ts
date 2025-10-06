export function truncateWithRelevance(text: string, maxChars: number, query: string): string {
  try {
    if (!text || text.length <= maxChars) return text
    
    const queryWords = new Set(
      query.toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3)
    )
    
    const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim())
    
    const scored = sentences.map((sentence, idx) => {
      const words = sentence.toLowerCase().split(/\W+/)
      const matches = words.filter(w => queryWords.has(w)).length
      const score = matches * 1000 + (sentences.length - idx)
      return { sentence, score, length: sentence.length }
    })
    
    scored.sort((a, b) => b.score - a.score)
    
    let total = 0
    const selected: string[] = []
    for (const item of scored) {
      if (total + item.length > maxChars) break
      selected.push(item.sentence)
      total += item.length
    }
    
    return selected.join('. ')
  } catch {
    return text.slice(0, maxChars)
  }
}

export function classifyQuery(query: string): { isSimple: boolean; needsDeepResearch: boolean } {
  try {
    const wordCount = query.split(/\s+/).length
    const hasComplexKeywords = /\b(why|how|explain|analyze|compare|evaluate|research)\b/i.test(query)
    const hasResearchKeywords = /\b(research|latest|news|recent|study|data|statistics|trend|report)\b/i.test(query)
    
    return {
      isSimple: wordCount < 10 && !hasComplexKeywords,
      needsDeepResearch: hasResearchKeywords
    }
  } catch {
    return { isSimple: false, needsDeepResearch: false }
  }
}

export function limitCitationsPerDomain(urls: string[], maxPerDomain: number = 5): string[] {
  try {
    const domainCounts = new Map<string, number>()
    const result: string[] = []
    
    for (const url of urls) {
      try {
        const parsed = new URL(url)
        const domain = parsed.hostname.replace(/^www\./i, '')
        const count = domainCounts.get(domain) || 0
        
        if (count < maxPerDomain) {
          result.push(url)
          domainCounts.set(domain, count + 1)
        }
      } catch {
        result.push(url)
      }
    }
    
    return result
  } catch {
    return urls
  }
}
