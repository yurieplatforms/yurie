/**
 * Message Converter
 *
 * Converts chat messages to OpenAI Responses API format.
 * Handles text, images, and PDF files following OpenAI best practices.
 *
 * @see https://platform.openai.com/docs/guides/pdf-files
 *
 * OpenAI Responses API Content Types:
 * - input_text: Text content (for user messages)
 * - output_text: Text content (for assistant messages)
 * - input_image: Image content (base64 or URL)
 * - input_file: PDF/document content (base64 with filename, file_id, or file_url)
 */

import type { MessageContentSegment } from '@/lib/types'

/**
 * OpenAI Responses API content part types
 */
type OpenAIInputText = {
  type: 'input_text'
  text: string
}

type OpenAIOutputText = {
  type: 'output_text'
  text: string
}

/**
 * OpenAI input_image format
 * @see https://platform.openai.com/docs/guides/images-vision
 */
type OpenAIInputImage = {
  type: 'input_image'
  /** URL or base64 data URL */
  image_url: string
  /**
   * Detail level for image processing
   * - "low": 85 tokens, 512x512px (faster, cheaper)
   * - "high": Full resolution (better understanding)
   * - "auto": Model decides (default)
   */
  detail?: 'low' | 'high' | 'auto'
}

type OpenAIInputFile = {
  type: 'input_file'
  filename: string
  file_data: string
}

type OpenAIInputFileUrl = {
  type: 'input_file'
  file_url: string
}

type OpenAIContentPart =
  | OpenAIInputText
  | OpenAIOutputText
  | OpenAIInputImage
  | OpenAIInputFile
  | OpenAIInputFileUrl

/**
 * Sanitize message content by removing large base64 image data.
 * This prevents API errors when sending chat history back to the server.
 * 
 * Replaces markdown images with base64 data:
 * ![Alt](data:image/png;base64,...) -> ![Alt]([Image Data Omitted])
 */
export function sanitizeMessageContent(content: string | MessageContentSegment[]): string | MessageContentSegment[] {
  if (typeof content === 'string') {
    // Replace base64 data in markdown images
    return content.replace(
      /!\[(.*?)\]\(data:image\/[a-zA-Z]+;base64,[^)]+\)/g,
      '![Image: $1]([Image Data Omitted])'
    )
  }

  if (Array.isArray(content)) {
    return content.map(segment => {
      if (segment.type === 'text' && typeof segment.text === 'string') {
        return {
          ...segment,
          text: segment.text.replace(
            /!\[(.*?)\]\(data:image\/[a-zA-Z]+;base64,[^)]+\)/g,
            '![Image: $1]([Image Data Omitted])'
          )
        }
      }
      return segment
    })
  }

  return content
}

/**
 * Converts message content to OpenAI Responses API format
 *
 * Follows OpenAI best practices:
 * - Uses input_text for user text content
 * - Uses output_text for assistant text content
 * - Uses input_image for image content
 * - Uses input_file for PDF files with base64 data or URLs
 *
 * @param content - String or array of message content segments
 * @param role - The role of the message sender ('user' or 'assistant')
 * @returns OpenAI-compatible content array or string
 */
export function convertToOpenAIContent(
  content: string | MessageContentSegment[],
  role: 'user' | 'assistant' = 'user',
): string | OpenAIContentPart[] {
  // For simple string content, return as-is (OpenAI accepts plain strings)
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const result: OpenAIContentPart[] = []
    const textType = role === 'assistant' ? 'output_text' : 'input_text'

    for (const segment of content) {
      // Handle text segments (type: 'text' from our internal format)
      if (segment.type === 'text') {
        const text = (segment as { text?: string }).text
        if (typeof text === 'string' && text.trim().length > 0) {
          result.push({
            type: textType,
            text: text,
          } as OpenAIInputText | OpenAIOutputText)
        }
      } else if (segment.type === 'image_url') {
        // Base64 or URL-based image with optional detail level
        const imageInput: OpenAIInputImage = {
          type: 'input_image',
          image_url: segment.image_url.url,
        }
        if (segment.image_url.detail) {
          imageInput.detail = segment.image_url.detail
        }
        result.push(imageInput)
      } else if (segment.type === 'url_image') {
        // URL-based image with optional detail level
        const imageInput: OpenAIInputImage = {
          type: 'input_image',
          image_url: segment.url_image.url,
        }
        if (segment.url_image.detail) {
          imageInput.detail = segment.url_image.detail
        }
        result.push(imageInput)
      } else if (segment.type === 'file') {
        // PDF or document file with base64 data
        result.push({
          type: 'input_file',
          filename: segment.file.filename,
          file_data: segment.file.file_data,
        })
      } else if (segment.type === 'url_document') {
        // URL-based document (PDF)
        result.push({
          type: 'input_file',
          file_url: segment.url_document.url,
        })
      }
      // Silently skip any unrecognized segment types
    }

    return result.length > 0 ? result : ''
  }

  return ''
}
