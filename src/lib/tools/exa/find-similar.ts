import type {
  ExaSearchCategory,
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
// Find Similar Function
// @see https://docs.exa.ai/reference/find-similar-links
// ============================================================================

/**
 * Input parameters for finding similar content
 */
export type ExaFindSimilarInput = {
  /** URL to find similar content for */
  url: string
  /**
   * Number of similar results to return.
   * - Default: 10
   * - Maximum: 100
   */
  numResults?: number
  /** Exclude the source domain from results (default: true) */
  excludeSourceDomain?: boolean
  /** Only include results from these domains */
  includeDomains?: string[]
  /** Exclude results from these domains */
  excludeDomains?: string[]
  /**
   * Livecrawl mode for content freshness.
   * - 'always': Always fetch fresh content
   * - 'preferred': Prefer live crawling, falls back on failure (default)
   * - 'fallback': Use cache first
   * - 'never': Only use cached content (fastest)
   */
  livecrawl?: ExaLivecrawlMode | boolean
  /** Enable highlights for focused context (default: true) */
  useHighlights?: boolean
  /** Number of highlights per URL (default: 3) */
  highlightsPerUrl?: number
  /** Number of sentences per highlight (default: 5) */
  numSentences?: number
  /** Enable AI summaries */
  useSummary?: boolean
  /** Maximum characters for text content (default: 3000) */
  maxCharacters?: number
  /** Category filter */
  category?: ExaSearchCategory
  /** Only include results published after this date (ISO 8601) */
  startPublishedDate?: string
  /** Only include results published before this date (ISO 8601) */
  endPublishedDate?: string
}

/**
 * Find similar content to a given URL using EXA API.
 * Great for discovering related articles, research, or competitors.
 *
 * Implements retry logic with exponential backoff for retryable errors.
 *
 * @see https://docs.exa.ai/reference/find-similar-links
 * @see https://docs.exa.ai/reference/error-codes
 */
export async function exaFindSimilar(
  input: ExaFindSimilarInput,
  retryConfig: RetryConfig = DEFAULT_EXA_RETRY_CONFIG,
): Promise<ExaSearchResult> {
  const client = getExaClient()

  if (!client) {
    return {
      type: 'exa_search',
      query: `Similar to: ${input.url}`,
      results: [],
      error: 'EXA API key is not configured. Please set EXA_API_KEY environment variable.',
    }
  }

  try {
    type SimilarOptions = NonNullable<Parameters<typeof client.findSimilarAndContents>[1]>
    
    // Determine livecrawl mode - 'preferred' for production reliability
    const livecrawlMode = typeof input.livecrawl === 'string'
      ? input.livecrawl
      : input.livecrawl === true
        ? 'always'
        : 'preferred'

    // More results by default for better coverage
    const numResults = Math.min(Math.max(input.numResults ?? 10, 1), 100)

    const options: SimilarOptions = {
      numResults,
      excludeSourceDomain: input.excludeSourceDomain ?? true,
      livecrawl: livecrawlMode,
      // More content for better LLM context
      text: {
        maxCharacters: input.maxCharacters ?? 3000,
        includeHtmlTags: false,
      },
      // More highlights for richer context
      ...(input.useHighlights !== false && {
        highlights: {
          numSentences: input.numSentences ?? 5,
          highlightsPerUrl: input.highlightsPerUrl ?? 3,
        },
      }),
      ...(input.useSummary && { summary: {} }),
      ...(input.includeDomains && input.includeDomains.length > 0 && { includeDomains: input.includeDomains }),
      ...(input.excludeDomains && input.excludeDomains.length > 0 && { excludeDomains: input.excludeDomains }),
      ...(input.category && { category: input.category }),
      // Date filters
      ...(input.startPublishedDate && { startPublishedDate: input.startPublishedDate }),
      ...(input.endPublishedDate && { endPublishedDate: input.endPublishedDate }),
    }

    // Execute find similar with retry logic
    // @see https://docs.exa.ai/reference/error-codes
    const response = await retryWithBackoff(
      () => client.findSimilarAndContents(input.url, options),
      retryConfig,
    )

    const results: ExaSearchResultItem[] = response.results.map((result) => {
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
      query: `Similar to: ${input.url}`,
      results,
    }
  } catch (error) {
    // Parse error with Exa-specific error handling
    // @see https://docs.exa.ai/reference/error-codes
    const exaError = parseExaError(error)
    logExaError('exa.findSimilar', error, exaError)

    return {
      type: 'exa_search',
      query: `Similar to: ${input.url}`,
      results: [],
      error: exaError.message,
      errorInfo: toExaErrorInfo(exaError),
    }
  }
}

