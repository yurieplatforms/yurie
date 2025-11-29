'use client'

// Tool use display is now integrated into the Reasoning component.
// See components/ai/reasoning.tsx for the implementation.
// This file is kept for potential future standalone tool result display.

import {
  Search,
  Code,
  FileCode,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import type { ToolUseEvent } from '@/lib/types'

const toolCompletedLabels: Record<string, string> = {
  web_search: 'Searched',
  web_fetch: 'Read',
  exa_search: 'Browsed',
  calculator: 'Calculated',
  memory: 'Remembered',
  memory_save: 'Saved',
  memory_retrieve: 'Recalled',
  run_code: 'Ran code',
  code_execution: 'Executed code',
  bash_code_execution: 'Ran command',
  text_editor_code_execution: 'Edited file',
}

interface ToolResultsProps {
  toolUses: ToolUseEvent[]
}

export function ToolResults({ toolUses }: ToolResultsProps) {
  const completedTools = toolUses.filter(
    (t) => t.status === 'end' && (t.result || t.codeExecution || t.webSearch || t.exaSearch),
  )

  if (completedTools.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {completedTools.map((tool, index) => {
        const isCodeExecution = tool.codeExecution !== undefined
        const isWebSearch = tool.webSearch !== undefined
        const isExaSearch = tool.exaSearch !== undefined

        return (
          <div
            key={`result-${tool.name}-${index}`}
            className="rounded-lg border bg-muted/40 shadow-sm dark:border-zinc-800"
          >
            <div className="flex items-center gap-2 px-3 py-2 text-zinc-500 dark:text-zinc-400">
              <Code className="h-4 w-4" />
              <span className="text-base font-medium">
                {toolCompletedLabels[tool.name] || tool.name} result
              </span>
              {isCodeExecution && tool.codeExecution?.type === 'bash' && (
                <span className={`ml-auto text-xs ${
                  tool.codeExecution.returnCode === 0 
                    ? 'text-emerald-500' 
                    : 'text-red-500'
                }`}>
                  exit {tool.codeExecution.returnCode ?? 0}
                </span>
              )}
              {isWebSearch && !tool.webSearch?.errorCode && (
                <span className="ml-auto text-xs text-emerald-500">
                  {tool.webSearch?.results.length ?? 0} result{(tool.webSearch?.results.length ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
              {isWebSearch && tool.webSearch?.errorCode && (
                <span className="ml-auto text-xs text-red-500">
                  {tool.webSearch.errorCode}
                </span>
              )}
              {isExaSearch && !tool.exaSearch?.error && (
                <span className="ml-auto text-xs text-emerald-500">
                  {tool.exaSearch?.results.length ?? 0} result{(tool.exaSearch?.results.length ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
              {isExaSearch && tool.exaSearch?.error && (
                <span className="ml-auto text-xs text-red-500">
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
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                          {tool.exaSearch.category}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {tool.exaSearch?.error && (
                    <div className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Search error: {tool.exaSearch.error}</span>
                    </div>
                  )}
                  
                  {tool.exaSearch?.results && tool.exaSearch.results.length > 0 && (
                    <div className="space-y-2">
                      {tool.exaSearch.results.map((result, i) => (
                        <a
                          key={i}
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/link flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-zinc-400 group-hover/link:text-violet-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-zinc-700 group-hover/link:text-violet-500 dark:text-zinc-300 dark:group-hover/link:text-violet-400">
                              {result.title || 'Untitled'}
                            </div>
                            <div className="truncate text-xs text-zinc-400">
                              {result.url}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                              {result.author && (
                                <span>By: {result.author}</span>
                              )}
                              {result.publishedDate && (
                                <span>Published: {new Date(result.publishedDate).toLocaleDateString()}</span>
                              )}
                            </div>
                            {result.text && (
                              <div className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                {result.text.slice(0, 200)}...
                              </div>
                            )}
                          </div>
                        </a>
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
                    <div className="flex items-center gap-2 rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
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
              ) : isCodeExecution && tool.codeExecution?.type === 'bash' ? (
                <div className="space-y-2">
                  {tool.codeExecution.command && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">Command:</span>
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
                        {tool.codeExecution.command}
                      </pre>
                    </div>
                  )}
                  {tool.codeExecution.stdout && (
                    <div>
                      <span className="text-xs font-medium text-zinc-500">Output:</span>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
                        {tool.codeExecution.stdout}
                      </pre>
                    </div>
                  )}
                  {tool.codeExecution.stderr && (
                    <div>
                      <span className="text-xs font-medium text-red-500">Error:</span>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                        {tool.codeExecution.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              ) : isCodeExecution && tool.codeExecution?.type === 'text_editor' ? (
                <div className="space-y-2">
                  {tool.codeExecution.path && (
                    <div className="flex items-center gap-2">
                      <FileCode className="h-3 w-3" />
                      <span className="font-mono text-xs">{tool.codeExecution.path}</span>
                      {tool.codeExecution.isFileUpdate && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          updated
                        </span>
                      )}
                    </div>
                  )}
                  {tool.codeExecution.content && (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
                      {tool.codeExecution.content}
                    </pre>
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
