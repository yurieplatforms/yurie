/**
 * Types for agent streaming events and tools.
 */

// ============================================================================
// Citation Types
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
