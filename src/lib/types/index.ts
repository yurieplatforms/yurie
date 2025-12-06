export type Role = 'system' | 'user' | 'assistant' | 'data'

export type TextContentSegment = {
  type: 'text'
  text: string
}

/**
 * Image content segment supporting both base64 data URLs and remote URLs.
 * 
 * For base64 images, the url should be in format: `data:{media_type};base64,{data}`
 * For URL-based images, use a standard http/https URL.
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

export type ChatMessage = {
  id: string
  role: Role
  content: string
  richContent?: MessageContentSegment[]
  reasoning?: string
  thinkingDurationSeconds?: number
  suggestions?: string[]
  name?: string
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
