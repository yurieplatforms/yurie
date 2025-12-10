/**
 * OpenAI Production Utilities
 * 
 * Implements best practices for production OpenAI API usage.
 * Reference: https://platform.openai.com/docs/guides/production-best-practices
 * Reference: https://platform.openai.com/docs/guides/priority-processing
 */

import OpenAI from 'openai'

// =============================================================================
// Types
// =============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelay?: number
  /** Maximum delay in ms between retries (default: 60000) */
  maxDelay?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Jitter factor 0-1 to add randomness (default: 0.1) */
  jitterFactor?: number
}

export interface OpenAIClientConfig {
  apiKey: string
  /** Request timeout in ms (default: 120000 = 2 minutes) */
  timeout?: number
  /** Retry configuration */
  retry?: RetryConfig
}

export interface APIErrorInfo {
  code: string
  message: string
  status?: number
  isRetryable: boolean
  userMessage: string
}

// =============================================================================
// Error Handling
// =============================================================================

/** Error codes that are safe to retry */
const RETRYABLE_ERROR_CODES = new Set([
  'rate_limit_exceeded',
  'server_error',
  'timeout',
  'connection_error',
])

/** HTTP status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

/**
 * Parse an OpenAI API error into a structured format
 * Reference: https://platform.openai.com/docs/guides/error-codes#api-errors
 */
export function parseAPIError(error: unknown): APIErrorInfo {
  const apiError = error as {
    code?: string
    status?: number
    message?: string
    error?: { code?: string; message?: string; type?: string }
  }

  const code = apiError.code || apiError.error?.code || 'unknown_error'
  const status = apiError.status
  const message = apiError.message || apiError.error?.message || 'An unknown error occurred'

  // Determine if error is retryable
  const isRetryable =
    RETRYABLE_ERROR_CODES.has(code) ||
    (status !== undefined && RETRYABLE_STATUS_CODES.has(status)) ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('overloaded')

  // Generate user-friendly message
  let userMessage = 'Something went wrong. Please try again.'

  switch (code) {
    case 'insufficient_quota':
      userMessage = 'API quota exceeded. Please check your OpenAI billing.'
      break
    case 'rate_limit_exceeded':
      userMessage = 'Rate limit reached. Please wait a moment and try again.'
      break
    case 'invalid_api_key':
      userMessage = 'Invalid API key. Please check your configuration.'
      break
    case 'model_not_found':
      userMessage = 'Model not available. Please try a different model.'
      break
    case 'server_error':
      userMessage = 'OpenAI server error. Please try again in a moment.'
      break
    case 'context_length_exceeded':
      userMessage = 'Message too long. Please try a shorter message.'
      break
    case 'invalid_request_error':
      userMessage = 'Invalid request. Please check your input.'
      break
    default:
      if (status === 503) {
        userMessage = 'OpenAI is currently overloaded. Please try again later.'
      } else if (status === 401) {
        userMessage = 'Authentication failed. Please check your API key.'
      } else if (status === 429) {
        userMessage = 'Too many requests. Please wait a moment.'
      } else if (message.length < 150 && !message.includes('API')) {
        userMessage = message
      }
  }

  return { code, message, status, isRetryable, userMessage }
}

// =============================================================================
// Retry Logic with Exponential Backoff
// =============================================================================

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
}

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter
 */
function calculateRetryDelay(attempt: number, config: Required<RetryConfig>): number {
  // Exponential backoff: delay = initialDelay * (multiplier ^ attempt)
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt)
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay)
  
  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * Math.random()
  
  return Math.floor(cappedDelay + jitter)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: unknown

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const errorInfo = parseAPIError(error)

      // Don't retry non-retryable errors
      if (!errorInfo.isRetryable) {
        throw error
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= retryConfig.maxRetries) {
        console.warn(`[openai] Max retries (${retryConfig.maxRetries}) exceeded`)
        throw error
      }

      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt, retryConfig)
      console.warn(
        `[openai] Retryable error (${errorInfo.code}), attempt ${attempt + 1}/${retryConfig.maxRetries + 1}, waiting ${delay}ms`
      )
      await sleep(delay)
    }
  }

  throw lastError
}

// =============================================================================
// Rate Limiting
// =============================================================================

interface RateLimitState {
  tokens: number
  lastRefill: number
}

const rateLimiters = new Map<string, RateLimitState>()

/**
 * Simple token bucket rate limiter
 */
export function checkRateLimit(
  key: string,
  maxTokens: number = 10,
  refillRate: number = 1, // tokens per second
): boolean {
  const now = Date.now()
  let state = rateLimiters.get(key)

  if (!state) {
    state = { tokens: maxTokens, lastRefill: now }
    rateLimiters.set(key, state)
  }

  // Refill tokens based on time elapsed
  const elapsed = (now - state.lastRefill) / 1000
  state.tokens = Math.min(maxTokens, state.tokens + elapsed * refillRate)
  state.lastRefill = now

  // Check if we have tokens available
  if (state.tokens >= 1) {
    state.tokens -= 1
    return true
  }

  return false
}

/**
 * Get wait time until rate limit allows another request
 */
export function getRateLimitWaitTime(
  key: string,
  maxTokens: number = 10,
  refillRate: number = 1,
): number {
  const state = rateLimiters.get(key)
  if (!state || state.tokens >= 1) return 0
  
  const tokensNeeded = 1 - state.tokens
  return Math.ceil((tokensNeeded / refillRate) * 1000)
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create a configured OpenAI client with production defaults
 */
export function createOpenAIClient(config: OpenAIClientConfig): OpenAI {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry }
  
  return new OpenAI({
    apiKey: config.apiKey,
    timeout: config.timeout ?? 120000, // 2 minute default timeout
    maxRetries: retryConfig.maxRetries, // Use SDK's built-in retry for streaming
  })
}

// =============================================================================
// Input Validation & Sanitization
// =============================================================================

/** Maximum allowed text message length (characters) */
const MAX_TEXT_MESSAGE_LENGTH = 100000

/** Maximum allowed messages in conversation */
const MAX_MESSAGES_COUNT = 100

/**
 * Maximum total payload size (per OpenAI docs: 50MB)
 * @see https://platform.openai.com/docs/guides/images-vision
 */
const MAX_TOTAL_PAYLOAD_SIZE = 50 * 1024 * 1024

/**
 * Check if content contains image or file data (which have different size limits)
 * Images and files can be much larger than text and are validated separately.
 */
function contentHasMediaAttachments(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  
  return content.some((segment) => {
    if (!segment || typeof segment !== 'object') return false
    const type = (segment as { type?: string }).type
    // Check for image_url, url_image, file, or url_document types
    return type === 'image_url' || type === 'url_image' || type === 'file' || type === 'url_document'
  })
}

/**
 * Get the text-only length of message content (excluding media attachments)
 */
function getTextContentLength(content: unknown): number {
  if (typeof content === 'string') {
    return content.length
  }
  
  if (!Array.isArray(content)) {
    return 0
  }
  
  // Sum up only text segment lengths
  return content.reduce((total, segment) => {
    if (!segment || typeof segment !== 'object') return total
    const type = (segment as { type?: string }).type
    if (type === 'text') {
      const text = (segment as { text?: string }).text
      return total + (typeof text === 'string' ? text.length : 0)
    }
    return total
  }, 0)
}

/**
 * Validate and sanitize input messages
 * 
 * For messages with media attachments (images, PDFs), we skip the text length
 * validation since OpenAI's actual limit is 50MB total payload per request.
 * Media validation is handled separately by the file processing utilities.
 * 
 * @see https://platform.openai.com/docs/guides/images-vision
 */
export function validateMessages(
  messages: Array<{ role: string; content: unknown }>
): { valid: boolean; error?: string } {
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' }
  }

  if (messages.length === 0) {
    return { valid: false, error: 'At least one message is required' }
  }

  if (messages.length > MAX_MESSAGES_COUNT) {
    return { valid: false, error: `Too many messages (max: ${MAX_MESSAGES_COUNT})` }
  }

  // Track total payload size for media-heavy requests
  let totalPayloadSize = 0

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: `Invalid message at index ${i}` }
    }

    if (!['user', 'assistant', 'system'].includes(msg.role)) {
      return { valid: false, error: `Invalid role "${msg.role}" at index ${i}` }
    }

    // For messages with media attachments, validate total payload size instead of text length
    // OpenAI accepts up to 50MB total per request for images/files
    if (contentHasMediaAttachments(msg.content)) {
      const contentStr = JSON.stringify(msg.content)
      totalPayloadSize += contentStr.length
      
      // Check individual message doesn't exceed total payload limit
      if (contentStr.length > MAX_TOTAL_PAYLOAD_SIZE) {
        return { valid: false, error: `Message at index ${i} exceeds 50MB payload limit` }
      }
    } else {
      // For text-only messages, apply the text length limit
      const textLength = getTextContentLength(msg.content)
      if (textLength > MAX_TEXT_MESSAGE_LENGTH) {
        return { valid: false, error: `Message at index ${i} is too long` }
      }
    }
  }

  // Check total payload doesn't exceed 50MB
  if (totalPayloadSize > MAX_TOTAL_PAYLOAD_SIZE) {
    return { valid: false, error: 'Total message payload exceeds 50MB limit' }
  }

  return { valid: true }
}

// =============================================================================
// Logging Utilities
// =============================================================================

export interface RequestLog {
  requestId: string
  model: string
  timestamp: number
  userId?: string
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
  error?: string
  success: boolean
  /** Service tier used for the request */
  serviceTier?: ServiceTier
}

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Log a request for monitoring
 */
export function logRequest(log: RequestLog): void {
  const logEntry = {
    ...log,
    timestamp: new Date(log.timestamp).toISOString(),
  }
  
  if (log.success) {
    console.log('[openai:request]', JSON.stringify(logEntry))
  } else {
    console.error('[openai:request]', JSON.stringify(logEntry))
  }
}

// =============================================================================
// Service Tier / Priority Processing
// Reference: https://platform.openai.com/docs/guides/priority-processing
// =============================================================================

/**
 * Service tier options for OpenAI API requests
 * 
 * - 'auto': Let OpenAI decide based on availability (default)
 * - 'default': Standard processing tier
 * - 'flex': Lower cost, higher latency (for batch/background tasks)
 * - 'priority': Lower latency, higher cost (for user-facing apps)
 */
export type ServiceTier = 'auto' | 'default' | 'flex' | 'priority'

export interface ServiceTierConfig {
  /** The service tier to use */
  tier: ServiceTier
  /** Whether this is a user-facing request (influences tier selection) */
  isUserFacing?: boolean
  /** Whether this is a background/batch task */
  isBackground?: boolean
}

/**
 * Best practices for priority processing:
 * 
 * 1. Use for user-facing, latency-sensitive requests
 * 2. Ramp up traffic gradually to avoid downgrades
 * 3. Prompt caching discounts still apply
 * 4. Share rate limits with standard processing
 * 5. Not all models support priority processing
 * 
 * Supported models (as of 2024):
 * - gpt-4o, gpt-4o-mini
 * - gpt-4.1, gpt-4.1-mini, gpt-4.1-nano
 * - gpt-5.1
 * - o1, o1-mini, o1-pro
 */

/**
 * Determine the optimal service tier based on request context
 */
export function determineServiceTier(config: ServiceTierConfig): ServiceTier {
  // Explicit tier takes precedence
  if (config.tier !== 'auto') {
    return config.tier
  }
  
  // Background/batch tasks should use flex for cost savings
  if (config.isBackground) {
    return 'flex'
  }
  
  // User-facing requests should use priority for low latency
  if (config.isUserFacing) {
    return 'priority'
  }
  
  // Default to standard processing
  return 'default'
}

/**
 * Get service tier description for logging
 */
export function getServiceTierDescription(tier: ServiceTier): string {
  switch (tier) {
    case 'priority':
      return 'Priority (low latency, premium cost)'
    case 'flex':
      return 'Flex (high latency, reduced cost)'
    case 'default':
      return 'Default (standard processing)'
    case 'auto':
      return 'Auto (system decides)'
    default:
      return 'Unknown'
  }
}

/**
 * Build request parameters with service tier
 */
export function withServiceTier(
  params: Record<string, unknown>,
  tier: ServiceTier
): Record<string, unknown> {
  // 'auto' means don't specify, let OpenAI decide
  if (tier === 'auto') {
    return params
  }
  
  return {
    ...params,
    service_tier: tier,
  }
}

// =============================================================================
// Traffic Ramp Rate Management (for priority processing)
// =============================================================================

interface RampRateState {
  requestCount: number
  windowStart: number
  lastRequestTime: number
}

const rampRateStates = new Map<string, RampRateState>()

/**
 * Check if we should use priority processing based on ramp rate
 * 
 * Priority processing has ramp rate limits - rapid traffic increases
 * may cause requests to be downgraded to standard processing.
 * 
 * Best practice: Ramp up gradually over hours, not minutes
 * 
 * @param key Unique identifier for the traffic source (e.g., project ID)
 * @param maxRequestsPerWindow Maximum requests before ramping down
 * @param windowMs Time window in milliseconds (default: 1 hour)
 */
export function checkRampRate(
  key: string,
  maxRequestsPerWindow: number = 1000,
  windowMs: number = 3600000 // 1 hour
): { allowPriority: boolean; currentRate: number; recommendation: string } {
  const now = Date.now()
  let state = rampRateStates.get(key)
  
  // Initialize or reset window
  if (!state || now - state.windowStart > windowMs) {
    state = {
      requestCount: 0,
      windowStart: now,
      lastRequestTime: now,
    }
    rampRateStates.set(key, state)
  }
  
  state.requestCount++
  state.lastRequestTime = now
  
  const utilizationRatio = state.requestCount / maxRequestsPerWindow
  
  // If we're under 70% of limit, priority is safe
  if (utilizationRatio < 0.7) {
    return {
      allowPriority: true,
      currentRate: state.requestCount,
      recommendation: 'Safe to use priority processing',
    }
  }
  
  // Between 70-90%, warn but allow
  if (utilizationRatio < 0.9) {
    return {
      allowPriority: true,
      currentRate: state.requestCount,
      recommendation: 'Approaching ramp rate limit, consider reducing priority requests',
    }
  }
  
  // Over 90%, recommend downgrading to avoid forced downgrades
  return {
    allowPriority: false,
    currentRate: state.requestCount,
    recommendation: 'Ramp rate limit approaching, use default tier to avoid downgrades',
  }
}

/**
 * Get the recommended service tier based on context and ramp rate
 */
export function getRecommendedServiceTier(
  projectKey: string,
  options: {
    isUserFacing?: boolean
    isBackground?: boolean
    forceTier?: ServiceTier
  } = {}
): { tier: ServiceTier; reason: string } {
  // Explicit tier override
  if (options.forceTier) {
    return {
      tier: options.forceTier,
      reason: `Forced tier: ${options.forceTier}`,
    }
  }
  
  // Background tasks always use flex
  if (options.isBackground) {
    return {
      tier: 'flex',
      reason: 'Background task - using flex for cost savings',
    }
  }
  
  // For user-facing requests, check ramp rate before using priority
  if (options.isUserFacing) {
    const rampCheck = checkRampRate(projectKey)
    
    if (rampCheck.allowPriority) {
      return {
        tier: 'priority',
        reason: `User-facing request - ${rampCheck.recommendation}`,
      }
    } else {
      return {
        tier: 'default',
        reason: `Ramp rate limit: ${rampCheck.recommendation}`,
      }
    }
  }
  
  // Default for other requests
  return {
    tier: 'default',
    reason: 'Standard processing',
  }
}

// =============================================================================
// Background Mode Support
// Reference: https://platform.openai.com/docs/guides/background
// =============================================================================

/**
 * Build request parameters with background mode enabled
 * 
 * Background mode requirements:
 * - `background: true` - Enable background mode
 * - `store: true` - Required for background mode
 * - `stream: true` (optional) - Enable streaming with resume capability
 */
export function withBackgroundMode(
  params: Record<string, unknown>,
  options: { stream?: boolean } = {}
): Record<string, unknown> {
  return {
    ...params,
    background: true,
    store: true,
    ...(options.stream !== undefined && { stream: options.stream }),
  }
}

/**
 * Check if background mode should be used based on request characteristics
 * 
 * Background mode is beneficial for:
 * - Agent mode tasks (complex, multi-step)
 * - Tasks with multiple tools
 * - Long conversations
 * - High complexity requests
 */
export function shouldUseBackgroundMode(options: {
  mode: 'chat' | 'agent'
  hasTools: boolean
  estimatedComplexity?: 'low' | 'medium' | 'high'
  messageCount?: number
}): boolean {
  const { mode, hasTools, estimatedComplexity = 'medium', messageCount = 0 } = options
  
  // Agent mode with tools benefits most from background mode
  if (mode === 'agent' && hasTools) {
    return true
  }
  
  // High complexity always uses background mode
  if (estimatedComplexity === 'high') {
    return true
  }
  
  // Long conversations in agent mode
  if (mode === 'agent' && messageCount > 10) {
    return true
  }
  
  // Agent mode generally benefits from background mode
  return mode === 'agent'
}

