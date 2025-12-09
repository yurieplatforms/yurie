/**
 * Composio Integration Module
 *
 * Provides utilities for authenticating users and accessing Composio tools.
 * Supports Gmail and Spotify integration.
 *
 * @see https://docs.composio.dev/docs/quickstart
 *
 * @example
 * // Connect a user to Gmail
 * import { connectUserAccount, isUserConnected } from '@/lib/ai/integrations/composio'
 *
 * const request = await connectUserAccount(userId)
 * // Redirect user to: request.redirectUrl
 * const account = await request.waitForConnection()
 *
 * @example
 * // Connect a user to Spotify
 * const request = await connectUserAccount(userId, { app: 'spotify' })
 *
 * @example
 * // Get Gmail tools for an agent
 * import { getGmailTools, GmailTools } from '@/lib/ai/integrations/composio'
 *
 * const tools = await getGmailTools(userId, [
 *   GmailTools.SEND_EMAIL,
 *   GmailTools.FETCH_EMAILS,
 * ])
 *
 * @example
 * // Get Spotify tools for an agent
 * import { getSpotifyTools, SpotifyTools } from '@/lib/ai/integrations/composio'
 *
 * const tools = await getSpotifyTools(userId, [
 *   SpotifyTools.SEARCH,
 *   SpotifyTools.START_RESUME_PLAYBACK,
 * ])
 */

// Re-export types
export type {
  ConnectionStatus,
  ConnectedAccount,
  ConnectionRequest,
  ComposioTool,
  GetToolsOptions,
} from './types'

// Client
export {
  getComposioClient,
  getComposioProvider,
  getComposioResponsesProvider,
  getComposioAgentsProvider,
  handleToolCalls,
  type ProviderType,
} from './client'

// Authentication
export {
  connectUserAccount,
  getConnectedAccount,
  listConnectedAccounts,
  isUserConnected,
  disconnectAccount,
  getAuthConfigId,
  ConnectionStatuses,
  type ComposioApp,
} from './auth'

// Tools
export {
  getTools,
  getGmailTools,
  getGmailToolsForAgents,
  getGmailToolsByGroup,
  getSpotifyTools,
  getSpotifyToolsForAgents,
  getSpotifyToolsByGroup,
  getGitHubTools,
  getGitHubToolsForAgents,
  getGitHubToolsByGroup,
  getToolkitTools,
  searchTools,
  getToolSchemas,
  GmailTools,
  GmailToolGroups,
  DEFAULT_GMAIL_TOOLS,
  SpotifyTools,
  SpotifyToolGroups,
  DEFAULT_SPOTIFY_TOOLS,
  GitHubTools,
  GitHubToolGroups,
  DEFAULT_GITHUB_TOOLS,
  type GmailToolName,
  type SpotifyToolName,
  type GitHubToolName,
} from './tools'

// Agents
export {
  createEmailAgent,
  createEmailComposerAgent,
  createEmailSearchAgent,
  createCustomAgent,
  runEmailAgent,
  runAgent,
  AgentInstructions,
  type AgentConfig,
  type EmailAgentResult,
} from './agents'
