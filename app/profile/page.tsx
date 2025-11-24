import { createClient } from '@/app/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { ProfileContent } from './profile-content'

export const metadata: Metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-2xl w-full">
      <ProfileContent user={user} />
    </div>
  )
}
