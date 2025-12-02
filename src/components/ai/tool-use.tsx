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
  exa_search: 'Browsed',
  exa_find_similar: 'Found similar',
  exa_answer: 'Answered',
  calculator: 'Calculated',
  memory: 'Remembered',
  memory_save: 'Saved',
  memory_retrieve: 'Recalled',
}

interface ToolResultsProps {
  toolUses: ToolUseEvent[]
}

export function ToolResults({ toolUses }: ToolResultsProps) {
  const completedTools = toolUses.filter(
    (t) => t.status === 'end' && (t.result || t.webSearch || t.exaSearch),
  )

  if (completedTools.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {completedTools.map((tool, index) => {
        const isWebSearch = tool.webSearch !== undefined
        const isExaSearch = tool.exaSearch !== undefined

        return (
          <div
            key={`result-${tool.name}-${index}`}
            className="rounded-2xl border bg-muted/40 shadow-sm dark:border-zinc-800"
          >
            <div className="flex items-center gap-2 px-3 py-2 text-zinc-500 dark:text-zinc-400">
              <Code className="h-4 w-4" />
              <span className="text-base font-medium">
                {toolCompletedLabels[tool.name] || tool.name} result
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
              {isExaSearch && !tool.exaSearch?.error && (
                <span className="ml-auto text-xs text-[var(--color-success)]">
                  {tool.exaSearch?.results.length ?? 0} result{(tool.exaSearch?.results.length ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
              {isExaSearch && tool.exaSearch?.error && (
                <span className="ml-auto text-xs text-[var(--color-destructive)]">
                  error
                </span>
              )}
            </div>

            <div className="border-t px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              {isExaSearch ? (
                <div className="space-y-3">
                  {tool.exaSearch?.query && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Search className="h-3 w-3" />
                      <span>Searched for: &quot;{tool.exaSearch.query}&quot;</span>
                      {tool.exaSearch.category && (
                        <span className="rounded bg-[var(--color-info)]/10 px-1.5 py-0.5 text-xs text-[var(--color-info)]">
                          {tool.exaSearch.category}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {tool.exaSearch?.error && (
                    <div className="flex items-center gap-2 rounded-md bg-[var(--color-destructive)]/10 p-2 text-xs text-[var(--color-destructive)]">
                      <AlertCircle className="h-4 w-4" />
                      <span>Search error: {tool.exaSearch.error}</span>
                    </div>
                  )}
                  
                  {tool.exaSearch?.results && tool.exaSearch.results.length > 0 && (
                    <div className="space-y-3">
                      {tool.exaSearch.results.map((result, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-zinc-200 bg-white p-3 transition-colors dark:border-zinc-700 dark:bg-zinc-800/50"
                        >
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/link flex items-start gap-2"
                          >
                            <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-zinc-400 group-hover/link:text-[var(--color-info)]" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-zinc-800 group-hover/link:text-[var(--color-info)] dark:text-zinc-200">
                                {result.title || 'Untitled'}
                              </div>
                              <div className="truncate text-xs text-zinc-400">
                                {result.url}
                              </div>
                            </div>
                            {result.score !== undefined && (
                              <span className="ml-auto rounded-full bg-[var(--color-info)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-info)]">
                                {(result.score * 100).toFixed(0)}%
                              </span>
                            )}
                          </a>
                          
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                            {result.author && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-700">
                                {result.author}
                              </span>
                            )}
                            {result.publishedDate && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-700">
                                {new Date(result.publishedDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Highlights - key excerpts */}
                          {result.highlights && result.highlights.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <div className="text-xs font-medium text-[var(--color-info)]">
                                Key Highlights:
                              </div>
                              {result.highlights.map((highlight, j) => (
                                <div
                                  key={j}
                                  className="rounded-md border-l-2 border-[var(--color-info)]/50 bg-[var(--color-info)]/5 py-1.5 pl-3 pr-2 text-xs text-zinc-700 dark:text-zinc-300"
                                >
                                  &ldquo;{highlight}&rdquo;
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Summary */}
                          {result.summary && (
                            <div className="mt-2">
                              <div className="text-xs font-medium text-[var(--color-success)]">
                                Summary:
                              </div>
                              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                                {result.summary}
                              </div>
                            </div>
                          )}

                          {/* Text content fallback */}
                          {result.text && !result.highlights?.length && !result.summary && (
                            <div className="mt-2 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">
                              {result.text.slice(0, 300)}...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {tool.exaSearch?.results && tool.exaSearch.results.length === 0 && !tool.exaSearch.error && (
                    <div className="text-xs text-zinc-500">
                      No results found for this search.
                    </div>
                  )}
                </div>
              ) : isWebSearch ? (
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
