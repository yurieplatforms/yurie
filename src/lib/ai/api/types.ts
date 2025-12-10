/**
 * API Types
 * 
 * Type definitions specific to API routes and requests.
 */

import type { MessageContentSegment } from '@/lib/types'
import type { UserPersonalizationContext } from '@/lib/ai/agent/user-context'

/**
 * API-specific role type (includes 'system' and 'tool' not in UI Role)
 */
export type ApiRole = 'system' | 'user' | 'assistant' | 'tool'

/**
 * API request message type (simplified version of ChatMessage for requests)
 */
export type ApiChatMessage = {
  role: ApiRole
  content: string | MessageContentSegment[]
}

/**
 * Request body for the agent API endpoint
 */
export type AgentRequestBody = {
  messages: ApiChatMessage[]
  useWebSearch?: boolean
  userContext?: {
    time: string
    date: string
    timeZone: string
  }
  userPersonalization?: UserPersonalizationContext
  /** Selected tools/apps to use (e.g., 'gmail') */
  selectedTools?: string[]
  /** Chat ID for background task persistence */
  chatId?: string
  /** Message ID for background task persistence */
  messageId?: string
}

// =============================================================================
// Background Mode Types
// =============================================================================

/** Background response status from OpenAI API */
export type BackgroundResponseStatus = 
  | 'queued'       // Request is queued for processing
  | 'in_progress'  // Request is being processed
  | 'completed'    // Request completed successfully
  | 'failed'       // Request failed
  | 'cancelled'    // Request was cancelled
  | 'incomplete'   // Request completed but output was truncated

/** Background response object from OpenAI API */
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

/** Request body for background response status endpoint */
export type BackgroundStatusRequestBody = {
  responseId: string
}

/** Request body for background response cancellation endpoint */
export type BackgroundCancelRequestBody = {
  responseId: string
}

/** Response for background status check */
export interface BackgroundStatusResponse {
  status: BackgroundResponseStatus
  requestId?: string
  responseId: string
  outputText?: string
  error?: {
    code: string
    message: string
  }
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

// =============================================================================
// Persistent Background Task Types
// =============================================================================

/**
 * Persisted background task stored in database
 * Survives page refreshes and server restarts
 */
export interface PersistedBackgroundTask {
  /** Unique task ID */
  id: string
  /** User ID who owns the task */
  userId: string
  /** Chat ID this task belongs to */
  chatId: string
  /** Message ID for the assistant response */
  messageId: string
  /** OpenAI response ID for resumption */
  responseId: string
  /** Current task status */
  status: BackgroundResponseStatus
  /** Last known sequence number for stream resumption */
  sequenceNumber: number
  /** When the task was created */
  createdAt: Date
  /** When the task was last updated */
  updatedAt: Date
  /** Task type: 'agent' or 'research' */
  taskType: 'agent' | 'research'
  /** Optional partial output collected before disconnect */
  partialOutput?: string
}

/** Request body for creating a background task */
export interface CreateBackgroundTaskRequest {
  chatId: string
  messageId: string
  responseId: string
  taskType: 'agent' | 'research'
}

/** Response for active background tasks endpoint */
export interface ActiveBackgroundTasksResponse {
  tasks: PersistedBackgroundTask[]
}
