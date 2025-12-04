/**
 * Runnable Tools
 *
 * Creates tool definitions with run functions for the Anthropic SDK's tool runner.
 * Uses betaTool helper for type-safe tool definitions.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
 */

import type { SSEHandler } from './sse-handler'
import { getCalculatorTool } from '@/agent/tools/calculator'
import { getExaTools } from '@/agent/tools/exa'
import { getGitHubTools } from '@/agent/tools/github'
import { getSpotifyTools } from '@/agent/tools/spotify'
import type { FocusedRepoContext } from '@/agent/tools/types'

// Helper to avoid TypeScript's overly complex union type error with large tool arrays
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createToolsArray = (...tools: any[]): any[] => tools.flat()

/**
 * Creates runnable tools with access to SSE handlers for real-time updates.
 * Optionally sets up GitHub context for authenticated users.
 *
 * @param sseHandler - SSE handler for streaming tool events
 * @param userId - Optional user ID for GitHub tool context
 * @param focusedRepo - Optional focused repository for default context
 * @param enableToolSearch - Whether to defer loading of large toolsets (default: true)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createRunnableTools(
  sseHandler: SSEHandler, 
  userId?: string,
  focusedRepo?: FocusedRepoContext | null,
  enableToolSearch: boolean = true
): Promise<any[]> {
  const [githubTools, spotifyTools] = await Promise.all([
    getGitHubTools(sseHandler, userId, focusedRepo),
    getSpotifyTools(sseHandler, userId)
  ])

  // Helper to defer tools if tool search is enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeDefer = (tools: any[]) => {
    if (!enableToolSearch) return tools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return tools.map((tool: any) => ({ ...tool, defer_loading: true }))
  }

  return createToolsArray(
    // Calculator tool - Keep active (lightweight, frequently used)
    getCalculatorTool(sseHandler),

    // EXA search tools - Defer if tool search enabled
    ...maybeDefer(getExaTools(sseHandler)),

    // GitHub Tools - Defer if tool search enabled (large set)
    ...maybeDefer(githubTools),

    // Spotify tools - Defer if tool search enabled (large set)
    ...maybeDefer(spotifyTools)
  )
}

export type { FocusedRepoContext }
