/**
 * Background Mode Handler
 * 
 * Implements OpenAI's Background mode for long-running tasks.
 * Reference: https://platform.openai.com/docs/guides/background
 * 
 * Background mode enables:
 * - Asynchronous task execution without timeout concerns
 * - Polling for response status
 * - Resumable streaming with sequence_number tracking
 * - Response cancellation
 */

import type OpenAI from 'openai'

// =============================================================================
// Types
// =============================================================================

/** Background response status */
export type BackgroundResponseStatus = 
  | 'queued'       // Request is queued for processing
  | 'in_progress'  // Request is being processed
  | 'completed'    // Request completed successfully
  | 'failed'       // Request failed
  | 'cancelled'    // Request was cancelled
  | 'incomplete'   // Request completed but output was truncated

/** Background response object */
export interface BackgroundResponse {
  id: string
  status: BackgroundResponseStatus
  output?: unknown[]
  output_text?: string
  error?: {
    code: string
    message: string
  }
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  created_at?: number
}

/** Stream event with sequence number for resumption */
export interface BackgroundStreamEvent {
  type: string
  sequence_number: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/** Background request configuration */
export interface BackgroundRequestConfig {
  /** Enable background mode */
  background: true
  /** Store responses (required for background mode) */
  store: true
  /** Enable streaming (optional, allows resumable streams) */
  stream?: boolean
}

/** Polling configuration */
export interface PollConfig {
  /** Initial poll interval in ms (default: 2000) */
  initialInterval?: number
  /** Maximum poll interval in ms (default: 10000) */
  maxInterval?: number
  /** Backoff multiplier (default: 1.5) */
  backoffMultiplier?: number
  /** Maximum total polling time in ms (default: 600000 = 10 minutes) */
  maxPollTime?: number
  /** Callback for status updates */
  onStatusUpdate?: (status: BackgroundResponseStatus, response: BackgroundResponse) => void
}

/** Stream resumption configuration */
export interface StreamResumeConfig {
  /** Response ID to resume */
  responseId: string
  /** Sequence number to start after */
  startingAfter: number
}

// =============================================================================
// Background Response Utilities
// =============================================================================

/**
 * Check if a response status is terminal (no longer in progress)
 */
export function isTerminalStatus(status: BackgroundResponseStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'incomplete'].includes(status)
}

/**
 * Check if a response status indicates success
 */
export function isSuccessStatus(status: BackgroundResponseStatus): boolean {
  return status === 'completed'
}

/**
 * Build background mode request parameters
 */
export function withBackgroundMode<T extends Record<string, unknown>>(
  params: T,
  options: { stream?: boolean } = {}
): T & BackgroundRequestConfig {
  return {
    ...params,
    background: true,
    store: true,
    ...(options.stream !== undefined && { stream: options.stream }),
  }
}

// =============================================================================
// Polling Implementation
// =============================================================================

const DEFAULT_POLL_CONFIG: Required<Omit<PollConfig, 'onStatusUpdate'>> = {
  initialInterval: 2000,
  maxInterval: 10000,
  backoffMultiplier: 1.5,
  maxPollTime: 600000, // 10 minutes (matches OpenAI's storage time)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Poll a background response until it reaches a terminal state
 * 
 * @param openai OpenAI client instance
 * @param responseId The response ID to poll
 * @param config Polling configuration
 * @returns The final response object
 */
export async function pollBackgroundResponse(
  openai: OpenAI,
  responseId: string,
  config: PollConfig = {}
): Promise<BackgroundResponse> {
  const {
    initialInterval,
    maxInterval,
    backoffMultiplier,
    maxPollTime,
  } = { ...DEFAULT_POLL_CONFIG, ...config }
  
  const startTime = Date.now()
  let currentInterval = initialInterval
  let lastStatus: BackgroundResponseStatus | null = null
  
  while (true) {
    // Check if we've exceeded max polling time
    if (Date.now() - startTime > maxPollTime) {
      throw new Error(`Background response polling timed out after ${maxPollTime}ms`)
    }
    
    // Retrieve the response status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses as any).retrieve(responseId) as BackgroundResponse
    
    // Notify status update if callback provided and status changed
    if (config.onStatusUpdate && response.status !== lastStatus) {
      config.onStatusUpdate(response.status, response)
      lastStatus = response.status
    }
    
    // Check if we've reached a terminal state
    if (isTerminalStatus(response.status)) {
      return response
    }
    
    // Wait before next poll with exponential backoff
    await sleep(currentInterval)
    currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval)
  }
}

// =============================================================================
// Background Streaming
// =============================================================================

/** Cursor tracker for resumable streams */
export class StreamCursor {
  private _sequenceNumber: number = 0
  private _responseId: string | null = null
  
  get sequenceNumber(): number {
    return this._sequenceNumber
  }
  
  get responseId(): string | null {
    return this._responseId
  }
  
  /**
   * Update cursor from a stream event
   */
  update(event: BackgroundStreamEvent): void {
    if (event.sequence_number !== undefined) {
      this._sequenceNumber = event.sequence_number
    }
    // Extract response ID from response.created event
    if (event.type === 'response.created' && event.response?.id) {
      this._responseId = event.response.id
    }
  }
  
  /**
   * Check if we have enough info to resume
   */
  canResume(): boolean {
    return this._responseId !== null && this._sequenceNumber > 0
  }
  
  /**
   * Get resume configuration
   */
  getResumeConfig(): StreamResumeConfig | null {
    if (!this.canResume() || !this._responseId) {
      return null
    }
    return {
      responseId: this._responseId,
      startingAfter: this._sequenceNumber,
    }
  }
  
  /**
   * Reset cursor state
   */
  reset(): void {
    this._sequenceNumber = 0
    this._responseId = null
  }
}

/**
 * Create a background streaming response with cursor tracking
 * 
 * @param openai OpenAI client instance
 * @param params Request parameters (will have background mode added)
 * @returns Object with stream iterator and cursor
 */
export async function createBackgroundStream(
  openai: OpenAI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: AsyncIterable<any>
  cursor: StreamCursor
}> {
  const cursor = new StreamCursor()
  
  // Add background mode and streaming
  const backgroundParams = withBackgroundMode(params, { stream: true })
  
  // Create the streaming response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await (openai.responses as any).create(backgroundParams)
  
  // Wrap the stream to track cursor
  const wrappedStream = (async function* () {
    for await (const event of stream) {
      cursor.update(event as BackgroundStreamEvent)
      yield event
    }
  })()
  
  return { stream: wrappedStream, cursor }
}

/**
 * Resume a background stream from a cursor position
 * 
 * Note: SDK support for resuming streams is coming soon per OpenAI docs.
 * This function prepares for that functionality.
 * 
 * @param openai OpenAI client instance
 * @param resumeConfig Configuration for resuming
 * @returns Resumed stream iterator
 */
export async function resumeBackgroundStream(
  openai: OpenAI,
  resumeConfig: StreamResumeConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<AsyncIterable<any>> {
  // Note: This uses the REST API pattern shown in OpenAI docs
  // SDK support is coming soon - for now we can use retrieve with stream=true
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await (openai.responses as any).retrieve(resumeConfig.responseId, {
    stream: true,
    starting_after: resumeConfig.startingAfter,
  })
  
  return stream
}

// =============================================================================
// Background Response Cancellation
// =============================================================================

/**
 * Cancel an in-progress background response
 * 
 * @param openai OpenAI client instance
 * @param responseId The response ID to cancel
 * @returns The cancelled response object
 */
export async function cancelBackgroundResponse(
  openai: OpenAI,
  responseId: string
): Promise<BackgroundResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (openai.responses as any).cancel(responseId)
  return response as BackgroundResponse
}

// =============================================================================
// Background Response Store
// =============================================================================

/**
 * In-memory store for tracking active background responses
 * In production, this should be replaced with Redis or similar
 */
class BackgroundResponseStore {
  private responses: Map<string, {
    responseId: string
    userId: string | null
    cursor: StreamCursor
    status: BackgroundResponseStatus
    createdAt: number
  }> = new Map()
  
  /**
   * Register a new background response
   */
  register(
    requestId: string,
    responseId: string,
    userId: string | null,
    cursor: StreamCursor
  ): void {
    this.responses.set(requestId, {
      responseId,
      userId,
      cursor,
      status: 'in_progress',
      createdAt: Date.now(),
    })
    
    // Clean up old entries (older than 15 minutes)
    this.cleanup()
  }
  
  /**
   * Update response status
   */
  updateStatus(requestId: string, status: BackgroundResponseStatus): void {
    const entry = this.responses.get(requestId)
    if (entry) {
      entry.status = status
    }
  }
  
  /**
   * Get response info by request ID
   */
  get(requestId: string): {
    responseId: string
    userId: string | null
    cursor: StreamCursor
    status: BackgroundResponseStatus
  } | undefined {
    return this.responses.get(requestId)
  }
  
  /**
   * Get response info by OpenAI response ID
   */
  getByResponseId(responseId: string): {
    requestId: string
    userId: string | null
    cursor: StreamCursor
    status: BackgroundResponseStatus
  } | undefined {
    for (const [requestId, entry] of this.responses.entries()) {
      if (entry.responseId === responseId) {
        return { requestId, ...entry }
      }
    }
    return undefined
  }
  
  /**
   * Remove a response from tracking
   */
  remove(requestId: string): boolean {
    return this.responses.delete(requestId)
  }
  
  /**
   * Get all active responses for a user
   */
  getActiveForUser(userId: string): Array<{
    requestId: string
    responseId: string
    status: BackgroundResponseStatus
    createdAt: number
  }> {
    const results: Array<{
      requestId: string
      responseId: string
      status: BackgroundResponseStatus
      createdAt: number
    }> = []
    
    for (const [requestId, entry] of this.responses.entries()) {
      if (entry.userId === userId && !isTerminalStatus(entry.status)) {
        results.push({
          requestId,
          responseId: entry.responseId,
          status: entry.status,
          createdAt: entry.createdAt,
        })
      }
    }
    
    return results
  }
  
  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const maxAge = 15 * 60 * 1000 // 15 minutes
    const now = Date.now()
    
    for (const [requestId, entry] of this.responses.entries()) {
      if (now - entry.createdAt > maxAge) {
        this.responses.delete(requestId)
      }
    }
  }
}

// Singleton instance
export const backgroundResponseStore = new BackgroundResponseStore()

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a task should use background mode based on complexity signals
 * 
 * Background mode is recommended for:
 * - Tasks expected to take > 30 seconds
 * - Complex multi-step tasks
 * - Tasks with multiple tool calls
 * - Agent mode requests
 */
export function shouldUseBackgroundMode(options: {
  mode: 'chat' | 'agent'
  hasTools: boolean
  estimatedComplexity?: 'low' | 'medium' | 'high'
  messageCount?: number
}): boolean {
  const { mode, hasTools, estimatedComplexity = 'medium', messageCount = 0 } = options
  
  // Agent mode with tools should use background mode
  if (mode === 'agent' && hasTools) {
    return true
  }
  
  // High complexity tasks should use background mode
  if (estimatedComplexity === 'high') {
    return true
  }
  
  // Long conversations with agent mode
  if (mode === 'agent' && messageCount > 10) {
    return true
  }
  
  // Default: use background mode for agent, not for chat
  return mode === 'agent'
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(status: BackgroundResponseStatus): string {
  switch (status) {
    case 'queued':
      return 'Request queued for processing...'
    case 'in_progress':
      return 'Processing your request...'
    case 'completed':
      return 'Request completed successfully'
    case 'failed':
      return 'Request failed'
    case 'cancelled':
      return 'Request was cancelled'
    case 'incomplete':
      return 'Request completed but response was truncated'
    default:
      return 'Unknown status'
  }
}
