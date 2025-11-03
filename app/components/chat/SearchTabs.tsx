"use client"

import * as React from 'react'
import { Atom, Globe, Image as ImageIcon, Film, Newspaper } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import type { SearchTab } from '@/app/types/search'

type Props = {
  activeTab: SearchTab
  onTabChange: (tab: SearchTab) => void
  className?: string
  disableYurieAnimation?: boolean
  animateOnChange?: boolean
}

const TABS: SearchTab[] = ['Yurie', 'All', 'Images', 'Videos', 'News']

export function SearchTabs({ activeTab, onTabChange, className, disableYurieAnimation, animateOnChange }: Props) {
  const [indicatorStyle, setIndicatorStyle] = React.useState({ left: 0, width: 0 })
  const [didInitialLayout, setDidInitialLayout] = React.useState(false)
  const [isIndicatorReady, setIsIndicatorReady] = React.useState(false)
  const tabsRef = React.useRef<(HTMLButtonElement | null)[]>([])
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const activeIndex = TABS.indexOf(activeTab)
    const activeButton = tabsRef.current[activeIndex]
    const container = containerRef.current

    if (activeButton && container) {
      const containerRect = container.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()
      
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      })
      if (!isIndicatorReady) setIsIndicatorReady(true)
    }
    if (!didInitialLayout) setDidInitialLayout(true)
  }, [activeTab])

  return (
    <div className={cn('relative z-10', className)}>
      <div 
        ref={containerRef}
        className="relative inline-flex items-center gap-1 rounded-full bg-neutral-100/70 dark:bg-neutral-900/40 p-1"
      >
        {/* Sliding active indicator */}
        <div
          className={cn(
            'absolute top-1 h-[calc(100%-0.5rem)] rounded-full bg-neutral-100 dark:bg-neutral-800/70 border border-neutral-300 dark:border-neutral-700',
            !isIndicatorReady && 'invisible',
            disableYurieAnimation && !didInitialLayout
              ? 'transition-none'
              : animateOnChange
                ? 'transition-all duration-300 ease-out'
                : 'transition-none'
          )}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
        
        {TABS.map((tab, index) => {
          const isActive = tab === activeTab
          return (
            <button
              key={tab}
              ref={(el) => (tabsRef.current[index] = el)}
              type="button"
              onClick={() => onTabChange(tab)}
              aria-pressed={isActive}
              aria-label={tab === 'Yurie' ? 'Yurie AI Search' : `${tab} search`}
              className={cn(
                'relative h-9 px-3 sm:px-3.5 inline-flex items-center justify-center gap-1.5 rounded-full text-sm sm:text-[15px] font-medium cursor-pointer select-none outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 focus-visible:ring-offset-transparent z-10',
                tab === 'Yurie' && disableYurieAnimation && !didInitialLayout ? 'transition-none' : 'transition-colors duration-200',
                isActive
                  ? 'text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100'
              )}
            >
              {tab === 'Yurie' && (
                <Atom 
                  className={cn(
                    'size-4 shrink-0',
                    disableYurieAnimation ? 'transition-none' : 'transition-transform duration-200'
                  )} 
                  aria-hidden="true" 
                />
              )}
              {tab === 'All' && <Globe className="size-4 transition-transform duration-200" aria-hidden="true" />}
              {tab === 'Images' && <ImageIcon className="size-4 transition-transform duration-200" aria-hidden="true" />}
              {tab === 'Videos' && <Film className="size-4 transition-transform duration-200" aria-hidden="true" />}
              {tab === 'News' && <Newspaper className="size-4 transition-transform duration-200" aria-hidden="true" />}
              {tab !== 'Yurie' && <span className="whitespace-nowrap">{tab}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}