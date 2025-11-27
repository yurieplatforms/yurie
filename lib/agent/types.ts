/**
 * Types for Anthropic streaming events
 *
 * These types represent the structure of events from the Anthropic beta
 * tool runner stream. Since these are beta features, the SDK may not have
 * complete type definitions.
 */

// ============================================================================
// Content Block Types
// ============================================================================

export type ToolUseContentBlock = {
  type: 'tool_use'
  id: string
  name: string
  input?: Record<string, unknown>
}

export type ServerToolUseContentBlock = {
  type: 'server_tool_use'
  id: string
  name: string
  input?: Record<string, unknown>
}

export type WebFetchToolResultBlock = {
  type: 'web_fetch_tool_result'
  content: unknown
}

export type WebSearchToolResultBlock = {
  type: 'web_search_tool_result'
  content: unknown[]
}

export type TextContentBlock = {
  type: 'text'
  text: string
}

export type ContentBlock =
  | ToolUseContentBlock
  | ServerToolUseContentBlock
  | WebFetchToolResultBlock
  | WebSearchToolResultBlock
  | TextContentBlock
  | { type: string; [key: string]: unknown }

// ============================================================================
// Delta Types
// ============================================================================

export type TextDelta = {
  type: 'text_delta'
  text: string
}

export type ThinkingDelta = {
  type: 'thinking_delta'
  thinking: string
}

export type InputJsonDelta = {
  type: 'input_json_delta'
  partial_json: string
}

export type CitationDelta = {
  citations?: RawCitation[]
}

export type StreamDelta = Partial<TextDelta & ThinkingDelta & InputJsonDelta & CitationDelta> & {
  type?: string
}

// ============================================================================
// Stream Event Types
// ============================================================================

export type ContentBlockStartEvent = {
  type: 'content_block_start'
  index: number
  content_block: ContentBlock
}

export type ContentBlockDeltaEvent = {
  type: 'content_block_delta'
  index: number
  delta: StreamDelta
}

export type ContentBlockStopEvent = {
  type: 'content_block_stop'
  index: number
}

export type MessageStopEvent = {
  type: 'message_stop'
  message?: {
    stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn'
  }
}

export type MessageStartEvent = {
  type: 'message_start'
  message: {
    id: string
    type: 'message'
    role: 'assistant'
    model: string
  }
}

export type StreamEvent =
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageStopEvent
  | MessageStartEvent
  | { type: string; [key: string]: unknown }

// ============================================================================
// Citation Types (for stream processing)
// ============================================================================

export type RawCitation = {
  type: string
  cited_text?: string
  url?: string
  title?: string
  source?: string
  document_index?: number
  document_title?: string
  start_char_index?: number
  end_char_index?: number
  start_page_number?: number
  end_page_number?: number
  start_block_index?: number
  end_block_index?: number
  search_result_index?: number
}

// ============================================================================
// SSE Handler Types
// ============================================================================

export type SSEPayload = {
  choices?: Array<{
    delta: {
      content?: string
      reasoning?: string
      citations?: unknown[]
      pause_turn?: boolean
      tool_use?: unknown
      images?: unknown[]
    }
  }>
  containerId?: string
  error?: {
    message: string
  }
}

