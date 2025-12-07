/**
 * Runnable Tools
 *
 * Creates tool definitions with run functions.
 */

import type { SSEHandler } from './sse-handler'

/**
 * Creates runnable tools with access to SSE handlers for real-time updates.
 *
 * @param sseHandler - SSE handler for streaming tool events
 * @param userId - Optional user ID for tool context
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createRunnableTools(
  sseHandler: SSEHandler,
  userId?: string
): Promise<any[]> {
  // Suppress unused parameter warnings
  void sseHandler
  void userId
  
  const tools: any[] = []

  // Additional tools can be added here as needed

  return tools
}
