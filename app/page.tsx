import type { Metadata } from 'next'
import AgentChat from '@/components/chat/agent-chat'

export const metadata: Metadata = {
  title: 'Yurie',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  return (
    <main data-page="home" className="flex h-[calc(100dvh-6rem)] flex-col overflow-hidden">
      <div className="h-full overflow-hidden">
        <AgentChat chatId={id} />
      </div>
    </main>
  )
}
