/**
 * Stream Processor
 * 
 * Handles processing of SSE stream events.
 * Extracts citations, web search results, and web fetch results.
 */

import type { SSEHandler } from './sse-handler'
import type {
  WebSearchCitation,
  SearchResultCitation,
  CharLocationCitation,
  PageLocationCitation,
  ContentBlockLocationCitation,
  MessageCitation,
  WebSearchErrorCode,
} from '@/lib/types'

// ============================================================================
// Types for raw API responses
// ============================================================================

export type RawCitation = {
  type: string
  url?: string
  source?: string
  search_result_index?: number
  document_index?: number
  document_title?: string
  start_char_index?: number
  end_char_index?: number
  start_page_number?: number
  end_page_number?: number
  title?: string
  cited_text?: string
  start_block_index?: number
  end_block_index?: number
}

export type WebFetchResultContent = {
  type: string
  url?: string
  content?: {
    type: string
    source?: { type: string; media_type?: string; data?: string }
    title?: string
  }
  retrieved_at?: string
  error_code?: string
}

export type WebSearchResultContent = {
  type: string
  url?: string
  title?: string
  page_age?: string
  encrypted_content?: string
  error_code?: string
}

// ============================================================================
// Citation Processing
// ============================================================================

/**
 * Processes raw citations from the API into typed citation objects
 */
export function processCitations(rawCitations: RawCitation[]): MessageCitation[] {
  const allCitations: MessageCitation[] = []

  // Web search result citations
  const webSearchCitations: WebSearchCitation[] = rawCitations
    .filter(c => c.type === 'web_search_result_location')
    .map(c => ({
      type: 'web_search_result_location' as const,
      url: c.url || '',
      title: c.title || '',
      citedText: c.cited_text || '',
    }))

  // Search result citations (from memory/document search)
  const searchResultCitations: SearchResultCitation[] = rawCitations
    .filter(c => c.type === 'search_result_location')
    .map(c => ({
      type: 'search_result_location' as const,
      source: c.source || '',
      title: c.title || null,
      citedText: c.cited_text || '',
      searchResultIndex: c.search_result_index ?? 0,
      startBlockIndex: c.start_block_index ?? 0,
      endBlockIndex: c.end_block_index ?? 0,
    }))

  // Character location citations (plain text documents)
  const charLocationCitations: CharLocationCitation[] = rawCitations
    .filter(c => c.type === 'char_location')
    .map(c => ({
      type: 'char_location' as const,
      citedText: c.cited_text || '',
      documentIndex: c.document_index ?? 0,
      documentTitle: c.document_title || null,
      startCharIndex: c.start_char_index ?? 0,
      endCharIndex: c.end_char_index ?? 0,
    }))

  // Page location citations (PDF documents)
  const pageLocationCitations: PageLocationCitation[] = rawCitations
    .filter(c => c.type === 'page_location')
    .map(c => ({
      type: 'page_location' as const,
      citedText: c.cited_text || '',
      documentIndex: c.document_index ?? 0,
      documentTitle: c.document_title || null,
      startPageNumber: c.start_page_number ?? 1,
      endPageNumber: c.end_page_number ?? 1,
    }))

  // Content block location citations (custom content documents)
  const contentBlockLocationCitations: ContentBlockLocationCitation[] = rawCitations
    .filter(c => c.type === 'content_block_location')
    .map(c => ({
      type: 'content_block_location' as const,
      citedText: c.cited_text || '',
      documentIndex: c.document_index ?? 0,
      documentTitle: c.document_title || null,
      startBlockIndex: c.start_block_index ?? 0,
      endBlockIndex: c.end_block_index ?? 0,
    }))

  allCitations.push(
    ...webSearchCitations,
    ...searchResultCitations,
    ...charLocationCitations,
    ...pageLocationCitations,
    ...contentBlockLocationCitations,
  )

  return allCitations
}

// ============================================================================
// Web Fetch Result Processing
// ============================================================================

/**
 * Processes web fetch tool results and sends appropriate SSE events
 */
export async function processWebFetchResult(
  content: WebFetchResultContent,
  sseHandler: SSEHandler,
): Promise<void> {
  if (content?.type === 'web_fetch_result') {
    await sseHandler.sendSSE({
      choices: [{
        delta: {
          tool_use: {
            name: 'web_fetch',
            status: 'end',
            result: `Fetched content from: ${content.url}`,
            webFetch: {
              type: 'web_fetch',
              url: content.url || '',
              title: content.content?.title,
              retrievedAt: content.retrieved_at,
            },
          },
        },
      }],
    })
  }

  if (content?.type === 'web_fetch_tool_error') {
    await sseHandler.sendSSE({
      choices: [{
        delta: {
          tool_use: {
            name: 'web_fetch',
            status: 'end',
            result: `Web fetch error: ${content.error_code || 'unknown'}`,
          },
        },
      }],
    })
  }
}

// ============================================================================
// Web Search Result Processing
// ============================================================================

/**
 * Processes web search tool results and sends appropriate SSE events
 */
export async function processWebSearchResult(
  content: WebSearchResultContent[],
  activeToolInput: Record<string, unknown> | null,
  sseHandler: SSEHandler,
): Promise<void> {
  const errorContent = content.find(c => c.type === 'web_search_tool_result_error')
  
  if (errorContent) {
    await sseHandler.sendSSE({
      choices: [{
        delta: {
          tool_use: {
            name: 'web_search',
            status: 'end',
            result: `Web search error: ${errorContent.error_code || 'unknown'}`,
            webSearch: {
              type: 'web_search',
              query: (activeToolInput?.query as string) || '',
              results: [],
              errorCode: errorContent.error_code as WebSearchErrorCode,
            },
          },
        },
      }],
    })
  } else {
    const searchResults = content
      .filter(c => c.type === 'web_search_result')
      .map(c => ({
        url: c.url || '',
        title: c.title || '',
        pageAge: c.page_age,
      }))

    await sseHandler.sendSSE({
      choices: [{
        delta: {
          tool_use: {
            name: 'web_search',
            status: 'end',
            result: `Found ${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`,
            webSearch: {
              type: 'web_search',
              query: (activeToolInput?.query as string) || '',
              results: searchResults,
            },
          },
        },
      }],
    })
  }
}

