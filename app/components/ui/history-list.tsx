"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSidebar } from './sidebar'
import { cn } from '@/app/lib/utils'
import { loadHistory, removeConversation, clearHistory, type Conversation } from '@/app/lib/history'
import { SquarePen, X } from 'lucide-react'

function formatTime(ts: number): string {
  try {
    const d = new Date(ts)
    const now = Date.now()
    const diff = Math.max(0, now - ts)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  } catch { return '' }
}

export function HistoryList() {
  const { open } = useSidebar()
  const [items, setItems] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  const refresh = useCallback(() => {
    const list = loadHistory().sort((a, b) => b.updatedAt - a.updatedAt)
    setItems(list)
    try { setActiveId(sessionStorage.getItem('chat:currentId')) } catch {}
  }, [])

  useEffect(() => {
    refresh()
    const onHist = () => refresh()
    const onLoad = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>
      setActiveId(ce?.detail?.id || null)
    }
    const onNew = () => setActiveId(null)
    window.addEventListener('history:updated' as any, onHist as any)
    window.addEventListener('chat:load' as any, onLoad as any)
    window.addEventListener('chat:new' as any, onNew as any)
    return () => {
      window.removeEventListener('history:updated' as any, onHist as any)
      window.removeEventListener('chat:load' as any, onLoad as any)
      window.removeEventListener('chat:new' as any, onNew as any)
    }
  }, [refresh])

  const handleNew = useCallback(() => {
    window.dispatchEvent(new CustomEvent('chat:new'))
  }, [])

  const handleOpen = useCallback((id: string) => {
    window.dispatchEvent(new CustomEvent('chat:load', { detail: { id } }))
  }, [])

  const handleDelete = useCallback((id: string) => {
    const confirmDelete = window.confirm('Delete this conversation?')
    if (!confirmDelete) return
    removeConversation(id)
    try {
      const curr = sessionStorage.getItem('chat:currentId')
      if (curr === id) {
        sessionStorage.removeItem('chat:currentId')
        window.dispatchEvent(new CustomEvent('chat:new'))
      }
    } catch {}
  }, [])

  const handleClearAll = useCallback(() => {
    if (items.length === 0) return
    const confirmDelete = window.confirm('Clear all conversations?')
    if (!confirmDelete) return
    clearHistory()
    refresh()
  }, [items.length, refresh])

  const ListEmpty = useMemo(() => (
    <div className="text-sm text-neutral-500 dark:text-neutral-400 px-1 py-2">
      No conversations yet.
    </div>
  ), [])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!listRef.current) return
    const focusables = Array.from(listRef.current.querySelectorAll<HTMLButtonElement>('button[data-item="open"]'))
    const currIndex = focusables.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = currIndex < 0 ? 0 : Math.min(focusables.length - 1, currIndex + 1)
      focusables[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = currIndex < 0 ? focusables.length - 1 : Math.max(0, currIndex - 1)
      focusables[prev]?.focus()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (currIndex >= 0) {
        const id = focusables[currIndex]?.getAttribute('data-id')
        if (id) handleDelete(id)
      }
    }
  }, [handleDelete])

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className={cn('flex items-center w-full', open ? 'justify-start' : 'justify-center')}>
        <div className={cn('inline-flex items-center gap-1', open ? '' : 'w-full justify-center')}>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-full text-xs font-medium cursor-pointer bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 flex-shrink-0',
              open ? 'h-8 px-3' : 'h-9 w-9 justify-center p-0 md:translate-x-[1px] transform'
            )}
            onClick={handleNew}
            aria-label="New thread"
            title={!open ? 'New thread' : undefined}
          >
            <SquarePen className="h-4 w-4" strokeWidth={2} />
          </button>
          {open && items.length > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full text-xs font-medium cursor-pointer bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-900 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 flex-shrink-0 h-8 px-3"
              aria-label="Clear all conversations"
              title="Clear all"
              onClick={handleClearAll}
            >
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Conversations"
        aria-activedescendant={open && activeId ? `conv-${activeId}` : undefined}
        className="flex flex-col gap-1 mt-1"
        onKeyDown={onKeyDown}
      >
        {open && (items.length === 0 ? ListEmpty : items.map((c) => {
          const isActive = activeId === c.id
          return (
            <li
              key={c.id}
              id={`conv-${c.id}`}
              role="option"
              aria-selected={isActive}
              className={cn(
                'group/history w-full inline-flex items-center gap-2 rounded-md',
                isActive ? 'bg-neutral-200/60 dark:bg-white/8 hover:bg-neutral-200 dark:hover:bg-white/10' : 'hover:bg-neutral-200/60 dark:hover:bg-white/8'
              )}
            >
              <button
                type="button"
                data-item="open"
                data-id={c.id}
                className="flex items-center gap-2 flex-1 text-left min-w-0 py-2 px-2 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 justify-start"
                onClick={() => handleOpen(c.id)}
              >
                <div className="min-w-0">
                  <div className="text-sm text-neutral-800 dark:text-neutral-100 truncate">{c.title}</div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{formatTime(c.updatedAt)}</div>
                </div>
              </button>
              <button
                type="button"
                aria-label="Delete conversation"
                className="opacity-0 group-hover/history:opacity-100 transition-opacity text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 my-1 cursor-pointer"
                onClick={() => handleDelete(c.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          )
        }))}
      </ul>
    </div>
  )
}


