/**
 * Message Converter
 * 
 * Converts chat messages to Anthropic API format.
 * Handles images, documents, and text with proper ordering and labeling.
 * 
 * Best practices from https://platform.claude.com/docs/en/build-with-claude/vision:
 * - Images should come before text (image-then-text structure)
 * - Multiple images should be labeled "Image 1:", "Image 2:", etc.
 * - Multiple documents should be labeled "Document 1:", "Document 2:", etc.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/citations
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { MessageContentSegment } from '@/lib/types'

/**
 * Converts message content to Anthropic API format
 * Handles text, images (base64 and URL), and documents (PDF and text)
 */
export function convertToAnthropicContent(
  content: string | MessageContentSegment[],
): Anthropic.MessageParam['content'] {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    // Separate content types for proper ordering and labeling
    const textSegments: Array<{ type: 'text'; text: string }> = []
    const imageSegments: Array<{
      type: 'image'
      source: { type: 'base64' | 'url'; media_type?: string; data?: string; url?: string }
    }> = []
    const documentSegments: Array<{
      type: 'document'
      source: { type: 'base64' | 'text'; media_type: string; data: string }
      title: string
      citations: { enabled: boolean }
    }> = []

    // Process each segment and categorize
    for (const segment of content) {
      if (segment.type === 'text') {
        if (segment.text.trim().length > 0) {
          textSegments.push({ type: 'text' as const, text: segment.text })
        }
      } else if (segment.type === 'image_url') {
        const url = segment.image_url.url
        if (url.startsWith('data:')) {
          const matches = url.match(/^data:([^;]+);base64,(.+)$/)
          if (matches) {
            imageSegments.push({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: matches[1] as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: matches[2],
              },
            })
          }
        } else {
          imageSegments.push({
            type: 'image' as const,
            source: {
              type: 'url' as const,
              url: url,
            },
          })
        }
      } else if (segment.type === 'file') {
        // Handle file attachments as document blocks with citations enabled
        const { filename, file_data } = segment.file
        const dataUrlMatch = file_data.match(/^data:([^;]+);base64,(.+)$/)
        
        if (dataUrlMatch) {
          const mediaType = dataUrlMatch[1]
          const base64Data = dataUrlMatch[2]
          
          // PDF documents - use base64 source with citations
          if (mediaType === 'application/pdf') {
            documentSegments.push({
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                media_type: 'application/pdf' as const,
                data: base64Data,
              },
              title: filename,
              citations: { enabled: true },
            })
          }
          
          // Plain text documents - decode and use text source with citations
          if (mediaType === 'text/plain' || mediaType.startsWith('text/')) {
            try {
              const textContent = Buffer.from(base64Data, 'base64').toString('utf-8')
              documentSegments.push({
                type: 'document' as const,
                source: {
                  type: 'text' as const,
                  media_type: 'text/plain' as const,
                  data: textContent,
                },
                title: filename,
                citations: { enabled: true },
              })
            } catch {
              // If decoding fails, skip this segment
            }
          }
        }
      }
    }

    // Build the final content array following best practices:
    // 1. Images first (with labels if multiple)
    // 2. Documents second (with labels if multiple)
    // 3. Text last
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = []
    const hasMultipleImages = imageSegments.length > 1
    const hasMultipleDocuments = documentSegments.length > 1

    // Add images with labels if multiple
    imageSegments.forEach((img, index) => {
      if (hasMultipleImages) {
        result.push({ type: 'text' as const, text: `Image ${index + 1}:` })
      }
      result.push(img)
    })

    // Add documents with labels if multiple
    documentSegments.forEach((doc, index) => {
      if (hasMultipleDocuments) {
        result.push({ type: 'text' as const, text: `Document ${index + 1}:` })
      }
      result.push(doc)
    })

    // Add text segments last
    result.push(...textSegments)

    return result.length > 0 ? result : ''
  }

  return ''
}

