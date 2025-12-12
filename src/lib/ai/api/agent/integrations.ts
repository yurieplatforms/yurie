/**
 * Agent integration tool loading
 *
 * Responsible for fetching per-user Composio tool definitions.
 */

import { getDefaultToolsForIntegration, GITHUB_TOOLS, SPOTIFY_TOOLS } from '@/lib/ai/agent'
import { isUserConnected } from '@/lib/ai/integrations/composio/auth'
import { getTools } from '@/lib/ai/integrations/composio/tools'
import type { ComposioTool } from '@/lib/ai/integrations/composio/types'

export type LoadedIntegrationTools = {
  gmailTools: ComposioTool[]
  spotifyTools: ComposioTool[]
  githubTools: ComposioTool[]
  enabledCapabilities: string[]
}

const GMAIL_TOOL_IDS = getDefaultToolsForIntegration('gmail')
const SPOTIFY_TOOL_IDS = Object.keys(SPOTIFY_TOOLS)
const GITHUB_TOOL_IDS = Object.keys(GITHUB_TOOLS)

async function loadToolsForApp(
  userId: string,
  app: 'gmail' | 'spotify' | 'github',
  toolIds: string[],
): Promise<ComposioTool[]> {
  const connected = await isUserConnected(userId, app)

  if (!connected) {
    console.log(`[agent] User not connected to ${app}, skipping ${app} tools`)
    return []
  }

  console.log(`[agent] Fetching ${app} tools from Composio for user:`, userId)
  const tools = await getTools(userId, { tools: toolIds }, 'responses')
  console.log(`[agent] Loaded ${app} tools:`, tools.length)
  return tools
}

export async function loadIntegrationTools(options: {
  userId: string | null
  selectedTools: string[]
}): Promise<LoadedIntegrationTools> {
  const selected = new Set(options.selectedTools)

  let gmailTools: ComposioTool[] = []
  let spotifyTools: ComposioTool[] = []
  let githubTools: ComposioTool[] = []

  if (!options.userId) {
    return { gmailTools, spotifyTools, githubTools, enabledCapabilities: [] }
  }

  if (selected.has('gmail')) {
    try {
      gmailTools = await loadToolsForApp(options.userId, 'gmail', GMAIL_TOOL_IDS)
    } catch (error) {
      console.error('[agent] Failed to fetch Gmail tools:', error)
    }
  }

  if (selected.has('spotify')) {
    try {
      spotifyTools = await loadToolsForApp(
        options.userId,
        'spotify',
        SPOTIFY_TOOL_IDS,
      )
    } catch (error) {
      console.error('[agent] Failed to fetch Spotify tools:', error)
    }
  }

  if (selected.has('github')) {
    try {
      githubTools = await loadToolsForApp(options.userId, 'github', GITHUB_TOOL_IDS)
    } catch (error) {
      console.error('[agent] Failed to fetch GitHub tools:', error)
    }
  }

  const enabledCapabilities: string[] = []
  if (gmailTools.length > 0) enabledCapabilities.push('gmail')
  if (spotifyTools.length > 0) enabledCapabilities.push('spotify')
  if (githubTools.length > 0) enabledCapabilities.push('github')

  return { gmailTools, spotifyTools, githubTools, enabledCapabilities }
}

