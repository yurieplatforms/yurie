/**
 * Composio Tools Utilities
 *
 * Provides access to Composio tools for use with AI agents.
 * 
 * Supports two providers:
 * - OpenAI Responses Provider: For standard OpenAI SDK (responses.create)
 * - OpenAI Agents Provider: For @openai/agents SDK (Agent, run)
 *
 * @see https://docs.composio.dev/docs/fetching-tools
 * @see https://docs.composio.dev/providers/openai
 * @see https://docs.composio.dev/providers/openai-agents
 */

import { getComposioClient, type ProviderType } from './client'
import type { ComposioTool, GetToolsOptions } from './types'

export type { ComposioTool }

/**
 * Available Gmail tools
 *
 * @see https://docs.composio.dev/providers/gmail
 */
export const GmailTools = {
  /** Send an email */
  SEND_EMAIL: 'GMAIL_SEND_EMAIL',
  /** Fetch emails from mailbox */
  FETCH_EMAILS: 'GMAIL_FETCH_EMAILS',
  /** Get a specific email by ID */
  GET_EMAIL: 'GMAIL_GET_EMAIL',
  /** Create an email draft */
  CREATE_DRAFT: 'GMAIL_CREATE_EMAIL_DRAFT',
  /** Search emails with query */
  SEARCH_EMAILS: 'GMAIL_SEARCH_EMAILS',
  /** Reply to an email */
  REPLY_TO_EMAIL: 'GMAIL_REPLY_TO_EMAIL',
  /** Forward an email */
  FORWARD_EMAIL: 'GMAIL_FORWARD_EMAIL',
  /** List email labels */
  LIST_LABELS: 'GMAIL_LIST_LABELS',
  /** Get email attachments */
  GET_ATTACHMENTS: 'GMAIL_GET_ATTACHMENTS',
  /** Trash an email */
  TRASH_EMAIL: 'GMAIL_TRASH_EMAIL',
  /** Archive an email */
  ARCHIVE_EMAIL: 'GMAIL_ARCHIVE_EMAIL',
  /** Mark email as read */
  MARK_AS_READ: 'GMAIL_MARK_AS_READ',
  /** Mark email as unread */
  MARK_AS_UNREAD: 'GMAIL_MARK_AS_UNREAD',
} as const

export type GmailToolName = (typeof GmailTools)[keyof typeof GmailTools]

/**
 * Default Gmail tools for common email operations
 */
export const DEFAULT_GMAIL_TOOLS: GmailToolName[] = [
  GmailTools.SEND_EMAIL,
  GmailTools.FETCH_EMAILS,
  GmailTools.GET_EMAIL,
  GmailTools.CREATE_DRAFT,
  GmailTools.SEARCH_EMAILS,
]

/**
 * Gmail tools grouped by operation type
 */
export const GmailToolGroups = {
  /** Tools for sending/composing emails */
  compose: [
    GmailTools.SEND_EMAIL,
    GmailTools.CREATE_DRAFT,
    GmailTools.REPLY_TO_EMAIL,
    GmailTools.FORWARD_EMAIL,
  ] as GmailToolName[],
  /** Tools for reading emails */
  read: [
    GmailTools.FETCH_EMAILS,
    GmailTools.GET_EMAIL,
    GmailTools.SEARCH_EMAILS,
    GmailTools.GET_ATTACHMENTS,
  ] as GmailToolName[],
  /** Tools for organizing emails */
  organize: [
    GmailTools.TRASH_EMAIL,
    GmailTools.ARCHIVE_EMAIL,
    GmailTools.MARK_AS_READ,
    GmailTools.MARK_AS_UNREAD,
    GmailTools.LIST_LABELS,
  ] as GmailToolName[],
}

/**
 * Get specific tools from Composio for a user
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param options - Tool fetching options
 * @param providerType - Which provider to use ('responses' or 'agents')
 * @returns Array of tools ready for use with agents
 *
 * @example
 * // Get specific tools by name (default: responses provider)
 * const tools = await getTools('user-123', { tools: ['GMAIL_SEND_EMAIL', 'GMAIL_FETCH_EMAILS'] })
 *
 * @example
 * // Get tools for OpenAI Agents SDK
 * const tools = await getTools('user-123', { tools: ['GMAIL_SEND_EMAIL'] }, 'agents')
 *
 * @see https://docs.composio.dev/docs/fetching-tools#filtering-tools
 */
export async function getTools(
  externalUserId: string,
  options: GetToolsOptions,
  providerType: ProviderType = 'responses'
): Promise<ComposioTool[]> {
  const composio = getComposioClient(providerType)

  // Build the filter params based on what's provided
  // The SDK has different overloads, we need to match the right one
  if (options.tools && options.tools.length > 0) {
    // Use tools filter
    const tools = await composio.tools.get(externalUserId, {
      tools: options.tools,
    })
    return tools as ComposioTool[]
  }

  if (options.toolkits && options.toolkits.length > 0) {
    // Use toolkits filter
    const tools = await composio.tools.get(externalUserId, {
      toolkits: options.toolkits,
    })
    return tools as ComposioTool[]
  }

  if (options.search) {
    // Use search filter
    const tools = await composio.tools.get(externalUserId, {
      search: options.search,
    })
    return tools as ComposioTool[]
  }

  // Default: return empty array if no filters provided
  return []
}

/**
 * Get Gmail-specific tools for a user (uses Responses provider by default)
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolNames - Optional specific Gmail tools to fetch (defaults to DEFAULT_GMAIL_TOOLS)
 * @param options - Additional options including provider type
 * @returns Array of Gmail tools ready for use with agents
 *
 * @example
 * // Get default Gmail tools (for Responses API)
 * const tools = await getGmailTools('user-123')
 *
 * @example
 * // Get specific tools
 * const tools = await getGmailTools('user-123', ['GMAIL_SEND_EMAIL', 'GMAIL_FETCH_EMAILS'])
 *
 * @example
 * // Get compose tools only
 * const tools = await getGmailTools('user-123', GmailToolGroups.compose)
 */
export async function getGmailTools(
  externalUserId: string,
  toolNames: GmailToolName[] = DEFAULT_GMAIL_TOOLS,
  options?: { limit?: number; provider?: ProviderType }
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    tools: toolNames,
  }, options?.provider ?? 'responses')
}

/**
 * Get Gmail-specific tools for use with @openai/agents SDK
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolNames - Optional specific Gmail tools to fetch (defaults to DEFAULT_GMAIL_TOOLS)
 * @returns Array of Gmail tools formatted for OpenAI Agents SDK
 *
 * @example
 * import { Agent, run } from '@openai/agents'
 * const tools = await getGmailToolsForAgents('user-123')
 * const agent = new Agent({ tools })
 * const result = await run(agent, 'Send an email...')
 */
export async function getGmailToolsForAgents(
  externalUserId: string,
  toolNames: GmailToolName[] = DEFAULT_GMAIL_TOOLS
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    tools: toolNames,
  }, 'agents')
}

/**
 * Get Gmail tools by group
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param group - Tool group: 'compose', 'read', or 'organize'
 * @returns Array of Gmail tools for the specified group
 *
 * @example
 * const readTools = await getGmailToolsByGroup('user-123', 'read')
 */
export async function getGmailToolsByGroup(
  externalUserId: string,
  group: keyof typeof GmailToolGroups
): Promise<ComposioTool[]> {
  return getGmailTools(externalUserId, GmailToolGroups[group])
}

/**
 * Get tools from any toolkit
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolkit - Toolkit name (e.g., 'GMAIL', 'SLACK', 'GITHUB')
 * @param options - Additional options
 * @returns Array of tools from the specified toolkit
 *
 * @example
 * // Get GitHub tools
 * const tools = await getToolkitTools('user-123', 'GITHUB')
 *
 * @see https://docs.composio.dev/docs/fetching-tools#by-toolkit
 */
export async function getToolkitTools(
  externalUserId: string,
  toolkit: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: { limit?: number; scopes?: string[] }
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    toolkits: [toolkit],
  })
}

/**
 * Search for tools semantically (experimental)
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param query - Natural language search query
 * @param options - Additional options
 * @returns Array of matching tools
 *
 * @example
 * const tools = await searchTools('user-123', 'send email')
 *
 * @see https://docs.composio.dev/docs/fetching-tools#by-search-experimental
 */
export async function searchTools(
  externalUserId: string,
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: { toolkit?: string; limit?: number }
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    search: query,
  })
}

/**
 * Get raw tool schemas without user context
 * Useful for inspecting tool parameters and types
 *
 * @param toolNames - Tool names to get schemas for
 * @returns Array of tool schemas
 *
 * @see https://docs.composio.dev/docs/fetching-tools#tool-schemas
 */
export async function getToolSchemas(
  toolNames: string[]
): Promise<ComposioTool[]> {
  const composio = getComposioClient()

  // Note: This may require using a different SDK method in production
  // The current implementation uses the tools.get method without a user
  const tools = await composio.tools.get('schema-only', {
    tools: toolNames,
  })

  return tools as ComposioTool[]
}
