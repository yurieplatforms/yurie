/**
 * Latency Optimization Utilities
 * 
 * Implements best practices for reducing API latency.
 * Reference: https://platform.openai.com/docs/guides/latency-optimization
 */

// =============================================================================
// Types
// =============================================================================

export interface LatencyConfig {
  /** Enable streaming responses (default: true) */
  streaming?: boolean
  /** Maximum tokens to generate (default: 4096) */
  maxTokens?: number
  /** Enable parallel tool calls (default: true) */
  parallelToolCalls?: boolean
  /** Store metadata for prompt caching (default: true) */
  promptCaching?: boolean
}

export interface TokenStats {
  inputTokens: number
  outputTokens: number
  cachedTokens?: number
  totalTokens: number
  estimatedCost?: number
}

// =============================================================================
// Prompt Caching Optimization
// =============================================================================

/**
 * Prompt caching best practices:
 * 1. Place static content (system prompt, instructions) at the BEGINNING
 * 2. Place dynamic content (user messages, context) at the END
 * 3. Keep static prefix consistent across requests
 * 4. Minimum 1024 tokens for caching to activate
 * 
 * This structure maximizes cache hits since OpenAI caches from the start.
 */

/**
 * Cache key generator for tracking prompt cache effectiveness
 */
export function generateCacheKey(staticContent: string): string {
  // Simple hash for cache key generation
  let hash = 0
  for (let i = 0; i < staticContent.length; i++) {
    const char = staticContent.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `cache_${Math.abs(hash).toString(36)}`
}

/**
 * Structure content for optimal prompt caching
 * Static content goes first, dynamic content goes last
 */
export function structureForCaching(
  staticSystemPrompt: string,
  dynamicContext: string,
): string {
  // Separator helps maintain cache boundary
  const CACHE_BOUNDARY = '\n---\n'
  return staticSystemPrompt + CACHE_BOUNDARY + dynamicContext
}

// =============================================================================
// Token Optimization
// =============================================================================

/** Approximate tokens per character (conservative estimate) */
const CHARS_PER_TOKEN = 4

/**
 * Estimate token count from text
 * Note: This is an approximation. For exact counts, use tiktoken.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text)
  if (estimatedTokens <= maxTokens) return text
  
  // Truncate with buffer for safety
  const maxChars = (maxTokens * CHARS_PER_TOKEN) - 100
  return text.slice(0, maxChars) + '...'
}

/**
 * Optimize messages array to reduce token usage
 * - Truncates overly long messages
 * - Removes redundant whitespace
 * - Limits conversation history
 */
export function optimizeMessages(
  messages: Array<{ role: string; content: string }>,
  options: {
    maxMessagesHistory?: number
    maxTokensPerMessage?: number
    maxTotalTokens?: number
  } = {}
): Array<{ role: string; content: string }> {
  const {
    maxMessagesHistory = 20,
    maxTokensPerMessage = 8000,
    maxTotalTokens = 32000,
  } = options

  // Keep most recent messages
  let optimized = messages.slice(-maxMessagesHistory)

  // Truncate individual messages
  optimized = optimized.map(msg => ({
    ...msg,
    content: truncateToTokenLimit(
      msg.content.trim().replace(/\s+/g, ' '), // Normalize whitespace
      maxTokensPerMessage
    ),
  }))

  // If still too long, progressively remove older messages
  let totalTokens = optimized.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
  
  while (totalTokens > maxTotalTokens && optimized.length > 1) {
    // Remove oldest message (but keep the first system message if present)
    const removeIndex = optimized[0].role === 'system' ? 1 : 0
    const removed = optimized.splice(removeIndex, 1)[0]
    totalTokens -= estimateTokens(removed.content)
  }

  return optimized
}

// =============================================================================
// Response Optimization
// =============================================================================

/**
 * Default latency-optimized configuration
 */
export const DEFAULT_LATENCY_CONFIG: Required<LatencyConfig> = {
  streaming: true,
  maxTokens: 4096,
  parallelToolCalls: true,
  promptCaching: true,
}

/**
 * Build optimized request parameters for the OpenAI API
 */
export function buildOptimizedParams(
  baseParams: Record<string, unknown>,
  config: LatencyConfig = {}
): Record<string, unknown> {
  const mergedConfig = { ...DEFAULT_LATENCY_CONFIG, ...config }

  return {
    ...baseParams,
    stream: mergedConfig.streaming,
    max_output_tokens: mergedConfig.maxTokens,
    parallel_tool_calls: mergedConfig.parallelToolCalls,
    // Store option enables prompt caching
    store: mergedConfig.promptCaching,
  }
}

// =============================================================================
// Latency Measurement
// =============================================================================

export interface LatencyMetrics {
  /** Time to first token (ms) */
  ttft: number
  /** Total request duration (ms) */
  totalDuration: number
  /** Tokens per second */
  tokensPerSecond?: number
  /** Cache hit ratio */
  cacheHitRatio?: number
}

/**
 * Create a latency tracker for measuring API performance
 */
export function createLatencyTracker() {
  const startTime = Date.now()
  let firstTokenTime: number | null = null
  let tokenCount = 0

  return {
    /** Call when first token is received */
    onFirstToken() {
      if (!firstTokenTime) {
        firstTokenTime = Date.now()
      }
    },

    /** Call for each token received */
    onToken() {
      tokenCount++
    },

    /** Get final metrics */
    getMetrics(): LatencyMetrics {
      const endTime = Date.now()
      const totalDuration = endTime - startTime
      const ttft = firstTokenTime ? firstTokenTime - startTime : totalDuration

      return {
        ttft,
        totalDuration,
        tokensPerSecond: tokenCount > 0 ? (tokenCount / totalDuration) * 1000 : undefined,
      }
    },
  }
}

// =============================================================================
// Parallel Request Utilities
// =============================================================================

/**
 * Execute multiple API calls in parallel with concurrency limit
 */
export async function parallelRequests<T>(
  tasks: Array<() => Promise<T>>,
  concurrencyLimit: number = 5
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result)
    })

    executing.push(promise)

    if (executing.length >= concurrencyLimit) {
      await Promise.race(executing)
      // Remove completed promises
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}

