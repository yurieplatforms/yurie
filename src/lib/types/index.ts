import type { UIMessage } from 'ai'

export type Role = UIMessage['role']

export type TextContentSegment = {
  type: 'text'
  text: string
}

/**
 * Image content segment supporting both base64 data URLs and remote URLs.
 * 
 * For base64 images, the url should be in format: `data:{media_type};base64,{data}`
 * For URL-based images, use a standard http/https URL.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/vision
 */
export type ImageContentSegment = {
  type: 'image_url'
  image_url: {
    url: string
  }
}

/**
 * URL-based image content segment for remote images.
 * This is the simplest approach for publicly accessible images.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/vision#url-based-image-example
 */
export type UrlImageContentSegment = {
  type: 'url_image'
  url_image: {
    url: string
    /** Optional alt text for the image */
    alt?: string
  }
}

export type FileContentSegment = {
  type: 'file'
  file: {
    filename: string
    file_data: string
  }
}

/**
 * URL-based document content segment
 * Used for PDFs and other documents hosted at remote URLs
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support#option-1-url-based-pdf-document
 */
export type UrlDocumentContentSegment = {
  type: 'url_document'
  url_document: {
    url: string
    title?: string
  }
}

export type MessageContentSegment =
  | TextContentSegment
  | ImageContentSegment
  | UrlImageContentSegment
  | FileContentSegment
  | UrlDocumentContentSegment

// Web fetch result type
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
export type WebFetchResult = {
  type: 'web_fetch'
  url: string
  title?: string
  retrievedAt?: string
}

// ============================================================================
// Web Search Types
// @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
// ============================================================================

/**
 * Individual search result item from web search.
 *
 * Each result includes the source URL, title, and optional page age
 * indicating when the content was last updated.
 */
export type WebSearchResultItem = {
  /** URL of the source page */
  url: string
  /** Title of the source page */
  title: string
  /** When the site was last updated (e.g., 'April 30, 2025') */
  pageAge?: string
}

/**
 * Citation from a web search result.
 *
 * Citations are automatically included by Claude when using information
 * from web search results. They link specific text to its source.
 *
 * **Important**: When displaying API outputs directly to end users,
 * citations must be included to credit the original source.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#citations
 */
export type WebSearchCitation = {
  /** Always 'web_search_result_location' for web search citations */
  type: 'web_search_result_location'
  /** URL of the cited source */
  url: string
  /** Title of the cited source */
  title: string
  /** Up to 150 characters of the cited content */
  citedText: string
}

/**
 * Web search error codes.
 *
 * When the web search tool encounters an error, the API still returns
 * a 200 (success) response with the error represented in the response body.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#errors
 */
export type WebSearchErrorCode =
  | 'too_many_requests'   // Rate limit exceeded
  | 'invalid_input'       // Invalid search query parameter
  | 'max_uses_exceeded'   // Maximum web search tool uses exceeded
  | 'query_too_long'      // Query exceeds maximum length
  | 'unavailable'         // An internal error occurred

/**
 * Web search result containing the query and all results.
 *
 * This represents the complete response from a web search operation,
 * including any errors that may have occurred.
 */
export type WebSearchResult = {
  /** Always 'web_search' for web search results */
  type: 'web_search'
  /** The search query that was executed */
  query: string
  /** Array of search result items */
  results: WebSearchResultItem[]
  /** Error code if the search failed */
  errorCode?: WebSearchErrorCode
}

/**
 * User location for localized web search results.
 *
 * When provided to the web search tool, search results will be localized
 * based on the user's approximate location. All fields except `type` are optional.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
 *
 * @example
 * ```ts
 * const userLocation: WebSearchUserLocation = {
 *   type: 'approximate',
 *   city: 'San Francisco',
 *   region: 'California',
 *   country: 'US',
 *   timezone: 'America/Los_Angeles',
 * }
 * ```
 */
export type WebSearchUserLocation = {
  /** Must be 'approximate' - indicates location is approximate, not exact */
  type: 'approximate'
  /** City name (e.g., 'San Francisco', 'New York') */
  city?: string
  /** Region or state (e.g., 'California', 'New York') */
  region?: string
  /** Country code (e.g., 'US', 'GB', 'JP') */
  country?: string
  /**
   * IANA timezone identifier
   * @see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
   */
  timezone?: string
}

// Search result content block types
// See: https://platform.claude.com/docs/en/build-with-claude/search-results
export type SearchResultTextBlock = {
  type: 'text'
  text: string
}

export type SearchResultBlock = {
  type: 'search_result'
  source: string  // Source URL or identifier
  title: string   // Descriptive title for the search result
  content: SearchResultTextBlock[]  // Array of text blocks
  citations?: {
    enabled: boolean
  }
  cache_control?: {
    type: 'ephemeral'
  }
}

// Citation from search results (distinct from web search citations)
// See: https://platform.claude.com/docs/en/build-with-claude/search-results#citation-fields
export type SearchResultCitation = {
  type: 'search_result_location'
  source: string           // Source from the original search result
  title: string | null     // Title from the original search result
  citedText: string        // The exact text being cited
  searchResultIndex: number // Index of the search result (0-based)
  startBlockIndex: number  // Starting position in the content array
  endBlockIndex: number    // Ending position in the content array
}

// Document-based citation types
// See: https://platform.claude.com/docs/en/build-with-claude/citations

// Citation from plain text documents (character indices, 0-indexed)
export type CharLocationCitation = {
  type: 'char_location'
  citedText: string        // The exact text being cited (not counted towards output tokens)
  documentIndex: number    // 0-indexed document index from the request
  documentTitle: string | null // Title from the original document
  startCharIndex: number   // 0-indexed starting character position
  endCharIndex: number     // 0-indexed ending character position (exclusive)
}

// Citation from PDF documents (page numbers, 1-indexed)
export type PageLocationCitation = {
  type: 'page_location'
  citedText: string        // The exact text being cited (not counted towards output tokens)
  documentIndex: number    // 0-indexed document index from the request
  documentTitle: string | null // Title from the original document
  startPageNumber: number  // 1-indexed starting page number
  endPageNumber: number    // 1-indexed ending page number (exclusive)
}

// Citation from custom content documents (block indices, 0-indexed)
export type ContentBlockLocationCitation = {
  type: 'content_block_location'
  citedText: string        // The exact text being cited (not counted towards output tokens)
  documentIndex: number    // 0-indexed document index from the request
  documentTitle: string | null // Title from the original document
  startBlockIndex: number  // 0-indexed starting block position
  endBlockIndex: number    // 0-indexed ending block position (exclusive)
}

// Union of all document citation types
export type DocumentCitation = CharLocationCitation | PageLocationCitation | ContentBlockLocationCitation

export type ToolUseEvent = {
  name: string
  status: 'start' | 'end'
  input?: Record<string, unknown>
  result?: string
  // Web fetch specific fields
  webFetch?: WebFetchResult
  // Web search specific fields
  // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
  webSearch?: WebSearchResult
}

// Citations from search results and documents embedded in text responses
// Supports web search, search result, and document-based citations
// See: https://platform.claude.com/docs/en/build-with-claude/citations
// See: https://platform.claude.com/docs/en/build-with-claude/search-results
export type MessageCitation = WebSearchCitation | SearchResultCitation | DocumentCitation

export type ChatMessage = {
  id: string
  role: Role
  content: string
  richContent?: MessageContentSegment[]
  reasoning?: string
  thinkingDurationSeconds?: number
  suggestions?: string[]
  name?: string
  toolUses?: ToolUseEvent[]
  // Citations from web search, search results, and documents
  // See: https://platform.claude.com/docs/en/build-with-claude/citations
  // See: https://platform.claude.com/docs/en/build-with-claude/search-results
  citations?: MessageCitation[]
}

export type SavedChat = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  // Container ID for code execution persistence across messages
  containerId?: string
}

