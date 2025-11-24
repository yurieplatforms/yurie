import type { Metadata } from 'next'
import AgentChat from '@/components/chat/agent-chat'

export const metadata: Metadata = {
  title: 'Home',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return (
    <main className="flex min-h-[60vh] flex-col space-y-6">
      <div className="flex-1">
        <AgentChat chatId={id} />
      </div>
    </main>
  )
}
