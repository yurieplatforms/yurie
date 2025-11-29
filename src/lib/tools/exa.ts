/**
 * EXA Web Search Tool
 *
 * Provides semantic/neural web search capabilities using the EXA API.
 * EXA offers advanced features like category filtering, date ranges,
 * domain restrictions, and livecrawling for fresh content.
 *
 * @see https://docs.exa.ai/reference/search
 * @see https://docs.exa.ai/reference/contents-retrieval
 *
 * @module lib/tools/exa
 */

import Exa from 'exa-js'
import { env } from '@/lib/config/env'
import type { ExaSearchCategory, ExaSearchResultItem, ExaSearchResult } from '@/lib/types'

// ============================================================================
// EXA Client
// ============================================================================

/**
 * Lazily initialized EXA client.
 * Returns null if EXA_API_KEY is not configured.
 */
let exaClient: Exa | null = null

function getExaClient(): Exa | null {
  if (!env.EXA_API_KEY) {
    return null
  }

  if (!exaClient) {
    exaClient = new Exa(env.EXA_API_KEY)
  }

  return exaClient
}

/**
 * Check if EXA is available (API key is configured)
 */
export function isExaAvailable(): boolean {
  return Boolean(env.EXA_API_KEY)
}

// ============================================================================
// Search Input Types
// ============================================================================

/**
 * Input parameters for EXA search
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
  /** Search type: 'auto' (default), 'neural', or 'keyword' */
  type?: 'auto' | 'neural' | 'keyword'
  /** Whether to use livecrawling for fresh content */
  livecrawl?: boolean
}

// ============================================================================
// Search Function
// ============================================================================

/**
 * Perform a search using the EXA API
 *
 * @param input - Search parameters
 * @returns Search result with query and results array
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
export async function exaSearch(input: ExaSearchInput): Promise<ExaSearchResult> {
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
    // Build search options
    const searchOptions: Parameters<typeof client.searchAndContents>[1] = {
      type: input.type ?? 'auto',
      numResults: Math.min(Math.max(input.numResults ?? 5, 1), 10),
      // Content options - get text for each result
      text: {
        maxCharacters: 1000,
        includeHtmlTags: false,
      },
      // Enable livecrawl for fresh content when requested
      livecrawl: input.livecrawl ? 'preferred' : 'fallback',
    }

    // Add category filter if specified
    if (input.category) {
      searchOptions.category = input.category
    }

    // Add date filters if specified
    if (input.startPublishedDate) {
      searchOptions.startPublishedDate = input.startPublishedDate
    }
    if (input.endPublishedDate) {
      searchOptions.endPublishedDate = input.endPublishedDate
    }

    // Add domain filters if specified
    if (input.includeDomains && input.includeDomains.length > 0) {
      searchOptions.includeDomains = input.includeDomains
    }
    if (input.excludeDomains && input.excludeDomains.length > 0) {
      searchOptions.excludeDomains = input.excludeDomains
    }

    // Execute search with contents
    const response = await client.searchAndContents(input.query, searchOptions)

    // Transform results to our format
    // The response includes text content since we requested it via the text option
    const results: ExaSearchResultItem[] = response.results.map((result) => {
      // Type assertion needed because searchAndContents adds text to results
      const resultWithText = result as typeof result & { text?: string }
      return {
        url: result.url,
        title: result.title ?? 'Untitled',
        author: result.author ?? undefined,
        publishedDate: result.publishedDate ?? undefined,
        text: resultWithText.text ?? undefined,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('[exa] Search error:', errorMessage)

    return {
      type: 'exa_search',
      query: input.query,
      category: input.category,
      results: [],
      error: errorMessage,
    }
  }
}

/**
 * Format EXA search results as a string for the LLM
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
    if (item.text) {
      lines.push(`Content: ${item.text}`)
    }
    lines.push('')
  })

  return lines.join('\n')
}

