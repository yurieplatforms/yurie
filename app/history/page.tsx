import { HistoryList } from '@/components/history-list'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'History',
}

export default function HistoryPage() {
  return <HistoryList />
}
