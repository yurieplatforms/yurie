import { HistoryList } from '@/components/chat/history-list'
import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getUserChats } from '@/lib/chat/history'
import { SavedChat } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Threads',
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let initialChats: SavedChat[] = []
  if (user) {
    initialChats = await getUserChats(user.id, supabase)
  }

  return <HistoryList initialChats={initialChats} initialUserId={user?.id} />
}
