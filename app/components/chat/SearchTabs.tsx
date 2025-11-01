import { cn } from '@/app/lib/utils'
import type { SearchTab } from '@/app/types/search'
import { Globe, Image as ImageIcon, Video, Newspaper } from 'lucide-react'

type SearchTabsProps = {
  activeTab: SearchTab
  onTabChange: (tab: SearchTab) => void
}

const FaviconIcon: React.FC<{ className?: string; size?: number }> = ({ className, size }) => {
  return (
    <img
      src="/favicon.ico"
      alt=""
      aria-hidden="true"
      className={cn('inline-block', className)}
      width={size ?? 16}
      height={size ?? 16}
    />
  )
}

const TAB_ITEMS: { value: SearchTab; label: string; Icon: React.ComponentType<{ className?: string; size?: number }> }[] = [
  { value: 'AI Mode', label: 'AI Mode', Icon: FaviconIcon },
  { value: 'All', label: 'All', Icon: Globe },
  { value: 'Images', label: 'Images', Icon: ImageIcon },
  { value: 'Videos', label: 'Videos', Icon: Video },
  { value: 'News', label: 'News', Icon: Newspaper },
]

export function SearchTabs({ activeTab, onTabChange }: SearchTabsProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-6">
      {TAB_ITEMS.map(({ value, label, Icon }) => (
        <button
          key={value}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border h-9 px-4 text-sm sm:text-[15px] font-medium transition-colors duration-150 hover:cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600 shadow-sm hover:shadow-md',
            activeTab === value
              ? 'bg-neutral-100 text-neutral-900 border-neutral-300 dark:bg-neutral-800/70 dark:text-neutral-100 dark:border-neutral-700'
              : 'bg-transparent text-neutral-700 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900 hover:border-neutral-300 dark:text-neutral-300 dark:border-neutral-800 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100 dark:hover:border-neutral-700'
          )}
          onClick={() => onTabChange(value)}
          aria-pressed={activeTab === value}
          title={label}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

