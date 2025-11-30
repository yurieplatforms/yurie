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

