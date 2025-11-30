/**
 * EXA Web Search Tool
 *
 * Provides semantic/neural web search capabilities using the EXA API.
 * EXA offers advanced features like category filtering, date ranges,
 * domain restrictions, and livecrawling for fresh content.
 *
 * @see https://docs.exa.ai/reference/search
 * @see https://docs.exa.ai/reference/contents-retrieval
 * @see https://docs.exa.ai/reference/error-codes
 *
 * @module lib/tools/exa
 */

import Exa from 'exa-js'
import { env } from '@/lib/config/env'
import type { 
  ExaSearchCategory, 
  ExaSearchType, 
  ExaSearchResultItem, 
  ExaSearchResult,
  ExaResearchModel,
  ExaResearchResult,
  ExaResearchCitation,
} from '@/lib/types'
import {
  parseExaError,
  toExaErrorInfo,
  retryWithBackoff,
  logExaError,
  type RetryConfig,
} from './exa-errors'

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
 * Default retry configuration for EXA API calls
 * @see https://docs.exa.ai/reference/error-codes
 */
const DEFAULT_EXA_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
}

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

// ============================================================================
// Answer Function (Direct Question Answering)
// @see https://docs.exa.ai/reference/answer
// ============================================================================

/**
 * Input parameters for EXA answer
 */
export type ExaAnswerInput = {
  /** The question to answer */
  question: string
  /** Include full text from sources */
  includeText?: boolean
  /** Category filter for sources */
  category?: ExaSearchCategory
}

/**
 * Result from EXA answer
 */
export type ExaAnswerResult = {
  type: 'exa_answer'
  question: string
  answer: string
  sources: ExaSearchResultItem[]
  error?: string
  errorInfo?: import('@/lib/tools/exa-errors').ExaErrorInfo
}

/**
 * Get a direct answer to a question using EXA's answer endpoint.
 * EXA searches the web and synthesizes an answer with sources.
 *
 * Implements retry logic with exponential backoff for retryable errors.
 *
 * @see https://docs.exa.ai/reference/answer
 * @see https://docs.exa.ai/reference/error-codes
 */
export async function exaAnswer(
  input: ExaAnswerInput,
  retryConfig: RetryConfig = DEFAULT_EXA_RETRY_CONFIG,
): Promise<ExaAnswerResult> {
  const client = getExaClient()

  if (!client) {
    return {
      type: 'exa_answer',
      question: input.question,
      answer: '',
      sources: [],
      error: 'EXA API key is not configured. Please set EXA_API_KEY environment variable.',
    }
  }

  try {
    // Execute answer with retry logic
    // @see https://docs.exa.ai/reference/error-codes
    const response = await retryWithBackoff(
      () => client.answer(input.question, {
        text: input.includeText ?? true,
        ...(input.category && { category: input.category }),
      }),
      retryConfig,
    )

    // Extract sources from the response
    // Type assertion needed as the SDK types may not include all fields
    type CitationWithText = { url: string; title: string | null; text?: string }
    const citations = (response.citations ?? []) as CitationWithText[]
    
    const sources: ExaSearchResultItem[] = citations.map((citation) => ({
      url: citation.url,
      title: citation.title ?? 'Untitled',
      text: citation.text ?? undefined,
    }))

    // The answer can be a string or object depending on the response
    const answerText = typeof response.answer === 'string' 
      ? response.answer 
      : JSON.stringify(response.answer)

    return {
      type: 'exa_answer',
      question: input.question,
      answer: answerText,
      sources,
    }
  } catch (error) {
    // Parse error with Exa-specific error handling
    // @see https://docs.exa.ai/reference/error-codes
    const exaError = parseExaError(error)
    logExaError('exa.answer', error, exaError)

    return {
      type: 'exa_answer',
      question: input.question,
      answer: '',
      sources: [],
      error: exaError.message,
      errorInfo: toExaErrorInfo(exaError),
    }
  }
}

/**
 * Format EXA answer result as a string for the LLM
 */
export function formatExaAnswerForLLM(result: ExaAnswerResult): string {
  if (result.error) {
    return `EXA Answer Error: ${result.error}`
  }

  const lines: string[] = [
    `Question: "${result.question}"`,
    '',
    `Answer: ${result.answer}`,
    '',
  ]

  if (result.sources.length > 0) {
    lines.push(`Sources (${result.sources.length}):`)
    result.sources.forEach((source, i) => {
      lines.push(`  ${i + 1}. ${source.title} - ${source.url}`)
    })
  }

  return lines.join('\n')
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

// ============================================================================
// Research Function (Deep Web Research with Structured Output)
// @see https://docs.exa.ai/reference/exa-research
// ============================================================================

/**
 * Input parameters for EXA research
 * @see https://docs.exa.ai/reference/exa-research
 */
export type ExaResearchInput = {
  /**
   * Natural-language instructions describing what to research.
   * Be explicit: describe (1) what information you want, (2) how to find it, 
   * and (3) how to compose the final report.
   * Maximum 4096 characters.
   * 
   * @example "Compare the current flagship GPUs from NVIDIA, AMD and Intel. Return a table of model name, MSRP USD, TDP watts, and launch date."
   */
  instructions: string
  
  /**
   * JSON Schema describing the desired output structure.
   * Keep schemas small (1-5 root fields) for best results.
   * Use enums to improve accuracy and reduce hallucinations.
   * Must have ≤ 8 root fields and not be more than 5 fields deep.
   * 
   * If not provided, returns a detailed markdown report.
   */
  outputSchema?: Record<string, unknown>
  
  /**
   * Research model to use.
   * - 'exa-research' (default): Adapts to task difficulty, recommended for most use cases
   * - 'exa-research-pro': Maximum quality for complex multi-step tasks
   * 
   * @default 'exa-research'
   */
  model?: ExaResearchModel
  
  /**
   * Maximum time to wait for research completion in milliseconds.
   * Research tasks typically complete in 20-90 seconds.
   * 
   * @default 120000 (2 minutes)
   */
  timeoutMs?: number
  
  /**
   * Polling interval in milliseconds.
   * @default 2000 (2 seconds)
   */
  pollIntervalMs?: number
}

/**
 * Perform deep web research using the EXA Research API.
 * 
 * The Research API is an asynchronous, multi-step pipeline that:
 * 1. Plans - Parses instructions into research steps
 * 2. Searches - Issues semantic queries, expanding and refining results
 * 3. Synthesizes - Combines facts across sources into structured output
 *
 * Implements retry logic with exponential backoff for retryable errors
 * during the initial create call. Polling errors are handled separately.
 * 
 * @param input - Research parameters
 * @param retryConfig - Optional retry configuration for the create call
 * @returns Research result with structured output or markdown report
 * 
 * @see https://docs.exa.ai/reference/exa-research
 * @see https://docs.exa.ai/reference/error-codes
 * 
 * @example
 * ```ts
 * // Basic research with markdown output
 * const result = await exaResearch({
 *   instructions: 'What are the latest developments in AI agents?',
 * })
 * 
 * // Research with structured output
 * const structuredResult = await exaResearch({
 *   instructions: 'Compare flagship GPUs from NVIDIA, AMD and Intel',
 *   outputSchema: {
 *     type: 'object',
 *     required: ['gpus'],
 *     properties: {
 *       gpus: {
 *         type: 'array',
 *         items: {
 *           type: 'object',
 *           required: ['manufacturer', 'model', 'msrpUsd'],
 *           properties: {
 *             manufacturer: { type: 'string' },
 *             model: { type: 'string' },
 *             msrpUsd: { type: 'number' },
 *           }
 *         }
 *       }
 *     },
 *     additionalProperties: false
 *   },
 *   model: 'exa-research-pro',
 * })
 * ```
 */
export async function exaResearch(
  input: ExaResearchInput,
  retryConfig: RetryConfig = DEFAULT_EXA_RETRY_CONFIG,
): Promise<ExaResearchResult> {
  const client = getExaClient()
  const model = input.model ?? 'exa-research'
  
  if (!client) {
    return {
      type: 'exa_research',
      researchId: '',
      instructions: input.instructions,
      model,
      status: 'failed',
      error: 'EXA API key is not configured. Please set EXA_API_KEY environment variable.',
    }
  }
  
  try {
    // Access the research API through the client
    // The exa-js SDK provides research.create() and research.pollUntilFinished()
    const researchApi = client.research as {
      create: (params: {
        model: string
        instructions: string
        outputSchema?: Record<string, unknown>
      }) => Promise<{ researchId: string }>
      pollUntilFinished: (researchId: string, options?: {
        timeoutMs?: number
        pollIntervalMs?: number
      }) => Promise<{
        researchId: string
        status: string
        output?: unknown
        citations?: Array<{ url: string; title?: string; excerpt?: string }>
        cost?: {
          searches?: number
          pagesRead?: number
          reasoningTokens?: number
          totalUsd?: number
        }
        error?: string
      }>
    }
    
    // Create the research task with retry logic
    // @see https://docs.exa.ai/reference/error-codes
    const createParams: {
      model: string
      instructions: string
      outputSchema?: Record<string, unknown>
    } = {
      model,
      instructions: input.instructions,
    }
    
    if (input.outputSchema) {
      createParams.outputSchema = input.outputSchema
    }
    
    const researchTask = await retryWithBackoff(
      () => researchApi.create(createParams),
      retryConfig,
    )
    
    // Poll until completion - polling has its own timeout handling
    // Retry logic for polling is handled internally by pollUntilFinished
    const result = await researchApi.pollUntilFinished(researchTask.researchId, {
      timeoutMs: input.timeoutMs ?? 120000,
      pollIntervalMs: input.pollIntervalMs ?? 2000,
    })
    
    // Map the status
    const status = result.status === 'completed' ? 'completed' 
      : result.status === 'failed' ? 'failed'
      : result.status === 'running' ? 'running'
      : 'pending'
    
    // Transform citations
    const citations: ExaResearchCitation[] = (result.citations ?? []).map((c) => ({
      url: c.url,
      title: c.title,
      excerpt: c.excerpt,
    }))
    
    // If the research task itself reported an error, parse it
    if (result.error) {
      return {
        type: 'exa_research',
        researchId: result.researchId,
        instructions: input.instructions,
        model,
        status: 'failed',
        output: result.output,
        citations: citations.length > 0 ? citations : undefined,
        cost: result.cost,
        error: result.error,
      }
    }
    
    return {
      type: 'exa_research',
      researchId: result.researchId,
      instructions: input.instructions,
      model,
      status: status as ExaResearchResult['status'],
      output: result.output,
      citations: citations.length > 0 ? citations : undefined,
      cost: result.cost,
    }
  } catch (error) {
    // Parse error with Exa-specific error handling
    // @see https://docs.exa.ai/reference/error-codes
    const exaError = parseExaError(error)
    logExaError('exa.research', error, exaError)
    
    return {
      type: 'exa_research',
      researchId: '',
      instructions: input.instructions,
      model,
      status: 'failed',
      error: exaError.message,
      errorInfo: toExaErrorInfo(exaError),
    }
  }
}

/**
 * Format EXA research result as a string for the LLM
 */
export function formatExaResearchForLLM(result: ExaResearchResult): string {
  if (result.error) {
    return `EXA Research Error: ${result.error}`
  }
  
  if (result.status !== 'completed') {
    return `EXA Research Status: ${result.status} (Research ID: ${result.researchId})`
  }
  
  const lines: string[] = [
    `EXA Research Results`,
    `Instructions: "${result.instructions}"`,
    `Model: ${result.model}`,
    '',
  ]
  
  // Format the output
  if (result.output !== undefined) {
    if (typeof result.output === 'string') {
      lines.push('Research Output:')
      lines.push(result.output)
    } else {
      lines.push('Research Output (Structured):')
      lines.push(JSON.stringify(result.output, null, 2))
    }
    lines.push('')
  }
  
  // Add citations
  if (result.citations && result.citations.length > 0) {
    lines.push(`Sources (${result.citations.length}):`)
    result.citations.forEach((citation, i) => {
      lines.push(`  ${i + 1}. ${citation.title ?? 'Untitled'} - ${citation.url}`)
      if (citation.excerpt) {
        lines.push(`     "${citation.excerpt}"`)
      }
    })
    lines.push('')
  }
  
  // Add cost information if available
  if (result.cost) {
    lines.push('Cost Breakdown:')
    if (result.cost.searches !== undefined) {
      lines.push(`  Searches: ${result.cost.searches}`)
    }
    if (result.cost.pagesRead !== undefined) {
      lines.push(`  Pages Read: ${result.cost.pagesRead}`)
    }
    if (result.cost.reasoningTokens !== undefined) {
      lines.push(`  Reasoning Tokens: ${result.cost.reasoningTokens}`)
    }
    if (result.cost.totalUsd !== undefined) {
      lines.push(`  Total Cost: $${result.cost.totalUsd.toFixed(4)}`)
    }
  }
  
  return lines.join('\n')
}

