import type { UIMessage } from 'ai'

export type Role = UIMessage['role']

export type TextContentSegment = {
  type: 'text'
  text: string
}

export type ImageContentSegment = {
  type: 'image_url'
  image_url: {
    url: string
  }
}

export type FileContentSegment = {
  type: 'file'
  file: {
    filename: string
    file_data: string
  }
}

export type MessageContentSegment =
  | TextContentSegment
  | ImageContentSegment
  | FileContentSegment

// Code execution specific types
export type CodeExecutionResultType = 'bash' | 'text_editor'

export type BashExecutionResult = {
  type: 'bash'
  command: string
  stdout?: string
  stderr?: string
  returnCode?: number
}

export type TextEditorExecutionResult = {
  type: 'text_editor'
  command: 'view' | 'create' | 'str_replace'
  path: string
  content?: string
  isFileUpdate?: boolean
}

export type CodeExecutionResult = BashExecutionResult | TextEditorExecutionResult

// Web fetch result type
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
export type WebFetchResult = {
  type: 'web_fetch'
  url: string
  title?: string
  retrievedAt?: string
}

// Web search result types
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
export type WebSearchResultItem = {
  url: string
  title: string
  pageAge?: string
}

export type WebSearchCitation = {
  type: 'web_search_result_location'
  url: string
  title: string
  citedText: string
}

export type WebSearchResult = {
  type: 'web_search'
  query: string
  results: WebSearchResultItem[]
  // Error info if the search failed
  errorCode?: 'too_many_requests' | 'invalid_input' | 'max_uses_exceeded' | 'query_too_long' | 'unavailable'
}

// Web search user location for localized results
export type WebSearchUserLocation = {
  type: 'approximate'
  city?: string
  region?: string
  country?: string
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
  source: string  // Source URL or identifier (e.g., "/memories/notes.txt")
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

// Programmatic tool calling types
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
export type DirectToolCaller = {
  type: 'direct'
}

export type ProgrammaticToolCaller = {
  type: 'code_execution_20250825'
  tool_id: string
}

export type ToolCaller = DirectToolCaller | ProgrammaticToolCaller

export type ToolUseEvent = {
  name: string
  status: 'start' | 'end'
  input?: Record<string, unknown>
  result?: string
  // Code execution specific fields
  codeExecution?: CodeExecutionResult
  // Web fetch specific fields
  webFetch?: WebFetchResult
  // Web search specific fields
  // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
  webSearch?: WebSearchResult
  // Programmatic tool calling - indicates how the tool was invoked
  // 'direct' = traditional tool use, 'code_execution_20250825' = called from code execution
  caller?: ToolCaller
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

