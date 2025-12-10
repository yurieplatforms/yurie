/**
 * AI API Module Barrel Export
 * 
 * Re-exports all API utilities for convenient importing.
 */

// OpenAI production utilities
export {
  createOpenAIClient,
  parseAPIError,
  validateMessages,
  checkRateLimit,
  getRateLimitWaitTime,
  generateRequestId,
  logRequest,
  withRetry,
  getRecommendedServiceTier,
  withServiceTier,
  determineServiceTier,
  getServiceTierDescription,
  checkRampRate,
  withBackgroundMode,
  shouldUseBackgroundMode,
} from './openai'

export type {
  RetryConfig,
  OpenAIClientConfig,
  APIErrorInfo,
  RequestLog,
  ServiceTier,
  ServiceTierConfig,
} from './openai'

// Background mode utilities
export {
  isTerminalStatus,
  isSuccessStatus,
  withBackgroundMode as buildBackgroundParams,
  pollBackgroundResponse,
  StreamCursor,
  createBackgroundStream,
  resumeBackgroundStream,
  cancelBackgroundResponse,
  backgroundResponseStore,
  shouldUseBackgroundMode as checkShouldUseBackground,
  getStatusMessage,
} from './background'

export type {
  BackgroundResponseStatus,
  BackgroundResponse,
  BackgroundStreamEvent,
  BackgroundRequestConfig,
  PollConfig,
  StreamResumeConfig,
} from './background'

// Latency tracking
export { createLatencyTracker } from './latency'

// Background task persistence
export {
  createBackgroundTask,
  getBackgroundTaskByResponseId,
  getActiveBackgroundTasks,
  getBackgroundTasksForChat,
  updateBackgroundTaskStatus,
  updateBackgroundTaskSequence,
  deleteBackgroundTask,
  cleanupOldTasks,
  isTerminalTaskStatus,
} from './background-tasks'

// API types
export type {
  ApiRole,
  ApiChatMessage,
  AgentRequestBody,
  BackgroundStatusRequestBody,
  BackgroundCancelRequestBody,
  BackgroundStatusResponse,
  PersistedBackgroundTask,
  CreateBackgroundTaskRequest,
  ActiveBackgroundTasksResponse,
} from './types'
