/**
 * Agent Barrel Export
 *
 * Re-exports all agent utilities for convenient importing.
 *
 * @example
 * import { buildSystemPrompt, convertToOpenAIContent } from '@/lib/agent'
 */

// Message converter
export { convertToOpenAIContent } from './message-converter'

// System prompt
export { buildSystemPrompt } from './system-prompt'

// User context
export {
  getUserPersonalizationContext,
  getUserName,
} from './user-context'
export type {
  UserProfile,
  UserPersonalizationContext,
} from './user-context'
