/**
 * Message Converter
 *
 * Converts chat messages to OpenAI Responses API format.
 * Handles text, images, and PDF files following OpenAI best practices.
 *
 * @see https://platform.openai.com/docs/guides/pdf-files
 *
 * OpenAI Responses API Content Types:
 * - input_text: Text content
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
  | OpenAIInputImage
  | OpenAIInputFile
  | OpenAIInputFileUrl

/**
 * Converts message content to OpenAI Responses API format
 *
 * Follows OpenAI best practices:
 * - Uses input_text for text content
 * - Uses input_image for image content
 * - Uses input_file for PDF files with base64 data or URLs
 * - Places files before text in the content array
 *
 * @param content - String or array of message content segments
 * @returns OpenAI-compatible content array or string
 */
export function convertToOpenAIContent(
  content: string | MessageContentSegment[],
): string | OpenAIContentPart[] {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const result: OpenAIContentPart[] = []

    for (const segment of content) {
      if (segment.type === 'text') {
        const text = (segment as { text?: string }).text
        if (typeof text === 'string' && text.trim().length > 0) {
          result.push({
            type: 'input_text',
            text: text,
          })
        }
      } else if (segment.type === 'image_url') {
        // Base64 or URL-based image with optional detail level
        const imageInput: OpenAIInputImage = {
          type: 'input_image',
          image_url: segment.image_url.url,
        }
        // Include detail parameter if specified
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
        // Include detail parameter if specified
        if (segment.url_image.detail) {
          imageInput.detail = segment.url_image.detail
        }
        result.push(imageInput)
      } else if (segment.type === 'file') {
        // PDF or document file with base64 data
        // Format: data:application/pdf;base64,{base64string}
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
    }

    return result.length > 0 ? result : ''
  }

  return ''
}
