/**
 * Anthropic API Error Handling
 *
 * Provides error classification and user-friendly messages for Anthropic API errors.
 * Implements error handling best practices from:
 * @see https://platform.claude.com/docs/en/api/errors
 *
 * @module lib/agent/errors
 */

import { APIError, RateLimitError, AuthenticationError } from '@anthropic-ai/sdk'

// ============================================================================
// Error Types
// ============================================================================

/**
 * Anthropic API error type identifiers
 * @see https://platform.claude.com/docs/en/api/errors#http-errors
 */
export type AnthropicErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'permission_error'
  | 'not_found_error'
  | 'request_too_large'
  | 'rate_limit_error'
  | 'api_error'
  | 'overloaded_error'
  | 'unknown_error'

/**
 * Structured error information for client consumption
 */
export type AgentError = {
  /** Error type identifier */
  type: AnthropicErrorType
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

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Maps HTTP status codes to Anthropic error types
 */
const STATUS_CODE_TO_ERROR_TYPE: Record<number, AnthropicErrorType> = {
  400: 'invalid_request_error',
  401: 'authentication_error',
  403: 'permission_error',
  404: 'not_found_error',
  413: 'request_too_large',
  429: 'rate_limit_error',
  500: 'api_error',
  529: 'overloaded_error',
}

/**
 * User-friendly error messages for each error type
 */
const ERROR_MESSAGES: Record<AnthropicErrorType, string> = {
  invalid_request_error:
    'There was an issue with the request format. Please try rephrasing your message.',
  authentication_error:
    'There was an authentication issue. Please contact support if this persists.',
  permission_error:
    'The API key does not have permission for this operation. Please contact support.',
  not_found_error:
    'The requested resource was not found. Please try again.',
  request_too_large:
    'Your message is too large. Please try with a shorter message or fewer attachments.',
  rate_limit_error:
    'We\'re receiving too many requests right now. Please wait a moment and try again.',
  api_error:
    'An unexpected error occurred on our end. Please try again in a few moments.',
  overloaded_error:
    'The service is experiencing high demand. Please try again shortly.',
  unknown_error:
    'An unexpected error occurred. Please try again.',
}

/**
 * Determines if an error type is retryable
 */
const RETRYABLE_ERRORS: Set<AnthropicErrorType> = new Set([
  'rate_limit_error',
  'api_error',
  'overloaded_error',
])

/**
 * Default retry delays in milliseconds for retryable errors
 */
const DEFAULT_RETRY_DELAYS: Partial<Record<AnthropicErrorType, number>> = {
  rate_limit_error: 60000, // 1 minute
  api_error: 5000, // 5 seconds
  overloaded_error: 30000, // 30 seconds
}

// ============================================================================
// Error Parsing
// ============================================================================

/**
 * Type guard to check if an error is an Anthropic API error
 */
export function isAnthropicAPIError(
  error: unknown,
): error is APIError {
  return (
    error instanceof APIError ||
    (error instanceof Error &&
      'status' in error &&
      typeof (error as APIError).status === 'number')
  )
}

/**
 * Type guard to check if an error is an Anthropic rate limit error
 */
export function isRateLimitError(
  error: unknown,
): error is RateLimitError {
  return error instanceof RateLimitError
}

/**
 * Type guard to check if an error is an Anthropic authentication error
 */
export function isAuthenticationError(
  error: unknown,
): error is AuthenticationError {
  return error instanceof AuthenticationError
}

/**
 * Extracts retry-after header value from an Anthropic error
 */
function getRetryAfterMs(error: APIError): number | undefined {
  const headers = error.headers
  if (!headers) return undefined

  // Check for retry-after header (in seconds)
  const retryAfter = headers.get('retry-after')
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (!isNaN(seconds)) {
      return seconds * 1000
    }
  }

  return undefined
}

/**
 * Extracts request ID from an Anthropic error
 */
function getRequestId(error: APIError): string | undefined {
  const headers = error.headers
  if (!headers) return undefined
  return headers.get('request-id') ?? undefined
}

/**
 * Parses an Anthropic API error into a structured AgentError
 *
 * @param error - The error to parse
 * @returns Structured error information
 *
 * @example
 * ```ts
 * try {
 *   await anthropic.messages.create(...)
 * } catch (error) {
 *   const agentError = parseAnthropicError(error)
 *   console.log(agentError.message) // User-friendly message
 *   if (agentError.retryable) {
 *     // Schedule retry after agentError.retryAfterMs
 *   }
 * }
 * ```
 */
export function parseAnthropicError(error: unknown): AgentError {
  // Handle Anthropic API errors
  if (isAnthropicAPIError(error)) {
    const statusCode = error.status ?? 500
    const errorType =
      STATUS_CODE_TO_ERROR_TYPE[statusCode] ?? 'unknown_error'
    const retryable = RETRYABLE_ERRORS.has(errorType)

    // Try to extract more specific message from error body
    let originalMessage = error.message
    const errorBody = error.error as { type?: string; message?: string } | undefined
    if (errorBody?.message) {
      originalMessage = errorBody.message
    }

    return {
      type: errorType,
      statusCode,
      message: ERROR_MESSAGES[errorType],
      retryable,
      retryAfterMs:
        retryable
          ? getRetryAfterMs(error) ?? DEFAULT_RETRY_DELAYS[errorType]
          : undefined,
      originalMessage,
      requestId: getRequestId(error),
    }
  }

  // Handle generic errors
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred'

  return {
    type: 'unknown_error',
    statusCode: 500,
    message: ERROR_MESSAGES.unknown_error,
    retryable: false,
    originalMessage: message,
  }
}

// ============================================================================
// SSE Error Events
// ============================================================================

/**
 * SSE error event payload for streaming responses
 */
export type SSEErrorPayload = {
  error: {
    type: AnthropicErrorType
    message: string
    retryable: boolean
    retryAfterMs?: number
  }
}

/**
 * Creates an SSE error payload from an AgentError
 */
export function createSSEErrorPayload(agentError: AgentError): SSEErrorPayload {
  return {
    error: {
      type: agentError.type,
      message: agentError.message,
      retryable: agentError.retryable,
      retryAfterMs: agentError.retryAfterMs,
    },
  }
}

/**
 * Logs an Anthropic error with relevant details for debugging
 */
export function logAnthropicError(
  context: string,
  error: unknown,
  agentError: AgentError,
): void {
  console.error(`[${context}] Anthropic API Error:`, {
    type: agentError.type,
    statusCode: agentError.statusCode,
    message: agentError.originalMessage,
    requestId: agentError.requestId,
    retryable: agentError.retryable,
  })

  // Log full error in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}] Full error:`, error)
  }
}

