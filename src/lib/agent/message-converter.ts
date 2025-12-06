/**
 * Message Converter
 *
 * Converts chat messages to OpenAI API format (for xAI/Grok).
 * Handles text and images.
 */

import type { MessageContentSegment } from '@/lib/types'

/**
 * Converts message content to OpenAI API format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertToOpenAIContent(
  content: string | MessageContentSegment[],
): any {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const result: any[] = []

    for (const segment of content) {
      if (segment.type === 'text') {
        const text = (segment as { text?: string }).text
        if (typeof text === 'string' && text.trim().length > 0) {
          result.push({ type: 'text', text: text })
        }
      } else if (segment.type === 'image_url') {
        const url = segment.image_url.url
        result.push({
          type: 'image_url',
          image_url: {
            url: url,
          },
        })
      } else if (segment.type === 'url_image') {
        result.push({
          type: 'image_url',
          image_url: {
            url: segment.url_image.url,
          },
        })
      }
      // Note: PDF/Document support removed as it was specific to Anthropic
      // Text files might still be supported if converted to text segments upstream
    }

    return result.length > 0 ? result : ''
  }

  return ''
}
