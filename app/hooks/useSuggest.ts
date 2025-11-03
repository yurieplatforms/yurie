"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

export type UseSuggestState = {
  suggestions: string[]
  highlightedIndex: number
  isFetchingSuggest: boolean
  showSuggestions: boolean
}

export type UseSuggestApi = UseSuggestState & {
  setShowSuggestions: (show: boolean) => void
  setHighlightedIndex: (i: number) => void
  updateQuery: (q: string, isEmptyLayout: boolean, isActive: boolean) => void
  pickFromCache: (q: string) => string[] | null
  reset: () => void
}

/**
 * Autosuggest hook with in-memory LRU cache and prefix fallback.
 */
export function useSuggest(): UseSuggestApi {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isFetchingSuggest, setIsFetchingSuggest] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const suggestAbortRef = useRef<AbortController | null>(null)
  const suggestCacheRef = useRef<Map<string, string[]>>(new Map())

  const pickFromCache = useCallback((q: string): string[] | null => {
    const cache = suggestCacheRef.current
    if (cache.has(q)) return cache.get(q) || null
    for (let i = q.length - 1; i >= 1; i--) {
      const prefix = q.slice(0, i)
      if (cache.has(prefix)) return cache.get(prefix) || null
    }
    return null
  }, [])

  const updateQuery = useCallback((raw: string, isEmptyLayout: boolean, isActive: boolean) => {
    const q = (raw || '').trim()
    if (!isEmptyLayout) {
      setSuggestions([])
      setShowSuggestions(false)
      setHighlightedIndex(-1)
      try { suggestAbortRef.current?.abort() } catch {}
      suggestAbortRef.current = null
      return
    }
    if (!q) {
      if (isEmptyLayout && isActive) {
        // Caller should set default suggestions; we only manage fetching here
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
      setHighlightedIndex(-1)
      try { suggestAbortRef.current?.abort() } catch {}
      suggestAbortRef.current = null
      return
    }
    setShowSuggestions(true)
    const cached = pickFromCache(q)
    if (cached && cached.length > 0) {
      setSuggestions(cached)
      setHighlightedIndex(-1)
    }
    const shouldFetch = !suggestCacheRef.current.has(q)
    window.clearTimeout((updateQuery as any)._t)
    ;(updateQuery as any)._t = window.setTimeout(async () => {
      if (!shouldFetch) { setIsFetchingSuggest(false); return }
      try {
        try { suggestAbortRef.current?.abort() } catch {}
        const ac = new AbortController()
        suggestAbortRef.current = ac
        setIsFetchingSuggest(true)
        const usp = new URLSearchParams({ q, hl: 'en', gl: 'us', limit: '8' })
        const resp = await fetch(`/api/suggest?${usp.toString()}`, { signal: ac.signal, cache: 'no-store' })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        const list = Array.isArray(json?.suggestions) ? (json.suggestions as string[]) : []
        setSuggestions(list)
        setHighlightedIndex(-1)
        // LRU cache with cap 120
        const cache = suggestCacheRef.current
        try {
          if (!cache.has(q)) {
            if (cache.size >= 120) {
              const firstKey = cache.keys().next().value
              if (firstKey) cache.delete(firstKey)
            }
          } else {
            const existing = cache.get(q) || []
            cache.delete(q)
            cache.set(q, existing)
          }
          cache.set(q, list)
        } catch {}
      } catch {
        // noop
      } finally {
        setIsFetchingSuggest(false)
      }
    }, 100)
  }, [pickFromCache])

  const reset = useCallback(() => {
    setSuggestions([])
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    try { suggestAbortRef.current?.abort() } catch {}
    suggestAbortRef.current = null
  }, [])

  useEffect(() => () => { try { suggestAbortRef.current?.abort() } catch {} }, [])

  return {
    suggestions,
    highlightedIndex,
    isFetchingSuggest,
    showSuggestions,
    setShowSuggestions,
    setHighlightedIndex,
    updateQuery,
    pickFromCache,
    reset,
  }
}


