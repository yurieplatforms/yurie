"use client"

import * as React from 'react'
import { SearchResults } from '@/app/components/ui/search-results'

export default function SearchPage() {
  const [q, setQ] = React.useState('Coffee')
  const [data, setData] = React.useState<any | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const runSearch = React.useCallback(async () => {
    const query = q.trim()
    if (!query) return
    setLoading(true)
    setError(null)
    try {
      const usp = new URLSearchParams({ q: query, hl: 'en', gl: 'us', google_domain: 'google.com', safe: 'active', num: '100' })
      const res = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [q])

  React.useEffect(() => {
    runSearch()
  }, [])

  return (
    <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
          placeholder="Search Google & YouTube via SerpApi..."
          className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded-md px-3 py-2 bg-white dark:bg-[#303030] text-neutral-900 dark:text-white"
        />
        <button
          onClick={runSearch}
          disabled={loading || !q.trim()}
          className="px-3 py-2 rounded-md bg-[#7f91e0] hover:bg-[#6a7dc4] disabled:opacity-60 text-white"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
      <div className="mt-5">
        <SearchResults data={data} />
      </div>
      <div className="mt-6 text-xs text-neutral-500">
        Sources: <a className="underline" href="https://serpapi.com/search-api" target="_blank" rel="noopener noreferrer">SerpApi Search API</a>{' '}·{' '}
        <a className="underline" href="https://serpapi.com/news-results" target="_blank" rel="noopener noreferrer">Google News API docs</a>{' '}·{' '}
        <a className="underline" href="https://serpapi.com/search.json?q=Coffee&tbm=nws" target="_blank" rel="noopener noreferrer">tbm=nws example</a>{' '}·{' '}
        <a className="underline" href="https://serpapi.com/youtube-search-api" target="_blank" rel="noopener noreferrer">YouTube Search API</a>
      </div>
    </main>
  )
}


