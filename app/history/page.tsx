import { HistoryList } from '@/components/history-list'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Threads',
}

export default function HistoryPage() {
  return <HistoryList />
}
