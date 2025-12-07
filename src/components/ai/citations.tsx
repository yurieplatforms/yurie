'use client'

import { memo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type {
  MessageCitation,
  CharLocationCitation,
  PageLocationCitation,
  ContentBlockLocationCitation,
  WebSearchCitation,
} from '@/lib/types'
import { ExternalLinkIcon, FileTextIcon, BookOpenIcon } from 'lucide-react'

/**
 * Helper to get a unique key for deduplicating citations
 */
export function getCitationKey(citation: MessageCitation): string {
  switch (citation.type) {
    case 'web_search_result_location':
      return `web:${citation.url}`
    case 'search_result_location':
      return `search:${citation.source}:${citation.startBlockIndex}`
    case 'char_location':
      return `char:${citation.documentIndex}:${citation.startCharIndex}`
    case 'page_location':
      return `page:${citation.documentIndex}:${citation.startPageNumber}`
    case 'content_block_location':
      return `block:${citation.documentIndex}:${citation.startBlockIndex}`
    default:
      return `unknown:${Math.random()}`
  }
}

/**
 * Get the display location for a citation
 */
function getCitationLocation(citation: MessageCitation): string {
  switch (citation.type) {
    case 'web_search_result_location':
      return citation.title || new URL(citation.url).hostname
    case 'search_result_location':
      return citation.title || citation.source
    case 'char_location':
      return citation.documentTitle || `Document ${citation.documentIndex + 1}`
    case 'page_location':
      const pageStart = citation.startPageNumber
      const pageEnd = citation.endPageNumber - 1
      const pageRange = pageStart === pageEnd ? `Page ${pageStart}` : `Pages ${pageStart}-${pageEnd}`
      return `${citation.documentTitle || `Document ${citation.documentIndex + 1}`} (${pageRange})`
    case 'content_block_location':
      return citation.documentTitle || `Document ${citation.documentIndex + 1}`
    default:
      return 'Source'
  }
}

/**
 * Get the icon for a citation type
 */
function getCitationIcon(citation: MessageCitation) {
  switch (citation.type) {
    case 'web_search_result_location':
      return <ExternalLinkIcon className="h-3 w-3" />
    case 'page_location':
      return <BookOpenIcon className="h-3 w-3" />
    default:
      return <FileTextIcon className="h-3 w-3" />
  }
}

/**
 * Check if a citation is a document citation
 */
export function isDocumentCitation(
  citation: MessageCitation
): citation is CharLocationCitation | PageLocationCitation | ContentBlockLocationCitation {
  return (
    citation.type === 'char_location' ||
    citation.type === 'page_location' ||
    citation.type === 'content_block_location'
  )
}

export type CitationMarkProps = {
  citation: MessageCitation
  index: number
  className?: string
}

/**
 * Inline superscript citation marker with tooltip
 */
export const CitationMark = memo(function CitationMark({
  citation,
  index,
  className,
}: CitationMarkProps) {
  const location = getCitationLocation(citation)
  const icon = getCitationIcon(citation)
  const citedText = 'citedText' in citation ? citation.citedText : ''
  
  // For web search citations, make the link clickable
  const isWebSearch = citation.type === 'web_search_result_location'
  const url = isWebSearch ? (citation as WebSearchCitation).url : undefined

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center',
            'h-4 min-w-4 px-1 rounded-sm',
            'text-[10px] font-medium leading-none',
            'bg-[#7F91E0]/20 text-[#7F91E0] hover:bg-[#7F91E0]/30',
            'dark:bg-[#7F91E0]/20 dark:text-[#7F91E0] dark:hover:bg-[#7F91E0]/30',
            'transition-colors cursor-pointer',
            'align-super -translate-y-0.5',
            className
          )}
          aria-label={`Citation ${index + 1}: ${location}`}
        >
          {index + 1}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-sm p-3 bg-zinc-900 dark:bg-zinc-800 text-zinc-100"
      >
        <div className="space-y-2">
          {/* Source header */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {icon}
            <span className="truncate">{location}</span>
          </div>
          
          {/* Cited text */}
          {citedText && (
            <blockquote className="text-sm border-l-2 border-[#7F91E0] pl-2 text-zinc-200 italic">
              &ldquo;{citedText.length > 200 ? `${citedText.slice(0, 200)}...` : citedText}&rdquo;
            </blockquote>
          )}
          
          {/* Link for web search citations */}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#7F91E0] hover:text-[#8FA0E8] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View source
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
})

export type CitationsListProps = {
  citations: MessageCitation[]
  className?: string
}

/**
 * Compact list of all citations for a message
 */
export const CitationsList = memo(function CitationsList({
  citations,
  className,
}: CitationsListProps) {
  if (!citations || citations.length === 0) return null

  // Deduplicate citations by key
  const seen = new Set<string>()
  const uniqueCitations = citations.filter((c) => {
    const key = getCitationKey(c)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (uniqueCitations.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5 mt-2', className)}>
      {uniqueCitations.map((citation, i) => (
        <CitationMark
          key={getCitationKey(citation)}
          citation={citation}
          index={i}
        />
      ))}
    </div>
  )
})

export type CitationsFooterProps = {
  citations: MessageCitation[]
  className?: string
}

/**
 * Footer section showing all citation sources
 */
export const CitationsFooter = memo(function CitationsFooter({
  citations,
  className,
}: CitationsFooterProps) {
  if (!citations || citations.length === 0) return null

  // Deduplicate citations by key
  const seen = new Set<string>()
  const uniqueCitations = citations.filter((c) => {
    const key = getCitationKey(c)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (uniqueCitations.length === 0) return null

  return (
    <div className={cn('mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800', className)}>
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
        Sources ({uniqueCitations.length})
      </div>
      <div className="space-y-1.5">
        {uniqueCitations.map((citation, i) => {
          const location = getCitationLocation(citation)
          const icon = getCitationIcon(citation)
          const isWebSearch = citation.type === 'web_search_result_location'
          const url = isWebSearch ? (citation as WebSearchCitation).url : undefined

          return (
            <div
              key={getCitationKey(citation)}
              className="flex items-start gap-2 text-sm"
            >
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-sm text-[10px] font-medium bg-[#7F91E0]/20 text-[#7F91E0] dark:bg-[#7F91E0]/20 dark:text-[#7F91E0]">
                {i + 1}
              </span>
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                {icon}
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#7F91E0] dark:hover:text-[#7F91E0] hover:underline truncate max-w-[300px]"
                  >
                    {location}
                  </a>
                ) : (
                  <span className="truncate max-w-[300px]">{location}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

