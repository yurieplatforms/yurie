import type { Metadata } from 'next'
import AgentChat from '@/components/agent-chat'

export const metadata: Metadata = {
  title: 'Agent',
}

export default function AgentPage() {
  return (
    <main className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AgentChat />
      </div>
    </main>
  )
}


