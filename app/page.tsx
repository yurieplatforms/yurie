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
    <main className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="h-full">
        <AgentChat chatId={id} />
      </div>
    </main>
  )
}
