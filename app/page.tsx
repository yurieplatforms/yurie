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
    <main className="fixed inset-0 top-24 flex flex-col overflow-hidden">
      <div className="mx-auto h-full w-full max-w-screen-sm overflow-hidden px-4">
        <AgentChat chatId={id} />
      </div>
    </main>
  )
}
