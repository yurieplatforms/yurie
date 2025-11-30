import type {
  ExaSearchCategory,
  ExaSearchType,
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
  /** Category to filter results (e.g., 'news', 'company', 'research paper') */
  category?: ExaSearchCategory
  /** Number of results to return (1-10, default: 5) */
  numResults?: number
  /** Only include results published after this date (ISO 8601) */
  startPublishedDate?: string
  /** Only include results published before this date (ISO 8601) */
  endPublishedDate?: string
  /** Only include results from these domains */
  includeDomains?: string[]
  /** Exclude results from these domains */
  excludeDomains?: string[]
  /**
   * Search type controlling search behavior.
   * - 'auto' (default): Intelligently combines multiple search methods
   * - 'neural': AI semantic search using embeddings
   * - 'keyword': Traditional keyword matching
   * - 'fast': Streamlined for speed (<400ms)
   * - 'deep': Comprehensive search with query expansion
   * @see https://docs.exa.ai/reference/how-exa-search-works
   */
  type?: ExaSearchType
  /**
   * Livecrawl mode for content freshness.
   * - 'always': Always fetch fresh content (slowest, freshest)
   * - 'preferred': Prefer live crawling, use cache as backup
   * - 'fallback': Use cache first, live crawl if unavailable (default)
   * - 'never': Only use cached content (fastest)
   * @see https://docs.exa.ai/reference/livecrawling-contents
   */
  livecrawl?: 'always' | 'preferred' | 'fallback' | 'never' | boolean

  // ============================================================================
  // Content Retrieval Options (Exa Best Practices)
  // @see https://docs.exa.ai/reference/contents-retrieval
  // ============================================================================

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
   * @default 3
   */
  numSentences?: number
  /**
   * Number of highlights per URL/result.
   * @default 1
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
   * Maximum characters for text content.
   * @default 1000
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

    // Determine livecrawl mode
    // @see https://docs.exa.ai/reference/livecrawling-contents
    const livecrawlMode = typeof input.livecrawl === 'string'
      ? input.livecrawl
      : input.livecrawl === true
        ? 'preferred'
        : 'fallback'

    const searchOptions: SearchOptions = {
      type: input.type ?? 'auto',
      numResults: Math.min(Math.max(input.numResults ?? 5, 1), 10),
      livecrawl: livecrawlMode,
      // Text content options
      // @see https://docs.exa.ai/reference/contents-retrieval
      text: {
        maxCharacters: input.maxCharacters ?? 1000,
        includeHtmlTags: false,
      },
      // Highlights - recommended for LLM context (more focused than full text)
      // @see https://docs.exa.ai/reference/contents-retrieval
      ...(input.useHighlights !== false && {
        highlights: {
          numSentences: input.numSentences ?? 3,
          highlightsPerUrl: input.highlightsPerUrl ?? 1,
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
      // Category filter
      ...(input.category && { category: input.category }),
      // Date filters
      ...(input.startPublishedDate && { startPublishedDate: input.startPublishedDate }),
      ...(input.endPublishedDate && { endPublishedDate: input.endPublishedDate }),
      // Domain filters
      ...(input.includeDomains && input.includeDomains.length > 0 && { includeDomains: input.includeDomains }),
      ...(input.excludeDomains && input.excludeDomains.length > 0 && { excludeDomains: input.excludeDomains }),
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
    `EXA Search Results for: "${result.query}"`,
    result.category ? `Category: ${result.category}` : '',
    `Found ${result.results.length} result(s):`,
    '',
  ].filter(Boolean)

  result.results.forEach((item, index) => {
    lines.push(`--- Result ${index + 1} ---`)
    lines.push(`Title: ${item.title}`)
    lines.push(`URL: ${item.url}`)

    if (item.author) {
      lines.push(`Author: ${item.author}`)
    }
    if (item.publishedDate) {
      lines.push(`Published: ${item.publishedDate}`)
    }
    if (item.score !== undefined) {
      lines.push(`Relevance: ${(item.score * 100).toFixed(1)}%`)
    }

    // Prioritize highlights - most focused content for LLMs
    if (item.highlights && item.highlights.length > 0) {
      lines.push('Key Highlights:')
      item.highlights.forEach((highlight, i) => {
        const score = item.highlightScores?.[i]
        const scoreStr = score !== undefined ? ` (${(score * 100).toFixed(0)}% match)` : ''
        lines.push(`  • ${highlight}${scoreStr}`)
      })
    }

    // Show summary if available - provides quick understanding
    if (item.summary) {
      lines.push(`Summary: ${item.summary}`)
    }

    // Fall back to text content if no highlights/summary
    if (item.text && !item.highlights?.length && !item.summary) {
      lines.push(`Content: ${item.text}`)
    }
    // Also show text if it provides additional context beyond highlights
    else if (item.text && item.highlights?.length) {
      lines.push(`Full Content: ${item.text}`)
    }

    lines.push('')
  })

  return lines.join('\n')
}

