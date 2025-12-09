/**
 * Capability Prompts
 *
 * Centralized, structured capability instructions for the AI agent.
 * These prompts are dynamically loaded based on enabled integrations,
 * keeping the main system prompt clean and maintainable.
 *
 * Each capability prompt provides:
 * - Available actions
 * - Tool usage guidance
 * - Best practices for the integration
 */

// =============================================================================
// Types
// =============================================================================

export type CapabilityPrompt = {
  /** Unique identifier matching the integration ID */
  id: string
  /** Display name for logging/debugging */
  name: string
  /** The prompt content to inject into the system prompt */
  prompt: string
  /** Key tools to highlight (for quick reference) */
  keyTools: Array<{
    name: string
    description: string
    usage?: string
  }>
}

// =============================================================================
// Gmail Capability
// =============================================================================

export const GMAIL_CAPABILITY: CapabilityPrompt = {
  id: 'gmail',
  name: 'Gmail Integration',
  keyTools: [
    {
      name: 'GMAIL_SEND_EMAIL',
      description: 'Send an email',
      usage: 'Use to send emails on behalf of the user',
    },
    {
      name: 'GMAIL_FETCH_EMAILS',
      description: 'Fetch emails from inbox',
      usage: 'Use to check inbox, read recent emails',
    },
    {
      name: 'GMAIL_CREATE_EMAIL_DRAFT',
      description: 'Create email draft',
      usage: 'Use when user wants to compose but not send immediately',
    },
    {
      name: 'GMAIL_SEARCH_EMAILS',
      description: 'Search emails with query',
      usage: 'Use to find specific emails by subject, sender, content',
    },
  ],
  prompt: `Gmail Integration (ACTIVE):
- You can send emails on behalf of the user using GMAIL_SEND_EMAIL
- You can fetch and read emails using GMAIL_FETCH_EMAILS
- You can create email drafts using GMAIL_CREATE_EMAIL_DRAFT
- You can search emails using GMAIL_SEARCH_EMAILS

When the user asks you to send an email, compose a draft, or check their inbox:
- Use the appropriate Gmail tool
- Confirm the action with the user before sending
- Be helpful in composing professional, friendly, or appropriate emails based on context`,
}

// =============================================================================
// Spotify Capability
// =============================================================================

export const SPOTIFY_CAPABILITY: CapabilityPrompt = {
  id: 'spotify',
  name: 'Spotify Integration',
  keyTools: [
    {
      name: 'SPOTIFY_SEARCH_FOR_ITEM',
      description: 'Search for music',
      usage: 'Search for tracks, artists, albums, playlists. Use type parameter.',
    },
    {
      name: 'SPOTIFY_START_RESUME_PLAYBACK',
      description: 'Play music',
      usage: 'Use context_uri for album/playlist, uris array for tracks',
    },
    {
      name: 'SPOTIFY_PAUSE_PLAYBACK',
      description: 'Pause the music',
    },
    {
      name: 'SPOTIFY_SKIP_TO_NEXT',
      description: 'Skip to next track',
    },
    {
      name: 'SPOTIFY_SKIP_TO_PREVIOUS',
      description: 'Go back to previous track',
    },
    {
      name: 'SPOTIFY_GET_CURRENTLY_PLAYING_TRACK',
      description: 'See what\'s playing',
    },
    {
      name: 'SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE',
      description: 'Add to queue',
      usage: 'Use uri like "spotify:track:..."',
    },
    {
      name: 'SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS',
      description: 'List user playlists',
    },
    {
      name: 'SPOTIFY_GET_RECOMMENDATIONS',
      description: 'Get personalized recommendations',
    },
  ],
  prompt: `Spotify Integration (ACTIVE):
- You can control music playback: play, pause, skip, previous, volume
- You can search for songs, artists, albums, and playlists
- You can get what's currently playing and manage the queue
- You can access and create playlists, get recommendations
- Note: Playback control requires Spotify Premium

Key tools:
- SPOTIFY_SEARCH_FOR_ITEM: Search for music (use type: ["track", "artist", "album", "playlist"])
- SPOTIFY_START_RESUME_PLAYBACK: Play music (use context_uri for album/playlist, uris for tracks)
- SPOTIFY_PAUSE_PLAYBACK: Pause the music
- SPOTIFY_SKIP_TO_NEXT / SPOTIFY_SKIP_TO_PREVIOUS: Skip tracks
- SPOTIFY_GET_CURRENTLY_PLAYING_TRACK: See what's playing now
- SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE: Add songs to queue (use uri like "spotify:track:...")
- SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS: List user's playlists
- SPOTIFY_GET_RECOMMENDATIONS: Get personalized recommendations

When playing music:
- Search first to get the Spotify URI, then use it to play
- For tracks, use "uris" array with track URIs
- For albums/playlists, use "context_uri" with the URI`,
}

// =============================================================================
// GitHub Capability
// =============================================================================

export const GITHUB_CAPABILITY: CapabilityPrompt = {
  id: 'github',
  name: 'GitHub Integration',
  keyTools: [
    {
      name: 'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER',
      description: 'List user repositories',
    },
    {
      name: 'GITHUB_GET_A_REPOSITORY',
      description: 'Get repository details',
      usage: 'Provide owner and repo name',
    },
    {
      name: 'GITHUB_SEARCH_REPOSITORIES',
      description: 'Search repositories',
    },
    {
      name: 'GITHUB_LIST_REPOSITORY_ISSUES',
      description: 'List issues in a repo',
    },
    {
      name: 'GITHUB_CREATE_AN_ISSUE',
      description: 'Create a new issue',
    },
    {
      name: 'GITHUB_LIST_PULL_REQUESTS',
      description: 'List PRs in a repo',
    },
    {
      name: 'GITHUB_GET_REPOSITORY_CONTENT',
      description: 'Read file contents',
    },
    {
      name: 'GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS',
      description: 'Create or edit files',
    },
  ],
  prompt: `GitHub Integration (ACTIVE):
- You can list and search repositories
- You can manage issues: list, create, comment
- You can view pull requests
- You can read and write file contents

Key tools:
- GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: List user's repos
- GITHUB_GET_A_REPOSITORY: Get details of a specific repo (needs owner/repo)
- GITHUB_SEARCH_REPOSITORIES: Search for repositories
- GITHUB_LIST_REPOSITORY_ISSUES: List issues in a repo
- GITHUB_CREATE_AN_ISSUE: Create a new issue
- GITHUB_LIST_PULL_REQUESTS: List PRs in a repo
- GITHUB_GET_REPOSITORY_CONTENT: Read file contents from repo
- GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS: Create or edit files

When working with GitHub:
- Always confirm destructive actions with the user
- Provide clear summaries of repository contents
- Help compose clear issue descriptions and PR summaries`,
}

// =============================================================================
// Image Generation Capability
// =============================================================================

export const IMAGE_GENERATION_CAPABILITY: CapabilityPrompt = {
  id: 'image_generation',
  name: 'Image Generation',
  keyTools: [
    {
      name: 'image_generation',
      description: 'Generate images',
      usage: 'Describe the image you want to generate',
    },
  ],
  prompt: `Image Generation (ACTIVE):
- You can generate images using the image_generation tool.
- When the user asks to "draw", "create an image of", or "visualize" something, use this tool.
- You can also edit images or generate variations if supported.`,
}

// =============================================================================
// Registry & Utilities
// =============================================================================

/**
 * Registry of all capability prompts
 */
export const CAPABILITY_REGISTRY: Record<string, CapabilityPrompt> = {
  gmail: GMAIL_CAPABILITY,
  spotify: SPOTIFY_CAPABILITY,
  github: GITHUB_CAPABILITY,
  image_generation: IMAGE_GENERATION_CAPABILITY,
}

/**
 * Get capability prompt by ID
 */
export function getCapabilityPrompt(capabilityId: string): CapabilityPrompt | undefined {
  return CAPABILITY_REGISTRY[capabilityId]
}

/**
 * Get prompt text for a capability
 */
export function getCapabilityPromptText(capabilityId: string): string | undefined {
  return CAPABILITY_REGISTRY[capabilityId]?.prompt
}

/**
 * Build combined capability prompt for multiple integrations
 */
export function buildCapabilitiesPrompt(enabledCapabilities: string[]): string {
  if (enabledCapabilities.length === 0) {
    return ''
  }

  const prompts = enabledCapabilities
    .map((id) => getCapabilityPromptText(id))
    .filter((p): p is string => !!p)

  if (prompts.length === 0) {
    return ''
  }

  return `<capabilities>\n  ${prompts.join('\n\n  ')}\n</capabilities>`
}

/**
 * Get all registered capability IDs
 */
export function getAllCapabilityIds(): string[] {
  return Object.keys(CAPABILITY_REGISTRY)
}

/**
 * Get key tools summary for a capability (useful for quick reference)
 */
export function getCapabilityKeyTools(capabilityId: string): CapabilityPrompt['keyTools'] {
  return CAPABILITY_REGISTRY[capabilityId]?.keyTools ?? []
}

