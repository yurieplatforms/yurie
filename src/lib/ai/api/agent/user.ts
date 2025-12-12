/**
 * Agent user context utilities
 *
 * Keeps authentication + personalization fetching out of route handlers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  getUserName,
  getUserPersonalizationContext,
} from '@/lib/ai/agent/user-context'

export type AgentUserPreferences = {
  birthday?: string | null
  location?: string | null
  timezone?: string | null
}

export type AgentUserContext = {
  userId: string | null
  userName: string | null
  userPreferences: AgentUserPreferences
  /** Supabase client (only present when user is authenticated) */
  supabase: SupabaseClient | null
}

export async function getAgentUserContext(): Promise<AgentUserContext> {
  let supabase: SupabaseClient | null = null
  let userId: string | null = null
  let userName: string | null = null
  let userPreferences: AgentUserPreferences = {}

  try {
    supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    userId = user?.id ?? null
    if (!userId) {
      return { userId: null, userName: null, userPreferences: {}, supabase: null }
    }

    try {
      const personalizationContext = await getUserPersonalizationContext(
        supabase,
        userId,
      )

      userName = getUserName(personalizationContext)

      if (personalizationContext.profile) {
        userPreferences = {
          birthday: personalizationContext.profile.birthday,
          location: personalizationContext.profile.location,
          timezone: personalizationContext.profile.timezone,
        }
      }
    } catch (error) {
      // Continue without personalization if it fails
      console.error('[agent] Failed to fetch user personalization', error)
    }

    return { userId, userName, userPreferences, supabase }
  } catch (error) {
    // Continue without Supabase auth
    console.error('[agent] Failed to initialize Supabase client', error)
    return { userId: null, userName: null, userPreferences: {}, supabase: null }
  }
}

