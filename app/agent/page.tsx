import type { Metadata } from 'next'
import AgentChat from '@/components/agent-chat'

export const metadata: Metadata = {
  title: 'Agent',
}

export default function AgentPage() {
  return (
    <main className="flex min-h-[60vh] flex-col space-y-6">
      <div className="flex-1">
        <AgentChat />
      </div>
    </main>
  )
}


