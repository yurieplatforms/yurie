'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const fullName = formData.get('fullName') as string
  const avatarUrl = formData.get('avatarUrl') as string
  const coverUrl = formData.get('coverUrl') as string
  const birthday = formData.get('birthday') as string
  const location = formData.get('location') as string
  const timezone = formData.get('timezone') as string

  const updates: { 
    full_name?: string
    avatar_url?: string
    cover_url?: string
    birthday?: string
    location?: string
    timezone?: string
  } = {}
  
  if (fullName) updates.full_name = fullName
  if (avatarUrl !== null) updates.avatar_url = avatarUrl
  if (coverUrl !== null) updates.cover_url = coverUrl
  if (birthday !== null) updates.birthday = birthday
  if (location !== null) updates.location = location
  if (timezone !== null) updates.timezone = timezone

  const { error } = await supabase.auth.updateUser({
    data: updates,
  })

  if (error) {
    console.error('Profile update error:', error)
    return { error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

// ============================================================================
// Focused Repository Management
// ============================================================================

export interface FocusedRepo {
  owner: string
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  private: boolean
  language: string | null
  defaultBranch: string
}

/**
 * Set the focused GitHub repository for the AI agent context.
 * This repo will be used as the default context when using GitHub tools.
 */
export async function setFocusedRepo(repo: FocusedRepo): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      github_focused_repo: repo
    },
  })

  if (error) {
    console.error('[GitHub] Failed to set focused repo:', error)
    return { error: error.message }
  }

  console.log(`[GitHub] Set focused repo: ${repo.fullName}`)
  revalidatePath('/profile')
  return { success: true }
}

/**
 * Get the currently focused GitHub repository.
 */
export async function getFocusedRepo(): Promise<{ repo?: FocusedRepo; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const focusedRepo = user.user_metadata?.github_focused_repo as FocusedRepo | undefined
  return { repo: focusedRepo }
}

/**
 * Clear the focused GitHub repository.
 */
export async function clearFocusedRepo(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      github_focused_repo: null
    },
  })

  if (error) {
    console.error('[GitHub] Failed to clear focused repo:', error)
    return { error: error.message }
  }

  console.log('[GitHub] Cleared focused repo')
  revalidatePath('/profile')
  return { success: true }
}
