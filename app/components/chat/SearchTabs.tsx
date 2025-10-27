import { cn } from '@/app/lib/utils'
import type { SearchTab } from '@/app/types/search'

type SearchTabsProps = {
  activeTab: SearchTab
  onTabChange: (tab: SearchTab) => void
}

const tabs: SearchTab[] = ['AI Mode', 'All', 'Images', 'Videos', 'News']

export function SearchTabs({ activeTab, onTabChange }: SearchTabsProps) {
  return (
    <div className="flex items-center gap-6 sm:gap-8 flex-wrap mt-6">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={cn(
            'text-[15px] sm:text-base transition hover:cursor-pointer focus:outline-none focus-visible:outline-none',
            activeTab === tab
              ? 'text-neutral-900 dark:text-white font-semibold'
              : 'text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100'
          )}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

