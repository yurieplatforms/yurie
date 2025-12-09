/**
 * Tool Definitions
 *
 * Centralized, structured definitions for all available tools.
 * This file serves as the single source of truth for tool metadata,
 * making it easy to maintain, version, and test tool configurations.
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */

// =============================================================================
// Tool Definition Types
// =============================================================================

export type ToolCategory = 'search' | 'email' | 'music' | 'code' | 'productivity'

export type ToolDefinition = {
  /** Unique identifier for the tool */
  id: string
  /** Human-readable display name */
  displayName: string
  /** Short description for UI display */
  description: string
  /** Category for grouping */
  category: ToolCategory
  /** Icon name (for UI) */
  icon?: string
  /** Whether this is a built-in OpenAI tool or external */
  type: 'builtin' | 'composio' | 'custom'
  /** Associated integration (e.g., 'gmail', 'spotify') */
  integration?: string
  /** Tool-specific configuration */
  config?: Record<string, unknown>
}

export type IntegrationDefinition = {
  /** Unique identifier */
  id: string
  /** Display name */
  displayName: string
  /** Description */
  description: string
  /** Icon path */
  icon: string
  /** Category */
  category: ToolCategory
  /** Whether premium is required */
  requiresPremium?: boolean
  /** Associated tools */
  tools: string[]
  /** Default tools to enable */
  defaultTools: string[]
}

// =============================================================================
// Built-in Tools
// =============================================================================

export const BUILTIN_TOOLS: Record<string, ToolDefinition> = {
  web_search: {
    id: 'web_search',
    displayName: 'Web Search',
    description: 'Search the web for current information, news, and real-time data',
    category: 'search',
    icon: 'search',
    type: 'builtin',
  },
  image_generation: {
    id: 'image_generation',
    displayName: 'Image Generation',
    description: 'Generate images from text descriptions',
    category: 'productivity',
    icon: 'image',
    type: 'builtin',
  },
} as const

// =============================================================================
// Gmail Tools
// =============================================================================

export const GMAIL_TOOLS: Record<string, ToolDefinition> = {
  GMAIL_SEND_EMAIL: {
    id: 'GMAIL_SEND_EMAIL',
    displayName: 'Send Email',
    description: 'Send an email on behalf of the user',
    category: 'email',
    type: 'composio',
    integration: 'gmail',
  },
  GMAIL_FETCH_EMAILS: {
    id: 'GMAIL_FETCH_EMAILS',
    displayName: 'Fetch Emails',
    description: 'Fetch emails from the user\'s inbox',
    category: 'email',
    type: 'composio',
    integration: 'gmail',
  },
  GMAIL_GET_EMAIL: {
    id: 'GMAIL_GET_EMAIL',
    displayName: 'Get Email',
    description: 'Get a specific email by ID',
    category: 'email',
    type: 'composio',
    integration: 'gmail',
  },
  GMAIL_CREATE_EMAIL_DRAFT: {
    id: 'GMAIL_CREATE_EMAIL_DRAFT',
    displayName: 'Create Draft',
    description: 'Create an email draft',
    category: 'email',
    type: 'composio',
    integration: 'gmail',
  },
  GMAIL_SEARCH_EMAILS: {
    id: 'GMAIL_SEARCH_EMAILS',
    displayName: 'Search Emails',
    description: 'Search emails with a query',
    category: 'email',
    type: 'composio',
    integration: 'gmail',
  },
  GMAIL_REPLY_TO_EMAIL: {
    id: 'GMAIL_REPLY_TO_EMAIL',
    displayName: 'Reply to Email',
    description: 'Reply to an existing email',
    category: 'email',
    type: 'composio',
    integration: 'gmail',
  },
} as const

// =============================================================================
// Spotify Tools
// =============================================================================

export const SPOTIFY_TOOLS: Record<string, ToolDefinition> = {
  SPOTIFY_GET_CURRENTLY_PLAYING_TRACK: {
    id: 'SPOTIFY_GET_CURRENTLY_PLAYING_TRACK',
    displayName: 'Currently Playing',
    description: 'Get the currently playing track',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_SEARCH_FOR_ITEM: {
    id: 'SPOTIFY_SEARCH_FOR_ITEM',
    displayName: 'Search',
    description: 'Search for tracks, artists, albums, or playlists',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_START_RESUME_PLAYBACK: {
    id: 'SPOTIFY_START_RESUME_PLAYBACK',
    displayName: 'Play',
    description: 'Start or resume playback',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
    config: { requiresPremium: true },
  },
  SPOTIFY_PAUSE_PLAYBACK: {
    id: 'SPOTIFY_PAUSE_PLAYBACK',
    displayName: 'Pause',
    description: 'Pause playback',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
    config: { requiresPremium: true },
  },
  SPOTIFY_SKIP_TO_NEXT: {
    id: 'SPOTIFY_SKIP_TO_NEXT',
    displayName: 'Skip to Next',
    description: 'Skip to the next track',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
    config: { requiresPremium: true },
  },
  SPOTIFY_SKIP_TO_PREVIOUS: {
    id: 'SPOTIFY_SKIP_TO_PREVIOUS',
    displayName: 'Skip to Previous',
    description: 'Skip to the previous track',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
    config: { requiresPremium: true },
  },
  SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE: {
    id: 'SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE',
    displayName: 'Add to Queue',
    description: 'Add a track to the playback queue',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS: {
    id: 'SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS',
    displayName: 'Get Playlists',
    description: 'Get the user\'s playlists',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_GET_PLAYLIST: {
    id: 'SPOTIFY_GET_PLAYLIST',
    displayName: 'Get Playlist',
    description: 'Get details of a specific playlist',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_CREATE_PLAYLIST: {
    id: 'SPOTIFY_CREATE_PLAYLIST',
    displayName: 'Create Playlist',
    description: 'Create a new playlist',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_ADD_ITEMS_TO_PLAYLIST: {
    id: 'SPOTIFY_ADD_ITEMS_TO_PLAYLIST',
    displayName: 'Add to Playlist',
    description: 'Add tracks to a playlist',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_GET_AVAILABLE_DEVICES: {
    id: 'SPOTIFY_GET_AVAILABLE_DEVICES',
    displayName: 'Get Devices',
    description: 'Get available playback devices',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_SET_PLAYBACK_VOLUME: {
    id: 'SPOTIFY_SET_PLAYBACK_VOLUME',
    displayName: 'Set Volume',
    description: 'Set playback volume',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
    config: { requiresPremium: true },
  },
  SPOTIFY_GET_USER_S_SAVED_TRACKS: {
    id: 'SPOTIFY_GET_USER_S_SAVED_TRACKS',
    displayName: 'Saved Tracks',
    description: 'Get user\'s saved tracks',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
  SPOTIFY_GET_RECOMMENDATIONS: {
    id: 'SPOTIFY_GET_RECOMMENDATIONS',
    displayName: 'Get Recommendations',
    description: 'Get personalized track recommendations',
    category: 'music',
    type: 'composio',
    integration: 'spotify',
  },
} as const

// =============================================================================
// GitHub Tools
// =============================================================================

export const GITHUB_TOOLS: Record<string, ToolDefinition> = {
  GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: {
    id: 'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
    displayName: 'List Repositories',
    description: 'List repositories for the authenticated user',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_GET_A_REPOSITORY: {
    id: 'GITHUB_GET_A_REPOSITORY',
    displayName: 'Get Repository',
    description: 'Get details of a specific repository',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_SEARCH_REPOSITORIES: {
    id: 'GITHUB_SEARCH_REPOSITORIES',
    displayName: 'Search Repositories',
    description: 'Search for repositories',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_LIST_REPOSITORY_ISSUES: {
    id: 'GITHUB_LIST_REPOSITORY_ISSUES',
    displayName: 'List Issues',
    description: 'List issues in a repository',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_CREATE_AN_ISSUE: {
    id: 'GITHUB_CREATE_AN_ISSUE',
    displayName: 'Create Issue',
    description: 'Create a new issue',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_LIST_PULL_REQUESTS: {
    id: 'GITHUB_LIST_PULL_REQUESTS',
    displayName: 'List Pull Requests',
    description: 'List pull requests in a repository',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_GET_REPOSITORY_CONTENT: {
    id: 'GITHUB_GET_REPOSITORY_CONTENT',
    displayName: 'Get Content',
    description: 'Get content from a repository',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS: {
    id: 'GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS',
    displayName: 'Create/Update File',
    description: 'Create or update a file in a repository',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_CREATE_AN_ISSUE_COMMENT: {
    id: 'GITHUB_CREATE_AN_ISSUE_COMMENT',
    displayName: 'Comment on Issue',
    description: 'Create a comment on an issue',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
  GITHUB_LIST_ISSUE_COMMENTS: {
    id: 'GITHUB_LIST_ISSUE_COMMENTS',
    displayName: 'List Comments',
    description: 'List comments on an issue',
    category: 'code',
    type: 'composio',
    integration: 'github',
  },
} as const

// =============================================================================
// Integration Definitions
// =============================================================================

export const INTEGRATIONS: Record<string, IntegrationDefinition> = {
  gmail: {
    id: 'gmail',
    displayName: 'Gmail',
    description: 'Send and read emails',
    icon: '/Gmail.svg',
    category: 'email',
    tools: Object.keys(GMAIL_TOOLS),
    defaultTools: ['GMAIL_SEND_EMAIL', 'GMAIL_FETCH_EMAILS', 'GMAIL_CREATE_EMAIL_DRAFT'],
  },
  spotify: {
    id: 'spotify',
    displayName: 'Spotify',
    description: 'Control music playback',
    icon: '/Spotify.svg',
    category: 'music',
    requiresPremium: true,
    tools: Object.keys(SPOTIFY_TOOLS),
    defaultTools: [
      'SPOTIFY_GET_CURRENTLY_PLAYING_TRACK',
      'SPOTIFY_SEARCH_FOR_ITEM',
      'SPOTIFY_START_RESUME_PLAYBACK',
      'SPOTIFY_PAUSE_PLAYBACK',
      'SPOTIFY_SKIP_TO_NEXT',
      'SPOTIFY_SKIP_TO_PREVIOUS',
      'SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE',
      'SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS',
    ],
  },
  github: {
    id: 'github',
    displayName: 'GitHub',
    description: 'Manage repositories and issues',
    icon: '/GitHub.svg',
    category: 'code',
    tools: Object.keys(GITHUB_TOOLS),
    defaultTools: [
      'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
      'GITHUB_GET_A_REPOSITORY',
      'GITHUB_SEARCH_REPOSITORIES',
      'GITHUB_LIST_REPOSITORY_ISSUES',
      'GITHUB_CREATE_AN_ISSUE',
      'GITHUB_LIST_PULL_REQUESTS',
    ],
  },
} as const

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all tool definitions as a flat array
 */
export function getAllTools(): ToolDefinition[] {
  return [
    ...Object.values(BUILTIN_TOOLS),
    ...Object.values(GMAIL_TOOLS),
    ...Object.values(SPOTIFY_TOOLS),
    ...Object.values(GITHUB_TOOLS),
  ]
}

/**
 * Get tools for a specific integration
 */
export function getToolsForIntegration(integrationId: string): ToolDefinition[] {
  const allTools = getAllTools()
  return allTools.filter((tool) => tool.integration === integrationId)
}

/**
 * Get tool definition by ID
 */
export function getToolById(toolId: string): ToolDefinition | undefined {
  return getAllTools().find((tool) => tool.id === toolId)
}

/**
 * Get default tools for an integration
 */
export function getDefaultToolsForIntegration(integrationId: string): string[] {
  return INTEGRATIONS[integrationId]?.defaultTools ?? []
}

/**
 * Format tool name for display (e.g., "GMAIL_FETCH_EMAILS" -> "Fetch Emails")
 */
export function formatToolName(toolId: string): string {
  const tool = getToolById(toolId)
  if (tool) return tool.displayName

  // Fallback formatting for unknown tools
  if (toolId === 'web_search') return 'Web search'

  // Remove common prefixes and format
  const withoutPrefix = toolId.replace(/^(GMAIL|SPOTIFY|GITHUB|SLACK|NOTION)_/i, '')
  return withoutPrefix
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * Get integration by ID
 */
export function getIntegration(integrationId: string): IntegrationDefinition | undefined {
  return INTEGRATIONS[integrationId]
}

/**
 * Get all available integrations
 */
export function getAllIntegrations(): IntegrationDefinition[] {
  return Object.values(INTEGRATIONS)
}

