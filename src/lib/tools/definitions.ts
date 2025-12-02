/**
 * Tool Definitions
 *
 * Defines all tools available to the AI agent, including:
 * - Server-side tools (executed by Anthropic): web_search, web_fetch
 * - Client-side tools (executed by us): calculator, memory
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
 *
 * @module lib/tools/definitions
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { WebSearchUserLocation } from '@/lib/types'

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Represents a tool use block from Claude's response
 */
export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/**
 * Represents a tool result to send back to Claude
 */
export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

/** Server-side tools executed by Anthropic's infrastructure */
export type ServerToolType = 'web_search' | 'web_fetch'

/** Client-side tools executed by our application */
export type ClientToolType = 'calculator' | 'memory' | 'exa_search'

/** GitHub tools via Composio */
export type GitHubToolType =
  // Read tools
  | 'github_get_repo'
  | 'github_get_readme'
  | 'github_get_file'
  | 'github_get_tree'
  | 'github_list_branches'
  | 'github_list_releases'
  | 'github_get_latest_release'
  | 'github_list_contributors'
  // Issues
  | 'github_list_issues'
  | 'github_get_issue'
  | 'github_create_issue'
  | 'github_update_issue'
  | 'github_add_comment'
  | 'github_list_issue_comments'
  | 'github_add_labels'
  // Pull requests
  | 'github_list_prs'
  | 'github_get_pr'
  | 'github_create_pr'
  | 'github_review_pr'
  | 'github_merge_pr'
  | 'github_list_pr_files'
  // Commits
  | 'github_list_commits'
  // Search
  | 'github_search_repos'
  | 'github_search_issues'
  | 'github_search_code'
  // Repository actions
  | 'github_star_repo'
  | 'github_unstar_repo'
  | 'github_fork_repo'
  | 'github_watch_repo'
  // User
  | 'github_get_me'
  // Workflows
  | 'github_list_workflows'
  | 'github_list_workflow_runs'
  | 'github_trigger_workflow'

/** All tool types available to the agent */
export type ToolName = ServerToolType | ClientToolType | GitHubToolType

// ============================================================================
// Web Search Tool Configuration
// ============================================================================

/**
 * Configuration options for the web search tool.
 *
 * The web search tool gives Claude direct access to real-time web content,
 * allowing it to answer questions with up-to-date information beyond its
 * knowledge cutoff. Claude automatically cites sources from search results.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 *
 * @example
 * ```ts
 * // Basic configuration
 * const config: WebSearchToolConfig = {
 *   maxUses: 5,
 * }
 *
 * // With localization
 * const localizedConfig: WebSearchToolConfig = {
 *   maxUses: 5,
 *   userLocation: {
 *     type: 'approximate',
 *     city: 'San Francisco',
 *     region: 'California',
 *     country: 'US',
 *     timezone: 'America/Los_Angeles',
 *   },
 * }
 *
 * // With domain filtering
 * const filteredConfig: WebSearchToolConfig = {
 *   maxUses: 5,
 *   allowedDomains: ['example.com', 'trusteddomain.org'],
 * }
 * ```
 */
export type WebSearchToolConfig = {
  /**
   * Maximum number of searches allowed per request.
   *
   * If Claude attempts more searches than allowed, the web_search_tool_result
   * will be an error with the `max_uses_exceeded` error code.
   *
   * @default 5
   */
  maxUses?: number

  /**
   * User location for localized search results.
   *
   * Allows search results to be localized based on the user's approximate location.
   * All fields are optional and represent approximate location data.
   *
   * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
   */
  userLocation?: WebSearchUserLocation

  /**
   * Only include search results from these domains.
   *
   * Rules:
   * - Domains should NOT include HTTP/HTTPS scheme (use `example.com` not `https://example.com`)
   * - Subdomains are automatically included (`example.com` covers `docs.example.com`)
   * - Specific subdomains restrict to only that subdomain
   * - Subpaths are supported (`example.com/blog`)
   *
   * **Note: Cannot be used together with `blockedDomains`**
   *
   * @example ['example.com', 'trusteddomain.org']
   */
  allowedDomains?: string[]

  /**
   * Never include search results from these domains.
   *
   * Rules:
   * - Domains should NOT include HTTP/HTTPS scheme
   * - Subdomains are automatically included
   * - Specific subdomains restrict blocking to only that subdomain
   * - Subpaths are supported
   *
   * **Note: Cannot be used together with `allowedDomains`**
   *
   * @example ['untrustedsource.com', 'spam-site.com']
   */
  blockedDomains?: string[]
}

/**
 * Creates a web search tool with optional configuration.
 *
 * The web search tool enables Claude to search the web for real-time information.
 * It uses Anthropic's `web_search_20250305` tool type which handles the search
 * execution and returns results with automatic citations.
 *
 * ## How it works
 * 1. Claude decides when to search based on the prompt
 * 2. Anthropic's API executes the searches and provides results
 * 3. Claude provides a response with cited sources
 *
 * ## Supported models
 * - Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
 * - Claude Sonnet 4 (`claude-sonnet-4-20250514`)
 * - Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
 * - Claude Haiku 3.5 (`claude-3-5-haiku-latest`)
 * - Claude Opus 4.5 (`claude-opus-4-5-20251101`)
 * - Claude Opus 4.1 (`claude-opus-4-1-20250805`)
 * - Claude Opus 4 (`claude-opus-4-20250514`)
 *
 * ## Pricing
 * Web search is $10 per 1,000 searches, plus standard token costs.
 * Search results are counted as input tokens.
 *
 * @param config - Optional configuration for the web search tool
 * @returns Anthropic tool definition for web search
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 *
 * @example
 * ```ts
 * // Basic usage
 * const webSearchTool = createWebSearchTool()
 *
 * // With user location for localized results
 * const localizedTool = createWebSearchTool({
 *   maxUses: 5,
 *   userLocation: {
 *     type: 'approximate',
 *     city: 'New York',
 *     region: 'New York',
 *     country: 'US',
 *     timezone: 'America/New_York',
 *   },
 * })
 *
 * // With domain restrictions
 * const restrictedTool = createWebSearchTool({
 *   maxUses: 3,
 *   allowedDomains: ['wikipedia.org', 'britannica.com'],
 * })
 * ```
 */
export function createWebSearchTool(config: WebSearchToolConfig = {}): Anthropic.Tool {
  const tool: Record<string, unknown> = {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: config.maxUses ?? 5,
  }

  // Add user location for localized search results
  // @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
  if (config.userLocation) {
    tool.user_location = config.userLocation
  }

  // Add domain filtering (can only use one at a time per API requirements)
  // @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#domain-filtering
  if (config.allowedDomains && config.allowedDomains.length > 0) {
    tool.allowed_domains = config.allowedDomains
  } else if (config.blockedDomains && config.blockedDomains.length > 0) {
    tool.blocked_domains = config.blockedDomains
  }

  return tool as unknown as Anthropic.Tool
}

/**
 * Creates server tools with optional web search configuration.
 *
 * Use this factory function when you need to customize the web search tool,
 * such as passing user location for localized search results or adding
 * domain filtering.
 *
 * ## Included tools
 * - **web_search**: Real-time web search with citations
 * - **web_fetch**: Fetch full content from web pages and PDFs
 *
 * @param webSearchConfig - Optional configuration for the web search tool
 * @returns Array of server-side tools for the API request
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 *
 * @example
 * ```ts
 * // With user location for localized results
 * const tools = createServerTools({
 *   userLocation: {
 *     type: 'approximate',
 *     city: 'San Francisco',
 *     region: 'California',
 *     country: 'US',
 *     timezone: 'America/Los_Angeles',
 *   },
 * })
 *
 * // With domain restrictions
 * const restrictedTools = createServerTools({
 *   blockedDomains: ['unreliable-source.com'],
 * })
 * ```
 */
export function createServerTools(
  webSearchConfig?: WebSearchToolConfig,
): Anthropic.Tool[] {
  return [
    createWebSearchTool(webSearchConfig),
    // Web fetch tool - Retrieves full content from web pages and PDFs
    // @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
    {
      type: 'web_fetch_20250910',
      name: 'web_fetch',
      max_uses: 5,
      max_content_tokens: 50000,
      citations: { enabled: true },
      defer_loading: false, // Always load upfront, don't defer to Tool Search Tool
    } as unknown as Anthropic.Tool,
  ]
}
