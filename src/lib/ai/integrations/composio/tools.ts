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
 * Available Spotify tools
 *
 * @see https://docs.composio.dev/toolkits/spotify
 */
export const SpotifyTools = {
  // Playback Control
  /** Start or resume playback */
  START_RESUME_PLAYBACK: 'SPOTIFY_START_RESUME_PLAYBACK',
  /** Pause playback */
  PAUSE_PLAYBACK: 'SPOTIFY_PAUSE_PLAYBACK',
  /** Skip to next track */
  SKIP_TO_NEXT: 'SPOTIFY_SKIP_TO_NEXT',
  /** Skip to previous track */
  SKIP_TO_PREVIOUS: 'SPOTIFY_SKIP_TO_PREVIOUS',
  /** Seek to position in track */
  SEEK_TO_POSITION: 'SPOTIFY_SEEK_TO_POSITION',
  /** Set playback volume */
  SET_PLAYBACK_VOLUME: 'SPOTIFY_SET_PLAYBACK_VOLUME',
  /** Set repeat mode */
  SET_REPEAT_MODE: 'SPOTIFY_SET_REPEAT_MODE',
  /** Toggle shuffle */
  TOGGLE_SHUFFLE: 'SPOTIFY_TOGGLE_PLAYBACK_SHUFFLE',
  /** Transfer playback to device */
  TRANSFER_PLAYBACK: 'SPOTIFY_TRANSFER_PLAYBACK',
  
  // Queue Management
  /** Add item to queue */
  ADD_TO_QUEUE: 'SPOTIFY_ADD_TO_QUEUE',
  /** Get user's queue */
  GET_QUEUE: 'SPOTIFY_GET_QUEUE',
  
  // Playback State
  /** Get current playback state */
  GET_PLAYBACK_STATE: 'SPOTIFY_GET_PLAYBACK_STATE',
  /** Get currently playing track */
  GET_CURRENTLY_PLAYING: 'SPOTIFY_GET_CURRENTLY_PLAYING',
  /** Get available devices */
  GET_DEVICES: 'SPOTIFY_GET_AVAILABLE_DEVICES',
  /** Get recently played tracks */
  GET_RECENTLY_PLAYED: 'SPOTIFY_GET_RECENTLY_PLAYED',
  
  // Search & Browse
  /** Search for tracks, albums, artists, playlists */
  SEARCH: 'SPOTIFY_SEARCH',
  /** Get track details */
  GET_TRACK: 'SPOTIFY_GET_TRACK',
  /** Get album details */
  GET_ALBUM: 'SPOTIFY_GET_ALBUM',
  /** Get artist details */
  GET_ARTIST: 'SPOTIFY_GET_ARTIST',
  /** Get artist's top tracks */
  GET_ARTIST_TOP_TRACKS: 'SPOTIFY_GET_ARTIST_TOP_TRACKS',
  
  // Playlists
  /** Get user's playlists */
  GET_USER_PLAYLISTS: 'SPOTIFY_GET_USER_PLAYLISTS',
  /** Get playlist details */
  GET_PLAYLIST: 'SPOTIFY_GET_PLAYLIST',
  /** Create a playlist */
  CREATE_PLAYLIST: 'SPOTIFY_CREATE_PLAYLIST',
  /** Add items to playlist */
  ADD_ITEMS_TO_PLAYLIST: 'SPOTIFY_ADD_ITEMS_TO_PLAYLIST',
  /** Remove items from playlist */
  REMOVE_ITEMS_FROM_PLAYLIST: 'SPOTIFY_REMOVE_ITEMS_FROM_PLAYLIST',
  /** Update playlist details */
  UPDATE_PLAYLIST: 'SPOTIFY_UPDATE_PLAYLIST',
  
  // Library
  /** Get user's saved tracks */
  GET_SAVED_TRACKS: 'SPOTIFY_GET_SAVED_TRACKS',
  /** Save tracks to library */
  SAVE_TRACKS: 'SPOTIFY_SAVE_TRACKS',
  /** Remove tracks from library */
  REMOVE_SAVED_TRACKS: 'SPOTIFY_REMOVE_SAVED_TRACKS',
  /** Check if tracks are saved */
  CHECK_SAVED_TRACKS: 'SPOTIFY_CHECK_SAVED_TRACKS',
  /** Get user's saved albums */
  GET_SAVED_ALBUMS: 'SPOTIFY_GET_SAVED_ALBUMS',
  
  // User Profile
  /** Get current user's profile */
  GET_CURRENT_USER_PROFILE: 'SPOTIFY_GET_CURRENT_USER_PROFILE',
  /** Get user's top artists */
  GET_TOP_ARTISTS: 'SPOTIFY_GET_TOP_ARTISTS',
  /** Get user's top tracks */
  GET_TOP_TRACKS: 'SPOTIFY_GET_TOP_TRACKS',
  
  // Following
  /** Follow artists or users */
  FOLLOW_ARTISTS_USERS: 'SPOTIFY_FOLLOW_ARTISTS_OR_USERS',
  /** Unfollow artists or users */
  UNFOLLOW_ARTISTS_USERS: 'SPOTIFY_UNFOLLOW_ARTISTS_OR_USERS',
  /** Follow a playlist */
  FOLLOW_PLAYLIST: 'SPOTIFY_FOLLOW_PLAYLIST',
  /** Unfollow a playlist */
  UNFOLLOW_PLAYLIST: 'SPOTIFY_UNFOLLOW_PLAYLIST',
} as const

export type SpotifyToolName = (typeof SpotifyTools)[keyof typeof SpotifyTools]

/**
 * Default Spotify tools for common music operations
 */
export const DEFAULT_SPOTIFY_TOOLS: SpotifyToolName[] = [
  SpotifyTools.GET_CURRENTLY_PLAYING,
  SpotifyTools.SEARCH,
  SpotifyTools.START_RESUME_PLAYBACK,
  SpotifyTools.PAUSE_PLAYBACK,
  SpotifyTools.SKIP_TO_NEXT,
  SpotifyTools.SKIP_TO_PREVIOUS,
  SpotifyTools.ADD_TO_QUEUE,
  SpotifyTools.GET_USER_PLAYLISTS,
]

/**
 * Spotify tools grouped by operation type
 */
export const SpotifyToolGroups = {
  /** Tools for controlling playback */
  playback: [
    SpotifyTools.START_RESUME_PLAYBACK,
    SpotifyTools.PAUSE_PLAYBACK,
    SpotifyTools.SKIP_TO_NEXT,
    SpotifyTools.SKIP_TO_PREVIOUS,
    SpotifyTools.SEEK_TO_POSITION,
    SpotifyTools.SET_PLAYBACK_VOLUME,
    SpotifyTools.SET_REPEAT_MODE,
    SpotifyTools.TOGGLE_SHUFFLE,
    SpotifyTools.TRANSFER_PLAYBACK,
  ] as SpotifyToolName[],
  /** Tools for searching and browsing */
  browse: [
    SpotifyTools.SEARCH,
    SpotifyTools.GET_TRACK,
    SpotifyTools.GET_ALBUM,
    SpotifyTools.GET_ARTIST,
    SpotifyTools.GET_ARTIST_TOP_TRACKS,
  ] as SpotifyToolName[],
  /** Tools for playlist management */
  playlists: [
    SpotifyTools.GET_USER_PLAYLISTS,
    SpotifyTools.GET_PLAYLIST,
    SpotifyTools.CREATE_PLAYLIST,
    SpotifyTools.ADD_ITEMS_TO_PLAYLIST,
    SpotifyTools.REMOVE_ITEMS_FROM_PLAYLIST,
    SpotifyTools.UPDATE_PLAYLIST,
  ] as SpotifyToolName[],
  /** Tools for library management */
  library: [
    SpotifyTools.GET_SAVED_TRACKS,
    SpotifyTools.SAVE_TRACKS,
    SpotifyTools.REMOVE_SAVED_TRACKS,
    SpotifyTools.GET_SAVED_ALBUMS,
  ] as SpotifyToolName[],
  /** Tools for getting playback info */
  info: [
    SpotifyTools.GET_PLAYBACK_STATE,
    SpotifyTools.GET_CURRENTLY_PLAYING,
    SpotifyTools.GET_DEVICES,
    SpotifyTools.GET_RECENTLY_PLAYED,
    SpotifyTools.GET_QUEUE,
  ] as SpotifyToolName[],
}

/**
 * Available GitHub tools
 * 
 * @see https://docs.composio.dev/toolkits/github
 */
export const GitHubTools = {
  // Repositories
  /** Create a repository for the authenticated user */
  CREATE_REPO_FOR_USER: 'GITHUB_CREATE_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER',
  /** Get a repository */
  GET_REPO: 'GITHUB_GET_A_REPOSITORY',
  /** List repositories for the authenticated user */
  LIST_REPOS_FOR_USER: 'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
  /** Star a repository */
  STAR_REPO: 'GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER',
  /** Search repositories */
  SEARCH_REPOS: 'GITHUB_SEARCH_REPOSITORIES',

  // Issues
  /** Create an issue */
  CREATE_ISSUE: 'GITHUB_CREATE_AN_ISSUE',
  /** Get an issue */
  GET_ISSUE: 'GITHUB_GET_AN_ISSUE',
  /** List repository issues */
  LIST_REPO_ISSUES: 'GITHUB_LIST_REPOSITORY_ISSUES',
  /** Update an issue */
  UPDATE_ISSUE: 'GITHUB_UPDATE_AN_ISSUE',
  /** Create an issue comment */
  CREATE_ISSUE_COMMENT: 'GITHUB_CREATE_AN_ISSUE_COMMENT',
  /** List issue comments */
  LIST_ISSUE_COMMENTS: 'GITHUB_LIST_ISSUE_COMMENTS',

  // Pull Requests
  /** Create a pull request */
  CREATE_PR: 'GITHUB_CREATE_A_PULL_REQUEST',
  /** Get a pull request */
  GET_PR: 'GITHUB_GET_A_PULL_REQUEST',
  /** List pull requests */
  LIST_PRS: 'GITHUB_LIST_PULL_REQUESTS',
  /** Merge a pull request */
  MERGE_PR: 'GITHUB_MERGE_A_PULL_REQUEST',
  
  // File Operations
  /** Create or update file contents */
  CREATE_OR_UPDATE_FILE: 'GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS',
  /** Get repository content */
  GET_REPO_CONTENT: 'GITHUB_GET_REPOSITORY_CONTENT',
  /** Delete a file */
  DELETE_FILE: 'GITHUB_DELETE_A_FILE',
  
  // User
  /** Get the authenticated user */
  GET_AUTHENTICATED_USER: 'GITHUB_GET_THE_AUTHENTICATED_USER',
  
  // Commits
  /** Get a commit */
  GET_COMMIT: 'GITHUB_GET_A_COMMIT',
  /** List commits */
  LIST_COMMITS: 'GITHUB_LIST_COMMITS',
  
  // Other
  /** Fork a repository */
  CREATE_FORK: 'GITHUB_CREATE_A_FORK',
  /** Unstar a repository */
  UNSTAR_REPO: 'GITHUB_UNSTAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER',
} as const

export type GitHubToolName = (typeof GitHubTools)[keyof typeof GitHubTools]

/**
 * Default GitHub tools for common operations
 */
export const DEFAULT_GITHUB_TOOLS: GitHubToolName[] = [
  GitHubTools.LIST_REPOS_FOR_USER,
  GitHubTools.GET_REPO,
  GitHubTools.SEARCH_REPOS,
  GitHubTools.LIST_REPO_ISSUES,
  GitHubTools.CREATE_ISSUE,
  GitHubTools.LIST_PRS,
  GitHubTools.GET_REPO_CONTENT,
  GitHubTools.CREATE_OR_UPDATE_FILE,
  GitHubTools.CREATE_ISSUE_COMMENT,
  GitHubTools.LIST_ISSUE_COMMENTS,
]

/**
 * GitHub tools grouped by operation type
 */
export const GitHubToolGroups = {
  /** Tools for managing repositories */
  repos: [
    GitHubTools.CREATE_REPO_FOR_USER,
    GitHubTools.GET_REPO,
    GitHubTools.LIST_REPOS_FOR_USER,
    GitHubTools.STAR_REPO,
    GitHubTools.UNSTAR_REPO,
    GitHubTools.SEARCH_REPOS,
    GitHubTools.GET_REPO_CONTENT,
    GitHubTools.CREATE_OR_UPDATE_FILE,
    GitHubTools.DELETE_FILE,
    GitHubTools.CREATE_FORK,
    GitHubTools.GET_COMMIT,
    GitHubTools.LIST_COMMITS,
  ] as GitHubToolName[],
  /** Tools for managing issues */
  issues: [
    GitHubTools.CREATE_ISSUE,
    GitHubTools.GET_ISSUE,
    GitHubTools.LIST_REPO_ISSUES,
    GitHubTools.UPDATE_ISSUE,
    GitHubTools.CREATE_ISSUE_COMMENT,
    GitHubTools.LIST_ISSUE_COMMENTS,
  ] as GitHubToolName[],
  /** Tools for managing pull requests */
  pullRequests: [
    GitHubTools.CREATE_PR,
    GitHubTools.GET_PR,
    GitHubTools.LIST_PRS,
    GitHubTools.MERGE_PR,
  ] as GitHubToolName[],
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
 * Get Spotify-specific tools for a user (uses Responses provider by default)
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolNames - Optional specific Spotify tools to fetch (defaults to DEFAULT_SPOTIFY_TOOLS)
 * @param options - Additional options including provider type
 * @returns Array of Spotify tools ready for use with agents
 *
 * @example
 * // Get default Spotify tools (for Responses API)
 * const tools = await getSpotifyTools('user-123')
 *
 * @example
 * // Get specific tools
 * const tools = await getSpotifyTools('user-123', ['SPOTIFY_SEARCH', 'SPOTIFY_START_RESUME_PLAYBACK'])
 *
 * @example
 * // Get playback tools only
 * const tools = await getSpotifyTools('user-123', SpotifyToolGroups.playback)
 */
export async function getSpotifyTools(
  externalUserId: string,
  toolNames: SpotifyToolName[] = DEFAULT_SPOTIFY_TOOLS,
  options?: { limit?: number; provider?: ProviderType }
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    tools: toolNames,
  }, options?.provider ?? 'responses')
}

/**
 * Get Spotify-specific tools for use with @openai/agents SDK
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolNames - Optional specific Spotify tools to fetch (defaults to DEFAULT_SPOTIFY_TOOLS)
 * @returns Array of Spotify tools formatted for OpenAI Agents SDK
 *
 * @example
 * import { Agent, run } from '@openai/agents'
 * const tools = await getSpotifyToolsForAgents('user-123')
 * const agent = new Agent({ tools })
 * const result = await run(agent, 'Play my favorite playlist...')
 */
export async function getSpotifyToolsForAgents(
  externalUserId: string,
  toolNames: SpotifyToolName[] = DEFAULT_SPOTIFY_TOOLS
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    tools: toolNames,
  }, 'agents')
}

/**
 * Get Spotify tools by group
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param group - Tool group: 'playback', 'browse', 'playlists', 'library', or 'info'
 * @returns Array of Spotify tools for the specified group
 *
 * @example
 * const playbackTools = await getSpotifyToolsByGroup('user-123', 'playback')
 */
export async function getSpotifyToolsByGroup(
  externalUserId: string,
  group: keyof typeof SpotifyToolGroups
): Promise<ComposioTool[]> {
  return getSpotifyTools(externalUserId, SpotifyToolGroups[group])
}

/**
 * Get GitHub-specific tools for a user (uses Responses provider by default)
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolNames - Optional specific GitHub tools to fetch (defaults to DEFAULT_GITHUB_TOOLS)
 * @param options - Additional options including provider type
 * @returns Array of GitHub tools ready for use with agents
 */
export async function getGitHubTools(
  externalUserId: string,
  toolNames: GitHubToolName[] = DEFAULT_GITHUB_TOOLS,
  options?: { limit?: number; provider?: ProviderType }
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    tools: toolNames,
  }, options?.provider ?? 'responses')
}

/**
 * Get GitHub-specific tools for use with @openai/agents SDK
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolNames - Optional specific GitHub tools to fetch (defaults to DEFAULT_GITHUB_TOOLS)
 * @returns Array of GitHub tools formatted for OpenAI Agents SDK
 */
export async function getGitHubToolsForAgents(
  externalUserId: string,
  toolNames: GitHubToolName[] = DEFAULT_GITHUB_TOOLS
): Promise<ComposioTool[]> {
  return getTools(externalUserId, {
    tools: toolNames,
  }, 'agents')
}

/**
 * Get GitHub tools by group
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param group - Tool group: 'repos', 'issues', or 'pullRequests'
 * @returns Array of GitHub tools for the specified group
 */
export async function getGitHubToolsByGroup(
  externalUserId: string,
  group: keyof typeof GitHubToolGroups
): Promise<ComposioTool[]> {
  return getGitHubTools(externalUserId, GitHubToolGroups[group])
}

/**
 * Get tools from any toolkit
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param toolkit - Toolkit name (e.g., 'GMAIL', 'SLACK', 'NOTION')
 * @param options - Additional options
 * @returns Array of tools from the specified toolkit
 *
 * @example
 * // Get Notion tools
 * const tools = await getToolkitTools('user-123', 'NOTION')
 *
 * @see https://docs.composio.dev/docs/fetching-tools#by-toolkit
 */
export async function getToolkitTools(
  externalUserId: string,
  toolkit: string,
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
