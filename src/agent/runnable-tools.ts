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
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createRunnableTools(
  sseHandler: SSEHandler, 
  userId?: string,
  focusedRepo?: FocusedRepoContext | null
): Promise<any[]> {
  const [githubTools, spotifyTools] = await Promise.all([
    getGitHubTools(sseHandler, userId, focusedRepo),
    getSpotifyTools(sseHandler, userId)
  ])

  return createToolsArray(
    // Calculator tool
    getCalculatorTool(sseHandler),

    // EXA search tools
    ...getExaTools(sseHandler),

    // GitHub Tools
    ...githubTools,

    // Spotify tools
    ...spotifyTools
  )
}

export type { FocusedRepoContext }
