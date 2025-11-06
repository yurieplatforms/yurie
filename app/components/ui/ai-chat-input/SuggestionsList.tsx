"use client"

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/app/lib/utils'

export type SuggestionsListProps = {
  suggestions: string[]
  isFetching: boolean
  inputValue: string
  highlightedIndex: number
  onHighlight: (index: number) => void
  onPick: (value: string) => void
}

export const SuggestionsList: React.FC<SuggestionsListProps> = ({
  suggestions,
  isFetching,
  inputValue,
  highlightedIndex,
  onHighlight,
  onPick,
}) => {
  return (
    <ul role="listbox" aria-label="Suggestions" className="max-h-[400px] overflow-auto">
      {isFetching && suggestions.length === 0 && (
        <li className="px-4 py-2.5 text-sm text-neutral-400 dark:text-neutral-500">
          Loading suggestions...
        </li>
      )}
      {suggestions.map((s, i) => (
        <li key={`${s}-${i}`}>
          <button
            type="button"
            role="option"
            aria-selected={i === highlightedIndex}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors cursor-pointer',
              i === highlightedIndex 
                ? 'bg-neutral-100 dark:bg-neutral-800' 
                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
            )}
            onMouseEnter={() => onHighlight(i)}
            onMouseDown={(e) => { e.preventDefault(); onPick(s) }}
          >
            <Search className="h-4 w-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
            <span className="text-neutral-700 dark:text-neutral-300 truncate">
              {s}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}


