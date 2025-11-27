'use server'

import { createClient } from '@/app/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const fullName = formData.get('fullName') as string
  const avatarUrl = formData.get('avatarUrl') as string

  const updates: { full_name?: string; avatar_url?: string } = {}
  if (fullName) updates.full_name = fullName
  if (avatarUrl) updates.avatar_url = avatarUrl

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
