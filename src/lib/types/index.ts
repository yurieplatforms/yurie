export type Role = 'system' | 'user' | 'assistant' | 'data'

/**
 * Text content segment
 * Converted to OpenAI's input_text format
 */
export type TextContentSegment = {
  type: 'text'
  text: string
}

/**
 * Image detail level for OpenAI Vision API
 * @see https://platform.openai.com/docs/guides/images-vision#specify-image-input-detail-level
 *
 * - "low": 85 tokens budget, 512x512px low-res version (faster, cheaper)
 * - "high": Full resolution analysis (better understanding, more tokens)
 * - "auto": Model decides based on image (default)
 */
export type ImageDetailLevel = 'low' | 'high' | 'auto'

/**
 * Image content segment supporting both base64 data URLs and remote URLs.
 * Converted to OpenAI's input_image format
 *
 * @see https://platform.openai.com/docs/guides/images-vision
 *
 * For base64 images, the url should be in format: `data:{media_type};base64,{data}`
 * For URL-based images, use a standard http/https URL.
 *
 * OpenAI input_image format:
 * - image_url: URL or base64 data URL
 * - detail: "low" | "high" | "auto" (optional)
 */
export type ImageContentSegment = {
  type: 'image_url'
  image_url: {
    url: string
    /** Detail level for image processing */
    detail?: ImageDetailLevel
  }
}

/**
 * URL-based image content segment for remote images.
 * Converted to OpenAI's input_image format
 */
export type UrlImageContentSegment = {
  type: 'url_image'
  url_image: {
    url: string
    /** Detail level for image processing */
    detail?: ImageDetailLevel
    /** Optional alt text for the image */
    alt?: string
  }
}

/**
 * File content segment for PDFs and documents with base64 data.
 * Converted to OpenAI's input_file format
 *
 * @see https://platform.openai.com/docs/guides/pdf-files
 *
 * OpenAI input_file format:
 * - filename: Name of the file
 * - file_data: Base64-encoded data in format `data:application/pdf;base64,{base64string}`
 *
 * Usage considerations:
 * - Max file size: 50MB per file
 * - Max total: 50MB across all files in a request
 * - Supported models: gpt-4o, gpt-4o-mini, o1, gpt-5, gpt-5.1
 */
export type FileContentSegment = {
  type: 'file'
  file: {
    filename: string
    /** Base64-encoded file data in format: data:{media_type};base64,{data} */
    file_data: string
  }
}

/**
 * URL-based document content segment for PDFs at remote URLs
 * Converted to OpenAI's input_file format with file_url
 *
 * @see https://platform.openai.com/docs/guides/pdf-files
 *
 * Use this for:
 * - Publicly accessible PDFs
 * - PDFs hosted on external services
 */
export type UrlDocumentContentSegment = {
  type: 'url_document'
  url_document: {
    /** Direct URL to the PDF file */
    url: string
    /** Optional title for reference */
    title?: string
  }
}

export type MessageContentSegment =
  | TextContentSegment
  | ImageContentSegment
  | UrlImageContentSegment
  | FileContentSegment
  | UrlDocumentContentSegment

/**
 * Tool use status for agent actions
 */
export type ToolUseStatus = {
  /** Tool name (e.g., 'web_search', 'code_interpreter') */
  tool: string
  /** Current status of the tool */
  status: 'in_progress' | 'searching' | 'completed' | 'failed'
  /** Optional details (e.g., search query) */
  details?: string
}

export type ChatMessage = {
  id: string
  role: Role
  content: string
  richContent?: MessageContentSegment[]
  reasoning?: string
  thinkingDurationSeconds?: number
  suggestions?: string[]
  name?: string
  /** Active tool use during streaming */
  activeToolUse?: ToolUseStatus | null
  /** History of completed tool uses */
  toolUseHistory?: ToolUseStatus[]
  /** Whether this message represents an error */
  isError?: boolean
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

/**
 * Citation types for AI-generated responses
 * These match OpenAI's citation format from the Responses API
 */

export type WebSearchCitation = {
  type: 'web_search_result_location'
  url: string
  title?: string
  citedText?: string
}

export type SearchResultLocationCitation = {
  type: 'search_result_location'
  source: string
  title?: string
  startBlockIndex: number
  endBlockIndex?: number
  citedText?: string
}

export type CharLocationCitation = {
  type: 'char_location'
  documentIndex: number
  documentTitle?: string
  startCharIndex: number
  endCharIndex: number
  citedText?: string
}

export type PageLocationCitation = {
  type: 'page_location'
  documentIndex: number
  documentTitle?: string
  startPageNumber: number
  endPageNumber: number
  citedText?: string
}

export type ContentBlockLocationCitation = {
  type: 'content_block_location'
  documentIndex: number
  documentTitle?: string
  startBlockIndex: number
  endBlockIndex: number
  citedText?: string
}

export type MessageCitation =
  | WebSearchCitation
  | SearchResultLocationCitation
  | CharLocationCitation
  | PageLocationCitation
  | ContentBlockLocationCitation
