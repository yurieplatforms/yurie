/**
 * API Types
 * 
 * Type definitions specific to API routes and requests.
 *
 * @see https://platform.claude.com/docs/en/build-with-claude/extended-thinking
 * @see https://platform.claude.com/docs/en/build-with-claude/effort
 */

import type { MessageContentSegment, WebSearchUserLocation } from '@/types'
import type { UserPersonalizationContext } from '@/agent/user-context'
import type { EffortLevel } from '@/agent/types'

/**
 * API-specific role type (includes 'system' and 'tool' not in UI Role)
 */
export type ApiRole = 'system' | 'user' | 'assistant' | 'tool'

/**
 * API request message type (simplified version of ChatMessage for requests)
 */
export type ApiChatMessage = {
  role: ApiRole
  content: string | MessageContentSegment[]
}

/**
 * Request body for the agent API endpoint
 */
export type AgentRequestBody = {
  messages: ApiChatMessage[]
  useWebSearch?: boolean
  userContext?: {
    time: string
    date: string
    timeZone: string
  }
  userPersonalization?: UserPersonalizationContext
  /**
   * User location for localized web search results
   * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
   */
  userLocation?: WebSearchUserLocation
  /**
   * List of tool IDs that the agent is allowed to use.
   * If provided, only tools in this list (plus default tools) will be available.
   */
  selectedTools?: string[]
  /**
   * Effort level for controlling token usage and response thoroughness.
   * 
   * **Note: Only supported by Claude Opus 4.5 models.**
   * This parameter is ignored for Sonnet and other models.
   * 
   * - `high`: Maximum capability—Claude uses as many tokens as needed (default)
   * - `medium`: Balanced approach with moderate token savings
   * - `low`: Most efficient—significant token savings with some capability reduction
   *
   * @default 'high'
   * @see https://platform.claude.com/docs/en/build-with-claude/effort
   */
  effort?: EffortLevel
}

