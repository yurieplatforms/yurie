/**
 * Agent Barrel Export
 *
 * Re-exports all agent utilities for convenient importing.
 *
 * @example
 * import { runAgent, buildSystemPrompt, convertToOpenAIContent } from '@/lib/agent'
 */

// Message converter
export { convertToOpenAIContent } from './message-converter'

// Runnable tools
export { createRunnableTools } from './runnable-tools'

// Agent runner
export { runAgent } from './runner'
export type { RunnerParams } from './runner'

// SSE handler
export { createSSEHandler, sendDoneSignal } from './sse-handler'
export type { SSEHandler } from './sse-handler'

// Stream processor
export {
  processCitations,
  processWebFetchResult,
  processWebSearchResult,
} from './stream-processor'
export type {
  RawCitation,
  WebFetchResultContent,
  WebSearchResultContent,
} from './stream-processor'

// System prompt
export { buildSystemPrompt } from './system-prompt'

// Types - only export commonly used types
export type {
  SSEPayload,
} from './types'

// User context
export {
  getUserProfile,
  getConversationMemories,
  getUserPersonalizationContext,
  getUserName,
  formatMemoriesForPrompt,
} from './user-context'
export type {
  UserProfile,
  ConversationMemory,
  UserPersonalizationContext,
} from './user-context'
