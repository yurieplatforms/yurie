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
  getStaticPrompt,
  getStaticPromptTokenEstimate,
  getStaticPromptTokenCount,
  getSystemPromptTokenCount,
  CORE_IDENTITY,
  TEXT_RESPONSE_FORMAT,
  JSON_RESPONSE_FORMAT,
} from './system-prompt'

// Request classifier
export {
  classifyRequest,
  likelyNeedsWebSearch,
  isSimpleGreeting,
} from './classifier'
export type { RequestMode, ClassificationResult } from './classifier'

// User context
export { getUserPersonalizationContext, getUserName } from './user-context'
export type { UserProfile, UserPersonalizationContext } from './user-context'

// Tool definitions
export {
  BUILTIN_TOOLS,
  GMAIL_TOOLS,
  SPOTIFY_TOOLS,
  GITHUB_TOOLS,
  INTEGRATIONS,
  getAllTools,
  getToolsForIntegration,
  getToolById,
  getDefaultToolsForIntegration,
  formatToolName,
  getIntegration,
  getAllIntegrations,
} from './tool-definitions'
export type {
  ToolCategory,
  ToolDefinition,
  IntegrationDefinition,
} from './tool-definitions'

// Capability prompts
export {
  GMAIL_CAPABILITY,
  SPOTIFY_CAPABILITY,
  GITHUB_CAPABILITY,
  CAPABILITY_REGISTRY,
  getCapabilityPrompt,
  getCapabilityPromptText,
  buildCapabilitiesPrompt,
  getAllCapabilityIds,
  getCapabilityKeyTools,
} from './capability-prompts'
export type { CapabilityPrompt } from './capability-prompts'

// Tokenizer
export {
  countTokens,
  countTokensWithCost,
  countChatTokens,
  isWithinLimit,
  truncateToTokenLimit,
  encodeText,
  decodeTokens,
  getContextWindowSize,
  getRemainingContextSpace,
  estimateSystemPromptTokens,
  estimateTokensFromChars,
} from './tokenizer'
export type { TokenCountResult, ChatMessage } from './tokenizer'

// Response schema
export {
  SuggestionSchema,
  StructuredResponseSchema,
  ChatResponseSchema,
  STRUCTURED_RESPONSE_JSON_SCHEMA,
  SIMPLE_RESPONSE_JSON_SCHEMA,
  parseStructuredResponse,
  safeParseStructuredResponse,
  parseChatResponse,
  extractSuggestions,
  removesSuggestionsFromContent,
  getResponseFormatConfig,
} from './response-schema'
export type {
  Suggestion,
  StructuredResponse,
  ChatResponse,
  ResponseFormatType,
} from './response-schema'
