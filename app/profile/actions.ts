'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const fullName = formData.get('fullName') as string
  const avatarUrl = formData.get('avatarUrl') as string
  const birthday = formData.get('birthday') as string
  const location = formData.get('location') as string
  const timezone = formData.get('timezone') as string

  const updates: { 
    full_name?: string
    avatar_url?: string
    birthday?: string
    location?: string
    timezone?: string
  } = {}
  
  if (fullName) updates.full_name = fullName
  if (avatarUrl) updates.avatar_url = avatarUrl
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
