import type {
  ExaSearchCategory,
  ExaSearchResultItem,
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
// Answer Function (Direct Question Answering)
// @see https://docs.exa.ai/reference/answer
// ============================================================================

/**
 * Input parameters for EXA answer
 */
export type ExaAnswerInput = {
  /** The question to answer */
  question: string
  /** Include full text from sources (default: true) */
  includeText?: boolean
  /** Category filter for sources */
  category?: ExaSearchCategory
  /** Only include sources published after this date (ISO 8601) */
  startPublishedDate?: string
  /** Only include sources published before this date (ISO 8601) */
  endPublishedDate?: string
  /** Only include sources from these domains */
  includeDomains?: string[]
  /** Exclude sources from these domains */
  excludeDomains?: string[]
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
  errorInfo?: import('../exa-errors').ExaErrorInfo
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
    // Build answer options
    type AnswerOptions = NonNullable<Parameters<typeof client.answer>[1]>
    
    const answerOptions: AnswerOptions = {
      text: input.includeText ?? true,
      ...(input.category && { category: input.category }),
      ...(input.startPublishedDate && { startPublishedDate: input.startPublishedDate }),
      ...(input.endPublishedDate && { endPublishedDate: input.endPublishedDate }),
      ...(input.includeDomains && input.includeDomains.length > 0 && { includeDomains: input.includeDomains }),
      ...(input.excludeDomains && input.excludeDomains.length > 0 && { excludeDomains: input.excludeDomains }),
    }

    // Execute answer with retry logic
    // @see https://docs.exa.ai/reference/error-codes
    const response = await retryWithBackoff(
      () => client.answer(input.question, answerOptions),
      retryConfig,
    )

    // Extract sources from the response
    // Type assertion needed as the SDK types may not include all fields
    type CitationWithText = { url: string; title: string | null; text?: string; publishedDate?: string }
    const citations = (response.citations ?? []) as CitationWithText[]
    
    const sources: ExaSearchResultItem[] = citations.map((citation) => ({
      url: citation.url,
      title: citation.title ?? 'Untitled',
      text: citation.text ?? undefined,
      publishedDate: citation.publishedDate ?? undefined,
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
    `═══════════════════════════════════════════════════════════`,
    `EXA ANSWER`,
    `═══════════════════════════════════════════════════════════`,
    '',
    `QUESTION: "${result.question}"`,
    '',
    `ANSWER:`,
    result.answer,
    '',
  ]

  if (result.sources.length > 0) {
    lines.push(`───────────────────────────────────────────────────────────`)
    lines.push(`SOURCES (${result.sources.length}):`)
    lines.push('')
    result.sources.forEach((source, i) => {
      lines.push(`${i + 1}. ${source.title}`)
      lines.push(`   URL: ${source.url}`)
      if (source.publishedDate) {
        try {
          const date = new Date(source.publishedDate)
          lines.push(`   Published: ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`)
        } catch {
          lines.push(`   Published: ${source.publishedDate}`)
        }
      }
      if (source.text) {
        const excerpt = source.text.substring(0, 500) + (source.text.length > 500 ? '...' : '')
        lines.push(`   Excerpt: ${excerpt}`)
      }
      lines.push('')
    })
  }

  lines.push(`═══════════════════════════════════════════════════════════`)

  return lines.join('\n')
}

