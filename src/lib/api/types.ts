/**
 * API Types
 * 
 * Type definitions specific to API routes and requests.
 */

import type { MessageContentSegment } from '@/lib/types'
import type { UserPersonalizationContext } from '@/lib/agent/user-context'

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
  /** Selected tools/apps to use (e.g., 'gmail') */
  selectedTools?: string[]
}
