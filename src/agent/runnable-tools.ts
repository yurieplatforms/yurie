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
import { getComposioTools } from '@/agent/tools/composio'
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
  enableToolSearch: boolean = true,
  selectedTools?: string[]
): Promise<any[]> {
  // Fetch dynamic tools from Composio (GitHub, Spotify)
  const composioTools = await getComposioTools(sseHandler, userId, focusedRepo)

  // Helper to defer tools if tool search is enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeDefer = (tools: any[]) => {
    if (!enableToolSearch) return tools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return tools.map((tool: any) => ({ ...tool, defer_loading: true }))
  }

  // Filter composio tools based on selectedTools if provided
  // GitHub tools usually start with "github_" and Spotify with "spotify_"
  // The UI sends "github" and "spotify" as IDs
  let filteredComposioTools = composioTools;
  
  console.log(`[RunnableTools] Fetched ${composioTools.length} Composio tools`)
  
  if (selectedTools && selectedTools.length > 0) {
     console.log(`[RunnableTools] Filtering tools for selected: ${selectedTools.join(', ')}`)
     
     filteredComposioTools = composioTools.filter((tool: any) => {
        const name = tool.name.toLowerCase();
        // Check if tool matches any selected tool ID
        // GitHub tools: github_issues_create, etc.
        // Spotify tools: spotify_play, etc.
        if (name.startsWith('github_') && selectedTools.includes('github')) return true;
        if (name.startsWith('spotify_') && selectedTools.includes('spotify')) return true;
        // If it doesn't match known prefixes but was returned by composio, default to exclude if selection exists
        return false; 
     });
     
     console.log(`[RunnableTools] After filtering: ${filteredComposioTools.length} tools remaining`)
     if (filteredComposioTools.length === 0 && composioTools.length > 0) {
       console.warn(`[RunnableTools] Warning: All Composio tools were filtered out. Original tools: ${composioTools.map((t: any) => t.name).join(', ')}`)
     }
  } else {
     console.log('[RunnableTools] No tool filtering applied - using all Composio tools')
  }

  return createToolsArray(
    // Calculator tool - Keep active (lightweight, frequently used)
    getCalculatorTool(sseHandler),

    // EXA search tools - Defer if tool search enabled
    ...maybeDefer(getExaTools(sseHandler)),

    // Composio Tools (GitHub, Spotify) - Defer if tool search enabled
    ...maybeDefer(filteredComposioTools)
  )
}

export type { FocusedRepoContext }
