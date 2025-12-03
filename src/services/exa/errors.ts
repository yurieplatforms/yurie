/**
 * EXA API Error Handling
 *
 * Provides error classification and user-friendly messages for EXA API errors.
 * Implements error handling best practices from:
 * @see https://docs.exa.ai/reference/error-codes
 *
 * @module lib/tools/exa-errors
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * EXA API error type identifiers
 * @see https://docs.exa.ai/reference/error-codes
 */
export type ExaErrorType =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limit_error'
  | 'internal_server_error'
  | 'bad_gateway'
  | 'service_unavailable'
  | 'unknown_error'

/**
 * Content-specific error tags returned in the statuses field
 * @see https://docs.exa.ai/reference/error-codes
 */
export type ExaContentErrorTag =
  | 'CRAWL_NOT_FOUND'
  | 'CRAWL_TIMEOUT'
  | 'CRAWL_LIVECRAWL_TIMEOUT'
  | 'SOURCE_NOT_AVAILABLE'
  | 'CRAWL_UNKNOWN_ERROR'

/**
 * Structured error information for client consumption
 */
export type ExaError = {
  /** Error type identifier */
  type: ExaErrorType
  /** HTTP status code */
  statusCode: number
  /** User-friendly error message */
  message: string
  /** Whether the error is retryable */
  retryable: boolean
  /** Suggested retry delay in milliseconds (for retryable errors) */
  retryAfterMs?: number
  /** Original error message for logging */
  originalMessage?: string
  /** Request ID for support tickets */
  requestId?: string
}

/**
 * Content-specific error from the statuses field
 * @see https://docs.exa.ai/reference/error-codes
 */
export type ExaContentError = {
  /** The URL that failed */
  id: string
  /** Error status */
  status: 'error'
  /** Error details */
  error: {
    /** Error tag identifier */
    tag: ExaContentErrorTag
    /** HTTP status code */
    httpStatusCode: number
  }
}

/**
 * Extended error info for result types
 */
export type ExaErrorInfo = {
  /** Error type identifier */
  type: ExaErrorType
  /** HTTP status code */
  statusCode: number
  /** Whether the error is retryable */
  retryable: boolean
  /** Request ID for support */
  requestId?: string
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Maps HTTP status codes to EXA error types
 * @see https://docs.exa.ai/reference/error-codes
 */
const STATUS_CODE_TO_ERROR_TYPE: Record<number, ExaErrorType> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limit_error',
  500: 'internal_server_error',
  502: 'bad_gateway',
  503: 'service_unavailable',
}

/**
 * User-friendly error messages for each error type
 * @see https://docs.exa.ai/reference/error-codes
 */
const ERROR_MESSAGES: Record<ExaErrorType, string> = {
  bad_request:
    'Invalid request parameters. Please check the request format and try again.',
  unauthorized:
    'Missing or invalid API key. Please verify your EXA API key is correct and active.',
  forbidden:
    'Access denied. Your API key may have insufficient permissions or rate limit exceeded.',
  not_found:
    'Resource not found. The requested URL or resource does not exist.',
  conflict:
    'Resource conflict. A resource with this identifier already exists.',
  rate_limit_error:
    'Rate limit exceeded. Please wait a moment and try again.',
  internal_server_error:
    'EXA server error. Please retry your request after a brief wait.',
  bad_gateway:
    'Upstream server issue. Please retry your request after a brief delay.',
  service_unavailable:
    'EXA service is temporarily unavailable. Please try again shortly.',
  unknown_error:
    'An unexpected error occurred with the EXA API. Please try again.',
}

/**
 * User-friendly messages for content-specific errors
 * @see https://docs.exa.ai/reference/error-codes
 */
const CONTENT_ERROR_MESSAGES: Record<ExaContentErrorTag, string> = {
  CRAWL_NOT_FOUND:
    'Content not found at the specified URL. Please verify the URL is correct and accessible.',
  CRAWL_TIMEOUT:
    'Request timed out while fetching content. Please try again.',
  CRAWL_LIVECRAWL_TIMEOUT:
    'Live crawl operation timed out. Try with livecrawl: "fallback" or livecrawl: "never".',
  SOURCE_NOT_AVAILABLE:
    'Source is unavailable or requires authentication. The content may be behind a paywall.',
  CRAWL_UNKNOWN_ERROR:
    'An error occurred while crawling the content. Please retry the request.',
}

/**
 * Determines if an error type is retryable
 * @see https://docs.exa.ai/reference/error-codes
 */
const RETRYABLE_ERRORS: Set<ExaErrorType> = new Set([
  'rate_limit_error',
  'internal_server_error',
  'bad_gateway',
  'service_unavailable',
])

/**
 * Determines if a content error is retryable
 */
const RETRYABLE_CONTENT_ERRORS: Set<ExaContentErrorTag> = new Set([
  'CRAWL_TIMEOUT',
  'CRAWL_LIVECRAWL_TIMEOUT',
  'CRAWL_UNKNOWN_ERROR',
])

/**
 * Default retry delays in milliseconds for retryable errors
 */
const DEFAULT_RETRY_DELAYS: Partial<Record<ExaErrorType, number>> = {
  rate_limit_error: 60000, // 1 minute
  internal_server_error: 5000, // 5 seconds
  bad_gateway: 5000, // 5 seconds
  service_unavailable: 30000, // 30 seconds
}

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * EXA API error response structure
 * @see https://docs.exa.ai/reference/error-codes
 */
type ExaApiErrorResponse = {
  requestId?: string
  error?: string
}

/**
 * Shape of errors thrown by the exa-js SDK
 */
type ExaSDKError = Error & {
  status?: number
  statusCode?: number
  response?: {
    status?: number
    data?: ExaApiErrorResponse
    headers?: Headers | Record<string, string>
  }
  body?: ExaApiErrorResponse
}

// ============================================================================
// Error Parsing
// ============================================================================

/**
 * Type guard to check if an error is from the EXA API
 */
export function isExaApiError(error: unknown): error is ExaSDKError {
  if (!(error instanceof Error)) return false

  const maybeExaError = error as ExaSDKError

  // Check for status code in common locations
  return (
    typeof maybeExaError.status === 'number' ||
    typeof maybeExaError.statusCode === 'number' ||
    typeof maybeExaError.response?.status === 'number'
  )
}

/**
 * Extracts HTTP status code from an EXA SDK error
 */
function getStatusCode(error: ExaSDKError): number {
  return (
    error.status ??
    error.statusCode ??
    error.response?.status ??
    500
  )
}

/**
 * Extracts request ID from an EXA error
 */
function getRequestId(error: ExaSDKError): string | undefined {
  // Try response body first
  if (error.body?.requestId) {
    return error.body.requestId
  }

  // Try response data
  if (error.response?.data?.requestId) {
    return error.response.data.requestId
  }

  // Try extracting from error message (format: requestId: xxx)
  const match = error.message.match(/requestId[:\s]+([a-f0-9]+)/i)
  return match?.[1]
}

/**
 * Extracts retry-after value from response headers
 */
function getRetryAfterMs(error: ExaSDKError): number | undefined {
  const headers = error.response?.headers
  if (!headers) return undefined

  // Handle both Headers object and plain object
  const retryAfter =
    headers instanceof Headers
      ? headers.get('retry-after')
      : (headers as Record<string, string>)['retry-after']

  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!isNaN(seconds)) {
      return seconds * 1000
    }
  }

  return undefined
}

/**
 * Parses an EXA API error into a structured ExaError
 *
 * @param error - The error to parse
 * @returns Structured error information
 *
 * @example
 * ```ts
 * try {
 *   await exaClient.search(...)
 * } catch (error) {
 *   const exaError = parseExaError(error)
 *   console.log(exaError.message) // User-friendly message
 *   if (exaError.retryable) {
 *     // Schedule retry after exaError.retryAfterMs
 *   }
 * }
 * ```
 */
export function parseExaError(error: unknown): ExaError {
  // Handle EXA API errors
  if (isExaApiError(error)) {
    const statusCode = getStatusCode(error)
    const errorType = STATUS_CODE_TO_ERROR_TYPE[statusCode] ?? 'unknown_error'
    const retryable = RETRYABLE_ERRORS.has(errorType)

    // Extract original message from various locations
    let originalMessage = error.message
    if (error.body?.error) {
      originalMessage = error.body.error
    } else if (error.response?.data?.error) {
      originalMessage = error.response.data.error
    }

    return {
      type: errorType,
      statusCode,
      message: ERROR_MESSAGES[errorType],
      retryable,
      retryAfterMs: retryable
        ? getRetryAfterMs(error) ?? DEFAULT_RETRY_DELAYS[errorType]
        : undefined,
      originalMessage,
      requestId: getRequestId(error),
    }
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'

  return {
    type: 'unknown_error',
    statusCode: 500,
    message: ERROR_MESSAGES.unknown_error,
    retryable: false,
    originalMessage: message,
  }
}

/**
 * Parses a content-specific error from the statuses field
 *
 * @param contentError - The content error to parse
 * @returns User-friendly error message and retry info
 */
export function parseContentError(contentError: ExaContentError): {
  message: string
  retryable: boolean
} {
  const { tag } = contentError.error
  return {
    message: CONTENT_ERROR_MESSAGES[tag] ?? CONTENT_ERROR_MESSAGES.CRAWL_UNKNOWN_ERROR,
    retryable: RETRYABLE_CONTENT_ERRORS.has(tag),
  }
}

/**
 * Converts an ExaError to ExaErrorInfo for result types
 */
export function toExaErrorInfo(exaError: ExaError): ExaErrorInfo {
  return {
    type: exaError.type,
    statusCode: exaError.statusCode,
    retryable: exaError.retryable,
    requestId: exaError.requestId,
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Configuration for retry with exponential backoff
 */
export type RetryConfig = {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Initial delay in milliseconds */
  initialDelayMs?: number
  /** Maximum delay in milliseconds */
  maxDelayMs?: number
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Executes a function with exponential backoff retry logic
 *
 * @param fn - The async function to execute
 * @param config - Retry configuration
 * @returns The result of the function or throws the last error
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => exaClient.search(query, options),
 *   { maxRetries: 3 }
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {},
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
  } = { ...DEFAULT_RETRY_CONFIG, ...config }

  let lastError: ExaError | null = null
  let currentDelay = initialDelayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const exaError = parseExaError(error)
      lastError = exaError

      // Log the error
      console.error(`[exa] API error (attempt ${attempt + 1}/${maxRetries + 1}):`, {
        type: exaError.type,
        statusCode: exaError.statusCode,
        message: exaError.originalMessage,
        requestId: exaError.requestId,
      })

      // Don't retry if not retryable or we've exhausted retries
      if (!exaError.retryable || attempt >= maxRetries) {
        throw error
      }

      // Calculate delay - use retry-after if available, otherwise exponential backoff
      const delay = exaError.retryAfterMs ?? Math.min(currentDelay, maxDelayMs)

      console.log(`[exa] Retrying in ${delay}ms...`)
      await sleep(delay)

      // Increase delay for next attempt
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError
}

/**
 * Logs an EXA error with relevant details for debugging
 */
export function logExaError(
  context: string,
  error: unknown,
  exaError: ExaError,
): void {
  console.error(`[${context}] EXA API Error:`, {
    type: exaError.type,
    statusCode: exaError.statusCode,
    message: exaError.originalMessage,
    requestId: exaError.requestId,
    retryable: exaError.retryable,
  })

  // Log full error in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}] Full error:`, error)
  }
}

