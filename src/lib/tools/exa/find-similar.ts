import type {
  ExaSearchCategory,
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
  /** Number of similar results to return (1-10, default: 5) */
  numResults?: number
  /** Exclude the source domain from results */
  excludeSourceDomain?: boolean
  /** Only include results from these domains */
  includeDomains?: string[]
  /** Exclude results from these domains */
  excludeDomains?: string[]
  /** Enable highlights for focused context */
  useHighlights?: boolean
  /** Enable AI summaries */
  useSummary?: boolean
  /** Maximum characters for text content */
  maxCharacters?: number
  /** Category filter */
  category?: ExaSearchCategory
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
    
    const options: SimilarOptions = {
      numResults: Math.min(Math.max(input.numResults ?? 5, 1), 10),
      excludeSourceDomain: input.excludeSourceDomain ?? true,
      text: {
        maxCharacters: input.maxCharacters ?? 1000,
        includeHtmlTags: false,
      },
      ...(input.useHighlights !== false && {
        highlights: {
          numSentences: 3,
          highlightsPerUrl: 1,
        },
      }),
      ...(input.useSummary && { summary: {} }),
      ...(input.includeDomains && input.includeDomains.length > 0 && { includeDomains: input.includeDomains }),
      ...(input.excludeDomains && input.excludeDomains.length > 0 && { excludeDomains: input.excludeDomains }),
      ...(input.category && { category: input.category }),
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

