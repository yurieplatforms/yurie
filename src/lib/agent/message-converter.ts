/**
 * Message Converter
 * 
 * Converts chat messages to Anthropic API format.
 * Handles images, documents (including PDFs), and text with proper ordering and labeling.
 * 
 * Best practices for PDF support:
 * @see https://platform.claude.com/docs/en/build-with-claude/pdf-support
 * - Place PDFs before text in requests
 * - Enable citations for full visual PDF understanding
 * - Use cache_control for repeated PDF analysis (ephemeral caching)
 * - Maximum 32MB request size, 100 pages per PDF
 * 
 * Best practices for vision:
 * @see https://platform.claude.com/docs/en/build-with-claude/vision
 * - Images should come before text (image-then-text structure)
 * - Multiple images should be labeled "Image 1:", "Image 2:", etc.
 * - Multiple documents should be labeled "Document 1:", "Document 2:", etc.
 * 
 * @see https://platform.claude.com/docs/en/build-with-claude/citations
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { MessageContentSegment } from '@/lib/types'

/**
 * Extracts a filename from a URL for document titles
 * Falls back to 'Document' if extraction fails
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop()
    if (filename && filename.length > 0) {
      return decodeURIComponent(filename)
    }
  } catch {
    // Invalid URL, fall through to default
  }
  return 'Document'
}

/**
 * Converts message content to Anthropic API format
 * Handles text, images (base64 and URL), and documents (PDF and text)
 * 
 * IMPORTANT: This function strips any extra properties from content segments
 * to prevent "Extra inputs are not permitted" API errors. Only known fields
 * defined by the Anthropic API are included in the output.
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
      source: { type: 'base64' | 'text' | 'url'; media_type?: string; data?: string; url?: string }
      title: string
      citations: { enabled: boolean }
      cache_control?: { type: 'ephemeral' }
    }> = []

    // Process each segment and categorize
    // IMPORTANT: Explicitly extract ONLY known fields to avoid API errors like
    // "Extra inputs are not permitted" when messages from storage contain
    // extra properties (e.g., 'parsed', 'suggestions', etc.)
    for (const segment of content) {
      // Handle text segments - ONLY extract type and text fields
      if (segment.type === 'text') {
        const text = (segment as { text?: string }).text
        if (typeof text === 'string' && text.trim().length > 0) {
          textSegments.push({ type: 'text' as const, text: text })
        }
      } else if (segment.type === 'image_url') {
        // Handle image_url type (legacy format, supports both data URLs and regular URLs)
        const url = segment.image_url.url
        if (url.startsWith('data:')) {
          // Base64-encoded image
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
          // URL-based image
          // @see https://platform.claude.com/docs/en/build-with-claude/vision#url-based-image-example
          imageSegments.push({
            type: 'image' as const,
            source: {
              type: 'url' as const,
              url: url,
            },
          })
        }
      } else if (segment.type === 'url_image') {
        // Handle url_image type (explicit URL-based image format)
        // This is the preferred format for remote images
        // @see https://platform.claude.com/docs/en/build-with-claude/vision#url-based-image-example
        imageSegments.push({
          type: 'image' as const,
          source: {
            type: 'url' as const,
            url: segment.url_image.url,
          },
        })
      } else if (segment.type === 'file') {
        // Handle file attachments as document blocks with citations enabled
        const { filename, file_data } = segment.file
        
        // Extract media type and base64 data without using regex on large strings
        // Regex with .+ can cause stack overflow on large base64 PDFs
        const dataPrefix = 'data:'
        const base64Marker = ';base64,'
        
        if (file_data.startsWith(dataPrefix) && file_data.includes(base64Marker)) {
          const markerIndex = file_data.indexOf(base64Marker)
          const mediaType = file_data.slice(dataPrefix.length, markerIndex)
          const base64Data = file_data.slice(markerIndex + base64Marker.length)
          
          // PDF documents - use base64 source with citations and cache_control
          // Best practice: Enable prompt caching for repeated PDF analysis
          // @see https://platform.claude.com/docs/en/build-with-claude/pdf-support#use-prompt-caching
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
              // Enable ephemeral caching for repeated queries on the same PDF
              cache_control: { type: 'ephemeral' },
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
      } else if (segment.type === 'url_document') {
        // Handle URL-based documents (PDFs and other documents from remote URLs)
        // Best practice: URL-based PDFs are the simplest approach for hosted documents
        // @see https://platform.claude.com/docs/en/build-with-claude/pdf-support#option-1-url-based-pdf-document
        const { url, title } = segment.url_document
        documentSegments.push({
          type: 'document' as const,
          source: {
            type: 'url' as const,
            url: url,
          },
          title: title || extractFilenameFromUrl(url),
          citations: { enabled: true },
          cache_control: { type: 'ephemeral' },
        })
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

