import type {
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
} from '../exa-errors'
import { getExaClient, DEFAULT_EXA_RETRY_CONFIG } from './client'

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

