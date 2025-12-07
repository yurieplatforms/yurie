/**
 * System Prompt Builder
 *
 * Builds the system prompt for the Yurie AI agent with user context and personalization.
 * Optimized for GPT-5's steerability with clear persona, adaptive tone, and explicit formatting.
 * 
 * LATENCY OPTIMIZATION: Structured for prompt caching
 * - Static content placed FIRST (cacheable across requests)
 * - Dynamic content placed LAST (varies per user/request)
 * Reference: https://platform.openai.com/docs/guides/latency-optimization
 * Reference: https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
 */

type UserPreferences = {
  birthday?: string | null
  location?: string | null
  timezone?: string | null
}

type SystemPromptParams = {
  userName?: string | null
  userContext?: {
    time: string
    date: string
    timeZone: string
  }
  userPreferences?: UserPreferences
  /** Available tools/capabilities enabled for this conversation */
  enabledCapabilities?: string[]
}

// =============================================================================
// STATIC PROMPT (Cacheable - placed first for prompt caching optimization)
// =============================================================================

/**
 * Static system prompt content that remains constant across all requests.
 * This is placed at the beginning to maximize prompt cache hits.
 * Minimum 1024 tokens recommended for caching to activate.
 */
const STATIC_SYSTEM_PROMPT = `<identity>
  You are Yurie, a genuine friend and intelligent agent. You are warm, curious, and authentic—not a stiff assistant. You care about the user and engage as an equal partner.
</identity>

<core_principles>
  1. **Be Authentic**: Text like a friend. Lowercase is fine. Be honest, opinionated, and empathetic. Match the user's vibe (playful vs. serious).
  2. **Be Agentic**: When tasked with a goal, drive it to completion.
     - Don't ask for permission for every step; assume reasonable defaults.
     - If blocked, try alternatives before giving up.
     - Keep going until the problem is solved.
  3. **Be Concise**: Skip "How can I help?" or "Great question!". Get straight to the point or the action.
</core_principles>

<tool_usage>
  When using tools:
  1. **Plan**: For complex tasks, briefly state your plan.
  2. **Execute**: Call tools autonomously. Narrate key steps briefly.
  3. **Result**: Summarize the outcome clearly.
</tool_usage>

<response_format>
  - Keep it conversational and readable.
  - **REQUIRED**: End every response with exactly 3 natural follow-up suggestions in <suggestions> tags.
  - Suggestions should be short, casual, and relevant (e.g., "tell me more", "what about X?", "do it").

  Example:
  <suggestions>
  - wait explain that
  - let's try another way
  - sounds good go ahead
  </suggestions>
</response_format>`

// =============================================================================
// Dynamic Prompt Builders
// =============================================================================

/**
 * Build the dynamic context section (user info, environment, capabilities)
 * This content varies per request and is placed AFTER static content.
 */
function buildDynamicContext(params: SystemPromptParams): string {
  const { userName, userContext, userPreferences, enabledCapabilities = [] } = params

  const sections: string[] = []

  // User context section
  const userInfoLines: string[] = []
  userInfoLines.push(userName ? `Name: ${userName}` : 'Name: Not provided')
  if (userPreferences?.birthday) userInfoLines.push(`Birthday: ${userPreferences.birthday}`)
  if (userPreferences?.location) userInfoLines.push(`Location: ${userPreferences.location}`)
  if (userPreferences?.timezone) userInfoLines.push(`Timezone: ${userPreferences.timezone}`)

  const environmentString = userContext
    ? `Current Time: ${userContext.time} | Date: ${userContext.date} | Timezone: ${userContext.timeZone}`
    : 'Time unknown'

  sections.push(`<context>
  <user>
    ${userInfoLines.join('\n    ')}
  </user>
  <environment>
    ${environmentString}
  </environment>
</context>`)

  // Capabilities section (only if any are enabled)
  const capabilities: string[] = []
  
  if (enabledCapabilities.includes('gmail')) {
    capabilities.push(`Gmail Integration (ACTIVE):
  - You can send emails on behalf of the user using GMAIL_SEND_EMAIL
  - You can fetch and read emails using GMAIL_FETCH_EMAILS
  - You can create email drafts using GMAIL_CREATE_EMAIL_DRAFT
  
  When the user asks you to send an email, compose a draft, or check their inbox:
  - Use the appropriate Gmail tool
  - Confirm the action with the user before sending
  - Be helpful in composing professional, friendly, or appropriate emails based on context`)
  }
  
  if (enabledCapabilities.includes('spotify')) {
    capabilities.push(`Spotify Integration (ACTIVE):
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
  - For albums/playlists, use "context_uri" with the URI`)
  }
  
  if (capabilities.length > 0) {
    sections.push(`<capabilities>\n  ${capabilities.join('\n\n  ')}\n</capabilities>`)
  }

  return sections.join('\n\n')
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the static portion of the system prompt (for cache key generation)
 */
export function getStaticPrompt(): string {
  return STATIC_SYSTEM_PROMPT
}

/**
 * Builds the complete system prompt for the agent
 * Structure: STATIC content first (cacheable) → DYNAMIC content last (per-request)
 */
export function buildSystemPrompt(params: SystemPromptParams = {}): string {
  const dynamicContext = buildDynamicContext(params)
  
  // Separator marks the boundary between cached and dynamic content
  const CACHE_BOUNDARY = '\n\n--- Session Context ---\n\n'
  
  return STATIC_SYSTEM_PROMPT + CACHE_BOUNDARY + dynamicContext
}

/**
 * Get estimated token count for the static prompt (for monitoring cache efficiency)
 */
export function getStaticPromptTokenEstimate(): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(STATIC_SYSTEM_PROMPT.length / 4)
}
