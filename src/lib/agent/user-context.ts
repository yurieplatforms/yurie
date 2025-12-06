/**
 * User Context
 * 
 * Fetches and formats user personalization context for the agent.
 * Includes user profile and prompt formatting.
 */

import { SupabaseClient } from '@supabase/supabase-js'

export type UserProfile = {
  id: string
  name: string | null
  email: string | null
  birthday: string | null
  location: string | null
  timezone: string | null
}

export type UserPersonalizationContext = {
  profile: UserProfile | null
}

/**
 * Fetches user profile information from Supabase auth
 * Validates that the authenticated user matches the expected userId
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  // Validate that the authenticated user matches the expected userId
  if (user.id !== userId) {
    console.error('User ID mismatch: expected', userId, 'got', user.id)
    return null
  }

  return {
    id: user.id,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email ?? null,
    birthday: user.user_metadata?.birthday ?? null,
    location: user.user_metadata?.location ?? null,
    timezone: user.user_metadata?.timezone ?? null,
  }
}

/**
 * Gets the full user personalization context for the agent
 */
export async function getUserPersonalizationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPersonalizationContext> {
  const profile = await getUserProfile(supabase, userId)

  return {
    profile,
  }
}

/**
 * Gets just the user's name from the context
 */
export function getUserName(context: UserPersonalizationContext): string | null {
  return context.profile?.name ?? null
}

