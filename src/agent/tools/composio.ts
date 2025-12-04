import { getComposioAnthropicClient } from '@/services/composio/client'
import { findGitHubConnectionId, formatRepoForLLM, formatIssuesForLLM, formatPRsForLLM, formatCommitsForLLM } from '@/services/composio/github'
import { findSpotifyConnectionId, formatTrackForLLM, formatAlbumForLLM, formatArtistForLLM, formatPlaylistForLLM, formatPlaybackForLLM, formatSearchResultsForLLM } from '@/services/composio/spotify'
import type { SSEHandler } from '@/agent/sse-handler'
import type { FocusedRepoContext } from '@/agent/tools/types'

// Map of tool names to their formatter functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolFormatters: Record<string, (data: any) => string> = {
  // GitHub
  'GITHUB_GET_A_REPOSITORY': formatRepoForLLM,
  'GITHUB_LIST_REPOSITORY_ISSUES': formatIssuesForLLM,
  'GITHUB_LIST_PULL_REQUESTS': formatPRsForLLM,
  'GITHUB_LIST_COMMITS': formatCommitsForLLM,
  
  // Spotify
  'SPOTIFY_GET_PLAYBACK_STATE': formatPlaybackForLLM,
  'SPOTIFY_GET_CURRENTLY_PLAYING_TRACK': formatPlaybackForLLM,
  'SPOTIFY_GET_TRACK': formatTrackForLLM,
  'SPOTIFY_GET_ALBUM': formatAlbumForLLM,
  'SPOTIFY_GET_ARTIST': formatArtistForLLM,
  'SPOTIFY_GET_PLAYLIST': formatPlaylistForLLM,
  'SPOTIFY_SEARCH_FOR_ITEM': formatSearchResultsForLLM,
}

/**
 * Fetches and wraps Composio tools for the Anthropic agent.
 * 
 * - Fetches dynamic tools based on provided toolkits
 * - Injects context (like focused repository) into schemas and execution
 * - Wraps execution to emit SSE events for UI updates
 * - Applies formatters to outputs for better LLM readability
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getComposioTools(
  sseHandler: SSEHandler,
  userId?: string,
  focusedRepo?: FocusedRepoContext | null,
  toolkits: string[] = ['github', 'spotify']
): Promise<any[]> {
  const client = getComposioAnthropicClient()
  if (!client || !userId) return []

  try {
    // Fetch tools from Composio
    // Note: We use the userId here to get tools configured for this user if applicable
    const tools = await client.tools.get(userId, {
      toolkits,
    })

    // Find connection IDs once to avoid lookups on every tool call
    // These might fail if user hasn't connected accounts, which is fine (tools will handle it or fail gracefully)
    const [githubConnectionId, spotifyConnectionId] = await Promise.all([
      findGitHubConnectionId(userId),
      findSpotifyConnectionId(userId)
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return tools.map((tool: any) => {
      // Clone tool to avoid mutation issues with internal SDK state
      const wrappedTool = { ...tool }
      const toolName = tool.name

      // --- Context Injection ---
      
      // Inject GitHub focused repo context
      if (focusedRepo && toolName.startsWith('GITHUB_')) {
        // Modify description to mention default
        wrappedTool.description = `${wrappedTool.description} Defaults to focused repo: ${focusedRepo.fullName} if owner/repo not provided.`
        
        // Make owner/repo optional in schema if they exist
        if (wrappedTool.input_schema?.required) {
          wrappedTool.input_schema.required = wrappedTool.input_schema.required.filter(
            (field: string) => field !== 'owner' && field !== 'repo'
          )
        }
      }

      // --- Execution Wrapper ---
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wrappedTool.run = async (input: any) => {
        const connectionId = toolName.startsWith('GITHUB_') ? githubConnectionId : 
                             toolName.startsWith('SPOTIFY_') ? spotifyConnectionId : undefined

        // Merge defaults for GitHub tools
        const finalInput = { ...input }
        if (focusedRepo && toolName.startsWith('GITHUB_')) {
          if (!finalInput.owner) finalInput.owner = focusedRepo.owner
          if (!finalInput.repo) finalInput.repo = focusedRepo.name
        }

        // Emit start event
        await sseHandler.sendToolEvent(toolName, 'start', finalInput)

        try {
          // Execute tool via Composio SDK
          const result = await client.tools.execute(toolName, {
            userId,
            arguments: finalInput,
            connectedAccountId: connectionId,
            dangerouslySkipVersionCheck: true,
          } as any)

          // Handle error result from SDK
          if (!result.successful) {
             const errorMsg = result.error || 'Unknown error'
             await sseHandler.sendToolEvent(toolName, 'end', finalInput, `Error: ${errorMsg}`)
             return `Error executing ${toolName}: ${errorMsg}`
          }

          // Format output
          let formattedOutput = JSON.stringify(result.data)
          const formatter = toolFormatters[toolName]
          if (formatter && result.data) {
            try {
              formattedOutput = formatter(result.data)
            } catch (e) {
              console.error(`Error formatting output for ${toolName}:`, e)
              // Fallback to JSON if formatting fails
            }
          }

          // Emit end event with result
          await sseHandler.sendToolEvent(toolName, 'end', finalInput, formattedOutput)
          
          return formattedOutput

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          await sseHandler.sendToolEvent(toolName, 'end', finalInput, `Error: ${errorMsg}`)
          return `Error executing ${toolName}: ${errorMsg}`
        }
      }

      return wrappedTool
    })

  } catch (error) {
    console.error('Failed to fetch Composio tools:', error)
    return []
  }
}

