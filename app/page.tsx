import type { Metadata } from 'next'
import ChatClient from './chat/components/ChatClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Yurie' },
  description: 'Try Yurie AI in the Playground.',
}

export default function Page() {
  return <ChatClient />
}
