/**
 * API Types
 * 
 * Type definitions specific to API routes and requests.
 * 
 * Streaming events follow OpenAI's semantic event types:
 * @see https://platform.openai.com/docs/guides/streaming-responses
 * @see https://platform.openai.com/docs/api-reference/responses-streaming
 */

import type { MessageContentSegment } from '@/lib/types'
import type { UserPersonalizationContext } from '@/lib/ai/agent/user-context'

// =============================================================================
// OpenAI Streaming Event Types
// @see https://platform.openai.com/docs/api-reference/responses-streaming
// =============================================================================

/**
 * Base streaming event with type discriminator
 */
export interface BaseStreamEvent {
  type: string
  sequence_number?: number
}

/**
 * Response lifecycle events
 */
export interface ResponseCreatedEvent extends BaseStreamEvent {
  type: 'response.created'
  response: {
    id: string
    status: 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete'
  }
}

export interface ResponseInProgressEvent extends BaseStreamEvent {
  type: 'response.in_progress'
  response: {
    id: string
    status: 'in_progress'
  }
}

export interface ResponseCompletedEvent extends BaseStreamEvent {
  type: 'response.completed'
  response: {
    id: string
    status: 'completed'
    output?: unknown[]
  }
}

export interface ResponseFailedEvent extends BaseStreamEvent {
  type: 'response.failed'
  response: {
    id: string
    status: 'failed'
    error?: {
      code: string
      message: string
    }
  }
}

/**
 * Output item events (for messages, function calls, etc.)
 */
export interface ResponseOutputItemAddedEvent extends BaseStreamEvent {
  type: 'response.output_item.added'
  output_index: number
  item: {
    id: string
    type: 'message' | 'function_call' | 'web_search_call' | 'image_generation_call' | 'reasoning'
    status?: string
    name?: string
    call_id?: string
  }
}

export interface ResponseOutputItemDoneEvent extends BaseStreamEvent {
  type: 'response.output_item.done'
  output_index: number
  item: {
    id: string
    type: string
    status: 'completed' | 'failed'
    result?: string
    revised_prompt?: string
  }
}

/**
 * Content part events (for message content parts)
 */
export interface ResponseContentPartAddedEvent extends BaseStreamEvent {
  type: 'response.content_part.added'
  item_id: string
  content_index: number
  part: {
    type: 'text' | 'refusal'
    text?: string
  }
}

export interface ResponseContentPartDoneEvent extends BaseStreamEvent {
  type: 'response.content_part.done'
  item_id: string
  content_index: number
  part: {
    type: 'text' | 'refusal'
    text?: string
    annotations?: URLCitationAnnotation[]
  }
}

/**
 * Text streaming events
 */
export interface ResponseOutputTextDeltaEvent extends BaseStreamEvent {
  type: 'response.output_text.delta'
  item_id: string
  content_index: number
  delta: string
}

export interface ResponseOutputTextDoneEvent extends BaseStreamEvent {
  type: 'response.output_text.done'
  item_id: string
  content_index: number
  text: string
}

/**
 * Reasoning streaming events (for models with reasoning capabilities)
 */
export interface ResponseReasoningSummaryTextDeltaEvent extends BaseStreamEvent {
  type: 'response.reasoning_summary_text.delta'
  item_id: string
  summary_index: number
  delta: string
}

export interface ResponseReasoningSummaryTextDoneEvent extends BaseStreamEvent {
  type: 'response.reasoning_summary_text.done'
  item_id: string
  summary_index: number
  text: string
}

/**
 * Function call events
 */
export interface ResponseFunctionCallArgumentsDeltaEvent extends BaseStreamEvent {
  type: 'response.function_call_arguments.delta'
  item_id: string
  call_id: string
  delta: string
}

export interface ResponseFunctionCallArgumentsDoneEvent extends BaseStreamEvent {
  type: 'response.function_call_arguments.done'
  item_id: string
  call_id: string
  name: string
  arguments: string
}

/**
 * Web search events
 */
export interface ResponseWebSearchCallInProgressEvent extends BaseStreamEvent {
  type: 'response.web_search_call.in_progress'
  item_id: string
  output_index: number
}

export interface ResponseWebSearchCallSearchingEvent extends BaseStreamEvent {
  type: 'response.web_search_call.searching'
  item_id: string
  output_index: number
}

export interface ResponseWebSearchCallCompletedEvent extends BaseStreamEvent {
  type: 'response.web_search_call.completed'
  item_id: string
  output_index: number
}

/**
 * URL citation annotation from web search
 */
export interface URLCitationAnnotation {
  type: 'url_citation'
  start_index: number
  end_index: number
  url: string
  title?: string
}

/**
 * Error event
 */
export interface StreamErrorEvent extends BaseStreamEvent {
  type: 'error'
  error: {
    code: string
    message: string
  }
}

/**
 * Union type for all streaming events
 */
export type StreamingEvent =
  | ResponseCreatedEvent
  | ResponseInProgressEvent
  | ResponseCompletedEvent
  | ResponseFailedEvent
  | ResponseOutputItemAddedEvent
  | ResponseOutputItemDoneEvent
  | ResponseContentPartAddedEvent
  | ResponseContentPartDoneEvent
  | ResponseOutputTextDeltaEvent
  | ResponseOutputTextDoneEvent
  | ResponseReasoningSummaryTextDeltaEvent
  | ResponseReasoningSummaryTextDoneEvent
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseFunctionCallArgumentsDoneEvent
  | ResponseWebSearchCallInProgressEvent
  | ResponseWebSearchCallSearchingEvent
  | ResponseWebSearchCallCompletedEvent
  | StreamErrorEvent

// =============================================================================
// Custom SSE Event Types (our additions to OpenAI's events)
// =============================================================================

/**
 * Processing mode event - sent at start of stream to indicate mode
 */
export interface ModeEvent {
  mode: {
    type: 'chat' | 'agent' | 'research'
    reason: string
    confidence: 'high' | 'medium' | 'low'
    reasoningEffort: 'none' | 'low' | 'medium' | 'high'
    backgroundMode?: boolean
  }
}

/**
 * Tool use status event
 */
export interface ToolUseEvent {
  tool_use: {
    tool: string
    status: 'in_progress' | 'searching' | 'executing' | 'completed' | 'failed' | 'error'
    details?: string
  }
}

/**
 * Tool result event
 */
export interface ToolResultEvent {
  tool_result: {
    tool: string
    success: boolean
    output: unknown
  }
}

/**
 * Generated image event
 */
export interface GeneratedImageEvent {
  generated_image: {
    base64: string
    prompt: string
  }
}

/**
 * Research sources event
 */
export interface ResearchSourcesEvent {
  research_sources: Array<{
    url: string
    title?: string
  }>
}

/**
 * Research stage event - for granular research progress updates
 */
export interface ResearchStageEvent {
  research_stage: {
    stage: 'starting' | 'searching' | 'analyzing' | 'synthesizing' | 'completed' | 'failed'
    activity?: string
  }
}

/**
 * Background mode status event
 */
export interface BackgroundStatusEvent {
  background: {
    responseId: string
    status: BackgroundResponseStatus
    message: string
  }
}

/**
 * SSE error event with retry info
 */
export interface SSEErrorEvent {
  error: {
    type: string
    message: string
    retryable: boolean
    retryAfterMs?: number
    requestId?: string
  }
}

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
  /** Research mode uses high reasoning effort */
  researchMode?: boolean
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
