"use client"

import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SearchResults } from '@/app/components/ui/search-results'
import { cn } from '@/app/lib/utils'
import { Search as SearchIcon } from 'lucide-react'

type TabKey = 'All' | 'Images' | 'Videos' | 'News'

export default function HomeSearch() {
  const [q, setQ] = useState('')
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('All')

  // Hydrate from URL ?q= for shareable links
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const initialQ = (sp.get('q') || '').trim()
      if (initialQ) {
        setQ(initialQ)
        // kick off initial search
        queueMicrotask(() => {
          runSearch(initialQ)
        })
      }
    } catch {}
  }, [])

  const runSearch = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? q).trim()
    if (!query) return
    setLoading(true)
    setError(null)
    try {
      const usp = new URLSearchParams({ q: query, hl: 'en', gl: 'us', google_domain: 'google.com', safe: 'active', num: '10' })
      const res = await fetch(`/api/search?${usp.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setActiveTab('All')
      // update URL for shareability without hard navigation
      try {
        const u = new URL(window.location.href)
        u.searchParams.set('q', query)
        window.history.replaceState({}, '', u.toString())
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [q])

  const hasResults = useMemo(() => Boolean(data && (data.all?.organic_results?.length || data.images?.images_results?.length || data.videos?.videos_results?.length || data.news?.news_results?.length)), [data])

  return (
    <section className="w-full">
      {/* Hero search when no results yet */}
      {!hasResults && (
        <div className="flex flex-col items-center justify-center text-center pt-28 sm:pt-32 pb-8">
          <div className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6 select-none">Yurie</div>
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#303030] px-4 py-2.5 shadow-sm">
              <SearchIcon className="w-5 h-5 text-neutral-500" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                placeholder="Search the web..."
                className="flex-1 bg-transparent outline-none text-base text-neutral-900 dark:text-white placeholder:text-neutral-500"
                aria-label="Search"
              />
              <button
                onClick={() => runSearch()}
                disabled={loading || !q.trim()}
                className={cn('px-4 py-1.5 rounded-full text-sm font-medium text-white bg-[#7f91e0] hover:bg-[#6a7dc4] transition', (loading || !q.trim()) && 'opacity-60')}
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
            {error && (
              <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
            )}
          </div>
        </div>
      )}

      {/* Results layout with compact header */}
      {hasResults && (
        <div className="w-full max-w-5xl mx-auto">
          <div className="sticky top-0 z-10 -mx-2 sm:-mx-4 px-2 sm:px-4 pt-2 pb-3 bg-[rgb(250,250,250)] dark:bg-[#1b1b1f] border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="flex-1 max-w-2xl">
                <div className="flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#303030] px-4 py-2">
                  <SearchIcon className="w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                    className="flex-1 bg-transparent outline-none text-sm text-neutral-900 dark:text-white placeholder:text-neutral-500"
                    aria-label="Search"
                  />
                  <button
                    onClick={() => runSearch()}
                    disabled={loading || !q.trim()}
                    className={cn('px-3 py-1 rounded-full text-xs font-medium text-white bg-[#7f91e0] hover:bg-[#6a7dc4] transition', (loading || !q.trim()) && 'opacity-60')}
                  >
                    {loading ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {(['All','Images','Videos','News'] as const).map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition',
                    activeTab === tab
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                      : 'bg-white dark:bg-[#303030] text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-[#3A3A40]'
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="mt-4 px-2 sm:px-4">
            <SearchResults data={data} section={activeTab} />
          </div>
        </div>
      )}
    </section>
  )
}


