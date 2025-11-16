import type { Metadata } from 'next'
import AgentChat from '@/components/agent-chat'

export const metadata: Metadata = {
  title: 'Agent',
}

export default function AgentPage() {
  return (
    <main className="flex min-h-[60vh] flex-col space-y-6">
      <section className="space-y-2">
        <h1 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">
          Agent
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          A lightweight AI agent powered by OpenRouter. Use this space to
          experiment with prompts, explore workflows, and prototype automations
          using a PromptKit-inspired interface.
        </p>
      </section>
      <div className="flex-1">
        <AgentChat />
      </div>
    </main>
  )
}


