/**
 * Tokenizer Utility
 *
 * Provides accurate token counting for OpenAI models using the gpt-tokenizer library.
 * This replaces the inaccurate character-based estimation with proper BPE tokenization.
 *
 * @see https://github.com/niieani/gpt-tokenizer
 * @see https://platform.openai.com/tokenizer
 */

import {
  encode,
  decode,
  encodeChat,
  isWithinTokenLimit,
} from 'gpt-tokenizer'

// =============================================================================
// Types
// =============================================================================

export type TokenCountResult = {
  /** Total number of tokens */
  tokens: number
  /** Estimated cost in USD (based on the pricing table below) */
  estimatedCost?: number
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

// =============================================================================
// Token Pricing (USD per 1K tokens)
// =============================================================================

const TOKEN_PRICING = {
  // GPT-5.2 pricing (estimated/placeholder)
  'gpt-5.2-2025-12-11': { input: 0.01, output: 0.03 },
} as const

type ModelId = keyof typeof TOKEN_PRICING

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Count tokens in a string
 *
 * @param text - The text to tokenize
 * @returns Number of tokens
 *
 * @example
 * const count = countTokens("Hello, world!")
 * console.log(count) // 4
 */
export function countTokens(text: string): number {
  if (!text) return 0
  return encode(text).length
}

/**
 * Count tokens in a string with cost estimation
 *
 * @param text - The text to tokenize
 * @param model - The model to use for pricing (default: gpt-5.2-2025-12-11)
 * @param type - Whether this is input or output tokens
 * @returns Token count and estimated cost
 *
 * @example
 * const result = countTokensWithCost("Hello!", "gpt-5.2-2025-12-11", "input")
 * console.log(result) // { tokens: 2, estimatedCost: 0.00001 }
 */
export function countTokensWithCost(
  text: string,
  model: string = 'gpt-5.2-2025-12-11',
  type: 'input' | 'output' = 'input'
): TokenCountResult {
  const tokens = countTokens(text)

  // Find pricing for model
  const modelKey = Object.keys(TOKEN_PRICING).find(
    (key) => model.startsWith(key) || model.includes(key)
  ) as ModelId | undefined

  if (modelKey) {
    const pricing = TOKEN_PRICING[modelKey]
    const rate = type === 'input' ? pricing.input : pricing.output
    const estimatedCost = (tokens / 1000) * rate
    return { tokens, estimatedCost }
  }

  return { tokens }
}

/**
 * Count tokens for a chat conversation (includes message overhead)
 *
 * @param messages - Array of chat messages
 * @returns Total token count including message formatting overhead
 *
 * @example
 * const messages = [
 *   { role: 'system', content: 'You are helpful.' },
 *   { role: 'user', content: 'Hello!' }
 * ]
 * const count = countChatTokens(messages)
 */
export function countChatTokens(messages: ChatMessage[]): number {
  if (!messages || messages.length === 0) return 0

  try {
    // encodeChat handles the message formatting overhead
    return encodeChat(messages).length
  } catch {
    // Fallback: sum individual messages + overhead
    // Each message has ~4 tokens overhead for role/formatting
    const MESSAGE_OVERHEAD = 4
    const CONVERSATION_OVERHEAD = 3 // Priming tokens

    return (
      messages.reduce((sum, msg) => {
        return sum + countTokens(msg.content) + MESSAGE_OVERHEAD
      }, 0) + CONVERSATION_OVERHEAD
    )
  }
}

/**
 * Check if text is within a token limit
 *
 * @param text - The text to check
 * @param limit - Maximum token count
 * @returns True if within limit, false otherwise
 *
 * @example
 * if (isWithinLimit("Hello!", 100)) {
 *   // Safe to send
 * }
 */
export function isWithinLimit(text: string, limit: number): boolean {
  // isWithinTokenLimit returns the token count if within limit, or false if exceeded
  const result = isWithinTokenLimit(text, limit)
  return result !== false
}

/**
 * Truncate text to fit within a token limit
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum token count
 * @param ellipsis - Text to append when truncated (default: "...")
 * @returns Truncated text
 *
 * @example
 * const truncated = truncateToTokenLimit(longText, 1000)
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  ellipsis: string = '...'
): string {
  if (!text) return ''

  const tokens = encode(text)
  if (tokens.length <= maxTokens) {
    return text
  }

  // Reserve tokens for ellipsis
  const ellipsisTokens = encode(ellipsis).length
  const targetTokens = maxTokens - ellipsisTokens

  if (targetTokens <= 0) {
    return ellipsis
  }

  // Truncate tokens and decode
  const truncatedTokens = tokens.slice(0, targetTokens)
  const truncatedText = decode(truncatedTokens)

  return truncatedText + ellipsis
}

/**
 * Encode text to token IDs
 *
 * @param text - The text to encode
 * @returns Array of token IDs
 *
 * @example
 * const tokens = encodeText("Hello!")
 * console.log(tokens) // [15496, 0]
 */
export function encodeText(text: string): number[] {
  return encode(text)
}

/**
 * Decode token IDs back to text
 *
 * @param tokens - Array of token IDs
 * @returns Decoded text
 *
 * @example
 * const text = decodeTokens([15496, 0])
 * console.log(text) // "Hello!"
 */
export function decodeTokens(tokens: number[]): string {
  return decode(tokens)
}

// =============================================================================
// Context Window Management
// =============================================================================

const MODEL_CONTEXT_WINDOWS = {
  'gpt-5.2-2025-12-11': 256000,
} as const

/**
 * Get the context window size for a model
 *
 * @param model - Model identifier
 * @returns Context window size in tokens
 */
export function getContextWindowSize(model: string): number {
  const modelKey = Object.keys(MODEL_CONTEXT_WINDOWS).find(
    (key) => model.startsWith(key) || model.includes(key)
  ) as keyof typeof MODEL_CONTEXT_WINDOWS | undefined

  return modelKey ? MODEL_CONTEXT_WINDOWS[modelKey] : 128000 // Default to 128k
}

/**
 * Calculate remaining context space
 *
 * @param usedTokens - Tokens already used
 * @param model - Model identifier
 * @param reserveForOutput - Tokens to reserve for output (default: 4096)
 * @returns Available tokens for new content
 */
export function getRemainingContextSpace(
  usedTokens: number,
  model: string,
  reserveForOutput: number = 4096
): number {
  const windowSize = getContextWindowSize(model)
  return Math.max(0, windowSize - usedTokens - reserveForOutput)
}

// =============================================================================
// Prompt Estimation Utilities
// =============================================================================

/**
 * Estimate tokens for system prompt (useful for cache efficiency monitoring)
 *
 * @param systemPrompt - The system prompt text
 * @returns Token count and percentage of typical context
 */
export function estimateSystemPromptTokens(systemPrompt: string): {
  tokens: number
  percentageOf128k: number
  percentageOf256k: number
} {
  const tokens = countTokens(systemPrompt)
  return {
    tokens,
    percentageOf128k: (tokens / 128000) * 100,
    percentageOf256k: (tokens / 256000) * 100,
  }
}

/**
 * Legacy compatibility: character-based estimation (deprecated)
 *
 * @deprecated Use countTokens() for accurate token counting
 */
export function estimateTokensFromChars(charCount: number): number {
  // Rough estimate: ~4 chars per token (very inaccurate)
  return Math.ceil(charCount / 4)
}

