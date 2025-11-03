"use client"

import * as React from 'react'
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
    <>
      <ul role="listbox" aria-label="Suggestions" className="max-h-72 overflow-auto py-2">
        {isFetching && suggestions.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-500">Loading...</li>
        )}
        {suggestions.map((s, i) => (
          <li key={`${s}-${i}`}>
            <button
              type="button"
              role="option"
              aria-selected={i === highlightedIndex}
              className={cn(
                'w-full text-left px-3 py-2 text-[15px] transition-colors cursor-pointer text-neutral-900 dark:text-neutral-100',
                i === highlightedIndex ? 'bg-gray-100 dark:bg-[#333333]' : 'bg-transparent'
              )}
              onMouseEnter={() => onHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); onPick(s) }}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      {inputValue.trim() && (
        <div className="border-t border-gray-200 dark:border-[#444444] px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300 flex items-center justify-between">
          <span className="truncate">Search web for “{inputValue}”</span>
          <button
            type="button"
            className="ml-3 px-2.5 py-1 rounded-md text-white bg-[#7f91e0] hover:bg-[#6a7dc4] text-xs cursor-pointer"
            onMouseDown={(e) => { e.preventDefault(); onPick(inputValue) }}
          >
            Search
          </button>
        </div>
      )}
    </>
  )
}


