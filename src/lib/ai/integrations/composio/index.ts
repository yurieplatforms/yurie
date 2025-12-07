/**
 * Composio Integration Module
 *
 * Provides utilities for authenticating users and accessing Composio tools.
 * Supports Gmail integration for sending/receiving emails on behalf of users.
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
 * // Get Gmail tools for an agent
 * import { getGmailTools, GmailTools } from '@/lib/ai/integrations/composio'
 *
 * const tools = await getGmailTools(userId, [
 *   GmailTools.SEND_EMAIL,
 *   GmailTools.FETCH_EMAILS,
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
  ConnectionStatuses,
} from './auth'

// Tools
export {
  getTools,
  getGmailTools,
  getGmailToolsForAgents,
  getGmailToolsByGroup,
  getToolkitTools,
  searchTools,
  getToolSchemas,
  GmailTools,
  GmailToolGroups,
  DEFAULT_GMAIL_TOOLS,
  type GmailToolName,
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
