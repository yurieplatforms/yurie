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
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
 *
 * @module lib/tools/definitions
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { WebSearchUserLocation } from '@/types'

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
 * Represents a server tool use block (for tool search)
 */
export type ServerToolUseBlock = {
  type: 'server_tool_use'
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
  content: string | Array<Record<string, unknown>>
  is_error?: boolean
}

/** Server-side tools executed by Anthropic's infrastructure */
export type ServerToolType = 'web_search' | 'web_fetch' | 'tool_search_tool_bm25_20251119' | 'tool_search_tool_regex_20251119'

/** Client-side tools executed by us */
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

/** Spotify tools via Composio */
export type SpotifyToolType =
  // Playback
  | 'spotify_get_playback_state'
  | 'spotify_get_currently_playing'
  | 'spotify_start_playback'
  | 'spotify_pause_playback'
  | 'spotify_skip_next'
  | 'spotify_skip_previous'
  | 'spotify_seek'
  | 'spotify_set_volume'
  | 'spotify_set_repeat'
  | 'spotify_toggle_shuffle'
  | 'spotify_transfer_playback'
  | 'spotify_get_devices'
  // Queue
  | 'spotify_get_queue'
  | 'spotify_add_to_queue'
  // Search
  | 'spotify_search'
  // Tracks
  | 'spotify_get_track'
  | 'spotify_get_track_features'
  // Albums
  | 'spotify_get_album'
  | 'spotify_get_album_tracks'
  | 'spotify_get_new_releases'
  // Artists
  | 'spotify_get_artist'
  | 'spotify_get_artist_top_tracks'
  | 'spotify_get_artist_albums'
  | 'spotify_get_related_artists'
  // Playlists
  | 'spotify_get_playlist'
  | 'spotify_get_playlist_tracks'
  | 'spotify_create_playlist'
  | 'spotify_add_tracks_to_playlist'
  | 'spotify_remove_playlist_items'
  | 'spotify_update_playlist_details'
  | 'spotify_reorder_playlist_items'
  | 'spotify_get_my_playlists'
  | 'spotify_get_user_playlists'
  | 'spotify_get_featured_playlists'
  | 'spotify_get_category_playlists'
  | 'spotify_follow_playlist'
  | 'spotify_unfollow_playlist'
  // Library
  | 'spotify_get_saved_tracks'
  | 'spotify_save_tracks'
  | 'spotify_remove_saved_tracks'
  | 'spotify_check_saved_tracks'
  | 'spotify_get_saved_albums'
  | 'spotify_save_albums'
  | 'spotify_remove_saved_albums'
  | 'spotify_get_top_artists'
  | 'spotify_get_top_tracks'
  | 'spotify_get_recently_played'
  // User
  | 'spotify_get_my_profile'
  // Browse
  | 'spotify_get_recommendations'
  | 'spotify_get_genres'
  | 'spotify_get_categories'

/** All tool types available to the agent */
export type ToolName = ServerToolType | ClientToolType | GitHubToolType | SpotifyToolType

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

// ============================================================================
// Web Fetch Tool Configuration
// ============================================================================

/**
 * Configuration options for the web fetch tool.
 *
 * The web fetch tool allows Claude to retrieve full content from specified web pages and PDF documents.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
 */
export type WebFetchToolConfig = {
  /**
   * Maximum number of fetches allowed per request.
   * If Claude attempts more fetches than allowed, the web_fetch_tool_result
   * will be an error with the `max_uses_exceeded` error code.
   */
  maxUses?: number

  /**
   * Only fetch from these domains.
   * Cannot be used with blockedDomains.
   */
  allowedDomains?: string[]

  /**
   * Never fetch from these domains.
   * Cannot be used with allowedDomains.
   */
  blockedDomains?: string[]

  /**
   * Enable citations for fetched content.
   * When enabled, Claude can cite specific passages from fetched documents.
   */
  citations?: boolean

  /**
   * Maximum content length in tokens.
   * If the fetched content exceeds this limit, it will be truncated.
   */
  maxContentTokens?: number
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
  return {
    type: 'web_search_20250305',
    name: 'web_search',
    ...(config.maxUses !== undefined && { max_uses: config.maxUses }),
    ...(config.userLocation && { user_location: config.userLocation }),
    ...(config.allowedDomains && { allowed_domains: config.allowedDomains }),
    ...(config.blockedDomains && { blocked_domains: config.blockedDomains }),
  } as unknown as Anthropic.Tool
}

/**
 * Creates a web fetch tool with optional configuration.
 *
 * The web fetch tool allows Claude to retrieve full content from specified web pages and PDF documents.
 *
 * @param config - Optional configuration for the web fetch tool
 * @returns Anthropic tool definition for web fetch
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
 */
export function createWebFetchTool(config: WebFetchToolConfig = {}): Anthropic.Tool {
  return {
    type: 'web_fetch_20250910',
    name: 'web_fetch',
    ...(config.maxUses !== undefined && { max_uses: config.maxUses }),
    ...(config.allowedDomains && { allowed_domains: config.allowedDomains }),
    ...(config.blockedDomains && { blocked_domains: config.blockedDomains }),
    ...(config.citations !== undefined && { citations: { enabled: config.citations } }),
    ...(config.maxContentTokens !== undefined && { max_content_tokens: config.maxContentTokens }),
  } as unknown as Anthropic.Tool
}

/**
 * Creates a tool search tool definition.
 * 
 * The tool search tool enables Claude to work with hundreds or thousands of tools by 
 * dynamically discovering and loading them on-demand.
 * 
 * Two variants are available:
 * - 'bm25': Uses natural language queries (recommended for general use)
 * - 'regex': Uses Python regex patterns
 * 
 * @param variant - The search variant to use ('bm25' or 'regex')
 * @returns Anthropic tool definition for tool search
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
 */
export function createToolSearchTool(variant: 'bm25' | 'regex' = 'bm25'): Anthropic.Tool {
  return {
    type: variant === 'bm25' ? 'tool_search_tool_bm25_20251119' : 'tool_search_tool_regex_20251119',
    name: variant === 'bm25' ? 'tool_search_tool_bm25' : 'tool_search_tool_regex',
  } as unknown as Anthropic.Tool
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
 * - **tool_search**: Dynamic tool discovery (BM25 variant)
 *
 * @param webSearchConfig - Optional configuration for the web search tool
 * @param webFetchConfig - Optional configuration for the web fetch tool
 * @param enableToolSearch - Whether to include the tool search tool (default: true)
 * @returns Array of server-side tools for the API request
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
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
  webFetchConfig?: WebFetchToolConfig,
  enableToolSearch: boolean = true,
): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = []

  // Web Search Tool
  tools.push(createWebSearchTool(webSearchConfig))

  // Web Fetch Tool
  // Default to enabled citations if not specified, as it's a best practice
  const fetchConfig = { citations: true, ...webFetchConfig }
  tools.push(createWebFetchTool(fetchConfig))

  // Tool Search Tool (BM25)
  if (enableToolSearch) {
    tools.push(createToolSearchTool('bm25'))
  }

  return tools
}
