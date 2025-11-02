"use client"

import * as React from 'react'
import { Atom, Globe, Image as ImageIcon, Video, Newspaper } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { SearchTab } from '@/app/types/search'

type Props = {
  activeTab: SearchTab
  onTabChange: (tab: SearchTab) => void
  className?: string
}

const TABS: SearchTab[] = ['Yurie', 'All', 'Images', 'Videos', 'News']

export function SearchTabs({ activeTab, onTabChange, className }: Props) {
  return (
    <div className={cn('relative z-10', className)}>
      <div className="inline-flex items-center gap-1 rounded-full bg-neutral-100/70 dark:bg-neutral-900/40 p-1">
        {TABS.map((tab) => {
          const isActive = tab === activeTab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              aria-pressed={isActive}
              className={cn(
                'h-9 px-3 sm:px-3.5 inline-flex items-center gap-1.5 rounded-full text-sm sm:text-[15px] font-medium transition-colors cursor-pointer select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 focus-visible:ring-offset-transparent border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 active:border-neutral-300 dark:active:border-neutral-700',
                isActive
                  ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800/70 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700'
                  : 'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100'
              )}
            >
              {tab === 'Yurie' && <Atom className="size-4" aria-hidden="true" />}
              {tab === 'All' && <Globe className="size-4" aria-hidden="true" />}
              {tab === 'Images' && <ImageIcon className="size-4" aria-hidden="true" />}
              {tab === 'Videos' && <Video className="size-4" aria-hidden="true" />}
              {tab === 'News' && <Newspaper className="size-4" aria-hidden="true" />}
              <span>{tab}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}


