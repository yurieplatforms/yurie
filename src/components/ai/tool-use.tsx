'use client'

// Tool use display is now integrated into the Reasoning component.
// See components/ai/reasoning.tsx for the implementation.
// This file is kept for potential future standalone tool result display.

import {
  Search,
  Code,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import type { ToolUseEvent } from '@/lib/types'

const toolCompletedLabels: Record<string, string> = {
  web_search: 'Searched',
  web_fetch: 'Fetched',
  calculator: 'Calculated',
}

interface ToolResultsProps {
  toolUses: ToolUseEvent[]
}

export function ToolResults({ toolUses }: ToolResultsProps) {
  const completedTools = toolUses.filter(
    (t) => t.status === 'end' && (t.result || t.webSearch),
  )

  if (completedTools.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {completedTools.map((tool, index) => {
        const isWebSearch = tool.webSearch !== undefined

        return (
          <div
            key={`result-${tool.name}-${index}`}
            className="rounded-2xl border bg-muted/40 shadow-sm dark:border-zinc-800"
          >
            <div className="flex items-center gap-2 px-3 py-2 text-zinc-500 dark:text-zinc-400">
              <Code className="h-4 w-4" />
              <span className="text-base font-medium">
                {toolCompletedLabels[tool.name] || tool.name.replace(/_/g, ' ')} result
              </span>
              {isWebSearch && !tool.webSearch?.errorCode && (
                <span className="ml-auto text-xs text-[var(--color-success)]">
                  {tool.webSearch?.results.length ?? 0} result{(tool.webSearch?.results.length ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
              {isWebSearch && tool.webSearch?.errorCode && (
                <span className="ml-auto text-xs text-[var(--color-destructive)]">
                  {tool.webSearch.errorCode}
                </span>
              )}
            </div>

            <div className="border-t px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {isWebSearch ? (
                <div className="space-y-3">
                  {tool.webSearch?.query && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Search className="h-3 w-3" />
                      <span>Searched for: &quot;{tool.webSearch.query}&quot;</span>
                    </div>
                  )}
                  
                  {tool.webSearch?.errorCode && (
                    <div className="flex items-center gap-2 rounded-md bg-[var(--color-destructive)]/10 p-2 text-xs text-[var(--color-destructive)]">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        Search error: {
                          tool.webSearch.errorCode === 'max_uses_exceeded' ? 'Maximum searches reached' :
                          tool.webSearch.errorCode === 'too_many_requests' ? 'Rate limit exceeded' :
                          tool.webSearch.errorCode === 'query_too_long' ? 'Query too long' :
                          tool.webSearch.errorCode === 'invalid_input' ? 'Invalid search query' :
                          'Search unavailable'
                        }
                      </span>
                    </div>
                  )}
                  
                  {tool.webSearch?.results && tool.webSearch.results.length > 0 && (
                    <div className="space-y-2">
                      {tool.webSearch.results.map((result, i) => (
                        <a
                          key={i}
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/link flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-zinc-400 group-hover/link:text-[#7F91E0]" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-zinc-700 group-hover/link:text-[#7F91E0] dark:text-zinc-300 dark:group-hover/link:text-[#7F91E0]">
                              {result.title || 'Untitled'}
                            </div>
                            <div className="truncate text-xs text-zinc-400">
                              {result.url}
                            </div>
                            {result.pageAge && (
                              <div className="text-xs text-zinc-400">
                                Updated: {result.pageAge}
                              </div>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  
                  {tool.webSearch?.results && tool.webSearch.results.length === 0 && !tool.webSearch.errorCode && (
                    <div className="text-xs text-zinc-500">
                      No results found for this search.
                    </div>
                  )}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {tool.result}
                </pre>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
