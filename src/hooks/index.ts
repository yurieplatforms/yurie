/**
 * Hooks Barrel Export
 *
 * Re-exports all custom hooks for convenient importing.
 *
 * @example
 * import { useChat, useFileProcessor, useGeolocation, useStreamResponse } from '@/hooks'
 */

export { useChat } from './useChat'
export type { UseChatOptions, UseChatReturn } from './useChat'

export { useFileProcessor } from './useFileProcessor'
export type { FileProcessorResult, UseFileProcessorReturn } from './useFileProcessor'

export {
  useGeolocation,
  buildUserLocation,
  getUserLocationFromTimezone,
} from './useGeolocation'
export type { GeolocationData } from './useGeolocation'

export {
  useStreamResponse,
  buildMessageFromStreamState,
} from './useStreamResponse'
export type {
  StreamError,
  StreamState,
  StreamCallbacks,
  UseStreamResponseReturn,
} from './useStreamResponse'

