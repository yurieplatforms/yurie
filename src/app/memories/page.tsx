import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { MemoriesContent } from './memories-content'
import { getMemories } from './actions'

export const metadata: Metadata = {
  title: 'Memories',
}

export default async function MemoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: memories } = await getMemories()

  return <MemoriesContent initialMemories={memories || []} />
}

