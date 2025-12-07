/**
 * Runnable Tools
 *
 * Creates tool definitions with run functions.
 */

import {
  isGitHubToolsAvailable,
  setGitHubToolContext,
  findGitHubConnectionId,
  getRepository,
} from '@/lib/composio'
import type { SSEHandler } from './sse-handler'

/**
 * Focused repository context for GitHub tools.
 * When set, tools can use these defaults for owner/repo parameters.
 */
export type FocusedRepoContext = {
  owner: string
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  private: boolean
  language: string | null
  defaultBranch: string
}

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
  // Suppress unused parameter warnings
  void sseHandler
  void focusedRepo
  
  const tools = []

  // GitHub Tools (via Composio)
  if (isGitHubToolsAvailable() && userId) {
    // Set up the GitHub tool context
    if (userId) {
      // Find the connected account ID for GitHub
      const connectionId = await findGitHubConnectionId(userId)
      
      setGitHubToolContext({
        userId,
        connectedAccountId: connectionId,
      })
    }

    tools.push({
      type: 'function',
      function: {
        name: 'github_get_repo',
        description: 'Get repository information',
        parameters: {
          type: 'object',
          properties: {
            owner: { type: 'string' },
            repo: { type: 'string' }
          },
          required: ['owner', 'repo']
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      run: async ({ input }: { input: any }) => {
        const result = await getRepository(input)
        return result.data
      }
    })
  }

  return tools
}
