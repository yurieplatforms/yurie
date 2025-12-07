/**
 * Agent Barrel Export
 *
 * Re-exports all agent utilities for convenient importing.
 *
 * @example
 * import { buildSystemPrompt, convertToOpenAIContent, classifyRequest } from '@/lib/agent'
 */

// Message converter
export { convertToOpenAIContent } from './message-converter'

// System prompt
export { 
  buildSystemPrompt, 
  getStaticPromptForMode,
  getStaticPromptTokenEstimate,
} from './system-prompt'

// Request classifier
export {
  classifyRequest,
  likelyNeedsWebSearch,
  isSimpleGreeting,
} from './classifier'
export type {
  RequestMode,
  ClassificationResult,
} from './classifier'

// User context
export {
  getUserPersonalizationContext,
  getUserName,
} from './user-context'
export type {
  UserProfile,
  UserPersonalizationContext,
} from './user-context'
