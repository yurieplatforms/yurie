import type {
  ExaSearchCategory,
  ExaSearchType,
  ExaLivecrawlMode,
  ExaSearchResultItem,
  ExaSearchResult,
} from '@/lib/types'
import {
  parseExaError,
  toExaErrorInfo,
  retryWithBackoff,
  logExaError,
  type RetryConfig,
} from '../exa-errors'
import { getExaClient, DEFAULT_EXA_RETRY_CONFIG } from './client'

// ============================================================================
// Search Input Types
// ============================================================================

/**
 * Input parameters for EXA search
 * @see https://docs.exa.ai/reference/search
 * @see https://docs.exa.ai/reference/contents-retrieval
 */
export type ExaSearchInput = {
  /** The search query - supports semantic/neural search */
  query: string
  /** Category to filter results (e.g., 'news', 'company', 'research paper', 'tweet') */
  category?: ExaSearchCategory
  /**
   * Number of results to return.
   * - Default: 10
   * - Maximum: 100 (for neural and deep search)
   * @see https://docs.exa.ai/reference/search#body-num-results
   */
  numResults?: number
  /** Only include results published after this date (ISO 8601) */
  startPublishedDate?: string
  /** Only include results published before this date (ISO 8601) */
  endPublishedDate?: string
  /**
   * Only include results crawled/discovered after this date (ISO 8601).
   * Crawl date is when Exa discovered the link.
   */
  startCrawlDate?: string
  /**
   * Only include results crawled/discovered before this date (ISO 8601).
   * Crawl date is when Exa discovered the link.
   */
  endCrawlDate?: string
  /** Only include results from these domains */
  includeDomains?: string[]
  /** Exclude results from these domains */
  excludeDomains?: string[]
  /**
   * Required text that must appear in results (up to 5 words).
   * Only checks first 1000 words of webpage text.
   */
  includeText?: string[]
  /**
   * Text that must NOT appear in results (up to 5 words).
   * Only checks first 1000 words of webpage text.
   */
  excludeText?: string[]
  /**
   * Search type controlling search behavior.
   * - 'auto' (default): Intelligently combines multiple search methods
   * - 'neural': AI semantic search using embeddings
   * - 'keyword': Traditional keyword matching
   * - 'fast': Streamlined for speed (<425ms p50 latency)
   * - 'deep': Comprehensive search with query expansion (best for research)
   * @see https://docs.exa.ai/reference/how-exa-search-works
   */
  type?: ExaSearchType
  /**
   * Additional query variations for deep search.
   * Only works with type="deep". Used alongside the main query for comprehensive results.
   */
  additionalQueries?: string[]
  /**
   * Livecrawl mode for content freshness.
   * - 'always': Always fetch fresh content (slowest, freshest) - for real-time data
   * - 'preferred': Prefer live crawling, falls back on failure - for production apps
   * - 'fallback': Use cache first, live crawl if unavailable (default)
   * - 'never': Only use cached content (fastest)
   * @see https://docs.exa.ai/reference/livecrawling-contents
   */
  livecrawl?: ExaLivecrawlMode | boolean
  /**
   * User's country code for localized results (e.g., 'US', 'GB', 'JP').
   */
  userLocation?: string

  // ============================================================================
  // Content Retrieval Options (Exa Best Practices)
  // @see https://docs.exa.ai/reference/contents-retrieval
  // ============================================================================

  /**
   * Return page contents as a context string optimized for LLMs.
   * When true, combines all result contents into one string.
   * Context strings often perform better than highlights for RAG applications.
   * @default false
   */
  useContext?: boolean
  /**
   * Maximum characters for context string (when useContext is true).
   * Recommended: 10000+ characters for best results.
   * @default 10000
   */
  contextMaxCharacters?: number
  /**
   * Enable highlights - key excerpts from content.
   * Recommended for LLM context as it provides focused, relevant text.
   * @default true
   */
  useHighlights?: boolean
  /**
   * Custom query for extracting highlights.
   * Useful when highlight focus differs from search query.
   */
  highlightsQuery?: string
  /**
   * Number of sentences per highlight.
   * @default 5
   */
  numSentences?: number
  /**
   * Number of highlights per URL/result.
   * @default 3
   */
  highlightsPerUrl?: number
  /**
   * Enable AI-generated summaries.
   * Useful for quick understanding without reading full text.
   */
  useSummary?: boolean
  /**
   * Custom query for generating summaries.
   * Guides the AI on what aspects to summarize.
   */
  summaryQuery?: string
  /**
   * Maximum characters for text content per result.
   * @default 3000
   */
  maxCharacters?: number
}

// ============================================================================
// Search Function
// ============================================================================

/**
 * Perform a search using the EXA API
 *
 * Implements retry logic with exponential backoff for retryable errors
 * (429, 500, 502, 503).
 *
 * @param input - Search parameters
 * @param retryConfig - Optional retry configuration
 * @returns Search result with query and results array
 *
 * @see https://docs.exa.ai/reference/error-codes
 *
 * @example
 * ```ts
 * const result = await exaSearch({
 *   query: 'latest developments in AI',
 *   category: 'news',
 *   numResults: 5,
 * })
 * ```
 */
export async function exaSearch(
  input: ExaSearchInput,
  retryConfig: RetryConfig = DEFAULT_EXA_RETRY_CONFIG,
): Promise<ExaSearchResult> {
  const client = getExaClient()

  if (!client) {
    return {
      type: 'exa_search',
      query: input.query,
      category: input.category,
      results: [],
      error: 'EXA API key is not configured. Please set EXA_API_KEY environment variable.',
    }
  }

  try {
    // Build search options following Exa best practices
    // @see https://docs.exa.ai/reference/contents-retrieval
    type SearchOptions = NonNullable<Parameters<typeof client.searchAndContents>[1]>

    // Determine livecrawl mode - 'preferred' is best for production (fresh + reliable)
    // @see https://docs.exa.ai/reference/livecrawling-contents
    const livecrawlMode = typeof input.livecrawl === 'string'
      ? input.livecrawl
      : input.livecrawl === true
        ? 'always'
        : 'preferred'

    // Use more results by default for better coverage (max 100 for neural/deep)
    // @see https://docs.exa.ai/reference/search#body-num-results
    const numResults = Math.min(Math.max(input.numResults ?? 10, 1), 100)

    const searchOptions: SearchOptions = {
      type: input.type ?? 'auto',
      numResults,
      livecrawl: livecrawlMode,
      // Text content options - more content for better LLM context
      // @see https://docs.exa.ai/reference/contents-retrieval
      text: {
        maxCharacters: input.maxCharacters ?? 3000,
        includeHtmlTags: false,
      },
      // Highlights - recommended for LLM context (more focused than full text)
      // Using more highlights per URL for richer context
      // @see https://docs.exa.ai/reference/contents-retrieval
      ...(input.useHighlights !== false && {
        highlights: {
          numSentences: input.numSentences ?? 5,
          highlightsPerUrl: input.highlightsPerUrl ?? 3,
          ...(input.highlightsQuery && { query: input.highlightsQuery }),
        },
      }),
      // AI-generated summaries
      // @see https://docs.exa.ai/reference/contents-retrieval
      ...(input.useSummary && {
        summary: {
          ...(input.summaryQuery && { query: input.summaryQuery }),
        },
      }),
      // Context string for LLMs (combines all results into one string)
      // @see https://docs.exa.ai/reference/search#body-context
      ...(input.useContext && {
        context: {
          maxCharacters: input.contextMaxCharacters ?? 10000,
        },
      }),
      // Category filter
      ...(input.category && { category: input.category }),
      // Date filters - published date
      ...(input.startPublishedDate && { startPublishedDate: input.startPublishedDate }),
      ...(input.endPublishedDate && { endPublishedDate: input.endPublishedDate }),
      // Date filters - crawl date (when Exa discovered the link)
      ...(input.startCrawlDate && { startCrawlDate: input.startCrawlDate }),
      ...(input.endCrawlDate && { endCrawlDate: input.endCrawlDate }),
      // Domain filters
      ...(input.includeDomains && input.includeDomains.length > 0 && { includeDomains: input.includeDomains }),
      ...(input.excludeDomains && input.excludeDomains.length > 0 && { excludeDomains: input.excludeDomains }),
      // Text filters
      ...(input.includeText && input.includeText.length > 0 && { includeText: input.includeText }),
      ...(input.excludeText && input.excludeText.length > 0 && { excludeText: input.excludeText }),
      // Additional queries for deep search
      ...(input.additionalQueries && input.additionalQueries.length > 0 && { additionalQueries: input.additionalQueries }),
      // User location for localized results
      ...(input.userLocation && { userLocation: input.userLocation }),
    }

    // Execute search with contents and retry logic
    // @see https://docs.exa.ai/reference/error-codes
    const response = await retryWithBackoff(
      () => client.searchAndContents(input.query, searchOptions),
      retryConfig,
    )

    // Transform results to our format including highlights and summaries
    // @see https://docs.exa.ai/reference/contents-retrieval
    const results: ExaSearchResultItem[] = response.results.map((result) => {
      // Type assertion needed because searchAndContents adds content fields to results
      const resultWithContent = result as typeof result & {
        text?: string
        highlights?: string[]
        highlightScores?: number[]
        summary?: string
      }
      return {
        url: result.url,
        title: result.title ?? 'Untitled',
        author: result.author ?? undefined,
        publishedDate: result.publishedDate ?? undefined,
        text: resultWithContent.text ?? undefined,
        highlights: resultWithContent.highlights ?? undefined,
        highlightScores: resultWithContent.highlightScores ?? undefined,
        summary: resultWithContent.summary ?? undefined,
        score: result.score ?? undefined,
      }
    })

    return {
      type: 'exa_search',
      query: input.query,
      category: input.category,
      results,
    }
  } catch (error) {
    // Parse error with Exa-specific error handling
    // @see https://docs.exa.ai/reference/error-codes
    const exaError = parseExaError(error)
    logExaError('exa.search', error, exaError)

    return {
      type: 'exa_search',
      query: input.query,
      category: input.category,
      results: [],
      error: exaError.message,
      errorInfo: toExaErrorInfo(exaError),
    }
  }
}

// ============================================================================
// Result Formatting
// ============================================================================

/**
 * Format EXA search results as a string for the LLM.
 *
 * Prioritizes content in this order (following Exa best practices):
 * 1. Highlights - most focused and relevant excerpts
 * 2. Summary - AI-generated overview
 * 3. Text - full content snippet
 *
 * @see https://docs.exa.ai/reference/contents-retrieval
 */
export function formatExaResultsForLLM(result: ExaSearchResult): string {
  if (result.error) {
    return `EXA Search Error: ${result.error}`
  }

  if (result.results.length === 0) {
    return `No results found for query: "${result.query}"`
  }

  const lines: string[] = [
    `═══════════════════════════════════════════════════════════`,
    `EXA SEARCH RESULTS`,
    `Query: "${result.query}"`,
    result.category ? `Category: ${result.category}` : '',
    `Found ${result.results.length} result(s)`,
    `═══════════════════════════════════════════════════════════`,
    '',
  ].filter(Boolean)

  result.results.forEach((item, index) => {
    lines.push(`┌─ Result ${index + 1}/${result.results.length} ─────────────────────────────────`)
    lines.push(`│ Title: ${item.title}`)
    lines.push(`│ URL: ${item.url}`)

    if (item.author) {
      lines.push(`│ Author: ${item.author}`)
    }
    if (item.publishedDate) {
      // Format date nicely if it's ISO format
      try {
        const date = new Date(item.publishedDate)
        lines.push(`│ Published: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)
      } catch {
        lines.push(`│ Published: ${item.publishedDate}`)
      }
    }
    if (item.score !== undefined) {
      lines.push(`│ Relevance Score: ${(item.score * 100).toFixed(1)}%`)
    }
    lines.push('│')

    // Prioritize highlights - most focused content for LLMs
    if (item.highlights && item.highlights.length > 0) {
      lines.push('│ KEY HIGHLIGHTS:')
      item.highlights.forEach((highlight, i) => {
        const score = item.highlightScores?.[i]
        const scoreStr = score !== undefined ? ` [${(score * 100).toFixed(0)}% match]` : ''
        lines.push(`│   ${i + 1}. ${highlight}${scoreStr}`)
      })
      lines.push('│')
    }

    // Show summary if available - provides quick understanding
    if (item.summary) {
      lines.push(`│ AI SUMMARY:`)
      lines.push(`│   ${item.summary}`)
      lines.push('│')
    }

    // Fall back to text content if no highlights/summary
    if (item.text && !item.highlights?.length && !item.summary) {
      lines.push(`│ CONTENT:`)
      // Wrap text for readability
      const wrappedText = item.text.substring(0, 2000) + (item.text.length > 2000 ? '...' : '')
      lines.push(`│   ${wrappedText}`)
      lines.push('│')
    }
    // Also show text if it provides additional context beyond highlights
    else if (item.text && (item.highlights?.length || item.summary)) {
      lines.push(`│ FULL CONTENT:`)
      const wrappedText = item.text.substring(0, 2000) + (item.text.length > 2000 ? '...' : '')
      lines.push(`│   ${wrappedText}`)
      lines.push('│')
    }

    lines.push(`└───────────────────────────────────────────────────────────`)
    lines.push('')
  })

  lines.push(`═══════════════════════════════════════════════════════════`)
  lines.push(`END OF ${result.results.length} SEARCH RESULTS`)
  lines.push(`═══════════════════════════════════════════════════════════`)

  return lines.join('\n')
}

