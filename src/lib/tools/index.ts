/**
 * Tools Module
 * 
 * Re-exports all tool-related functionality from a single entry point.
 */

// Tool definitions and server tools
export {
  // Types
  type ToolUseBlock,
  type ToolResultBlock,
  type ServerToolType,
  type ClientToolType,
  type ToolName,
  type WebSearchToolConfig,
  // Server tools
  createWebSearchTool,
  createServerTools,
} from './definitions'

// Tool execution handlers
export { evaluateMathExpression } from './handlers'

// Memory tool
export {
  type MemoryCommand,
  type MemoryToolInput,
  type MemoryToolResult,
  MemoryToolHandler,
  createMemoryToolHandler,
} from './memory'

// EXA search tools
// @see https://docs.exa.ai/reference/search
// @see https://docs.exa.ai/reference/find-similar-links
// @see https://docs.exa.ai/reference/answer
// @see https://docs.exa.ai/reference/exa-research
export {
  type ExaSearchInput,
  type ExaFindSimilarInput,
  type ExaAnswerInput,
  type ExaAnswerResult,
  type ExaResearchInput,
  exaSearch,
  exaFindSimilar,
  exaAnswer,
  exaResearch,
  formatExaResultsForLLM,
  formatExaAnswerForLLM,
  formatExaResearchForLLM,
  isExaAvailable,
} from './exa'

// EXA error handling utilities
// @see https://docs.exa.ai/reference/error-codes
export {
  type ExaErrorType,
  type ExaContentErrorTag,
  type ExaError,
  type ExaContentError,
  type ExaErrorInfo,
  type RetryConfig,
  isExaApiError,
  parseExaError,
  parseContentError,
  toExaErrorInfo,
  retryWithBackoff,
  logExaError,
} from './exa-errors'
