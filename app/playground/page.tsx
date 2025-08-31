import type { Metadata } from 'next'
import ChatClient from './ChatClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Try Yurie AI in the Playground.',
}

export default function Page() {
  return <ChatClient />
}