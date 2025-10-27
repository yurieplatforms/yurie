/**
 * Chat utility functions for message processing and formatting
 */

import type { MessagePart } from '@/app/types/chat'

/**
 * Format thinking/reasoning text for markdown rendering
 */
export function formatThinkingForMarkdown(input: string): string {
  if (!input) return input
  const normalized = input.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const result: string[] = []
  let inFence = false
  let prevWasEmpty = false

  const boldenLabels = (line: string): string =>
    line.replace(/(^|\n)([A-Z][A-Za-z\- ]{2,40}):\s/g, (_m, p1, p2) => `${p1}**${p2}:** `)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Handle code fences
    if (/^```/.test(trimmed)) {
      inFence = !inFence
      result.push(line)
      prevWasEmpty = false
      continue
    }

    // Inside code blocks, preserve everything
    if (inFence) {
      result.push(line)
      prevWasEmpty = false
      continue
    }

    // Skip empty lines but track them
    if (trimmed.length === 0) {
      if (!prevWasEmpty) {
        result.push('')
        prevWasEmpty = true
      }
      continue
    }

    // Apply bold labels
    const processed = boldenLabels(line)
    result.push(processed)
    prevWasEmpty = false
  }

  // Clean up multiple consecutive empty lines
  const cleaned: string[] = []
  let emptyCount = 0
  for (const line of result) {
    if (line.trim() === '') {
      emptyCount++
      if (emptyCount === 1) cleaned.push('')
    } else {
      emptyCount = 0
      cleaned.push(line)
    }
  }

  return cleaned.join('\n').trim()
}

/**
 * Parse message content and extract structured parts (text, images, citations, etc.)
 */
export function parseMessageContent(content: string): MessagePart[] {
  const legacyBracketPattern = "\\[" + "data:image" + "\\/[a-zA-Z]+;base64,[^\\]]+" + "\\]"
  const pattern = new RegExp(
    `<image_partial:([^>]+)>|<image:([^>]+)>|<revised_prompt:([^>]+)>|<response_id:([^>]+)>|<summary_text:([^>]+)>|<incomplete:([^>]+)>|<citation:([^>]+)>|${legacyBracketPattern}`,
    'g'
  )
  const parts: MessagePart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    const full = match[0]
    const partialPayload = match[1]
    const finalPayload = match[2]
    const revisedPayload = match[3]
    const summaryPayload = match[5]
    const incompletePayload = match[6]
    const citationPayload = match[7]
    
    const src = partialPayload
      ? partialPayload
      : finalPayload
        ? finalPayload
        : full.startsWith('[')
          ? full.slice(1, -1)
          : ''
    
    if (src) {
      const isPartial = Boolean(partialPayload)
      parts.push({ type: 'image', src, partial: isPartial })
    }
    if (typeof revisedPayload === 'string' && revisedPayload) {
      parts.push({ type: 'meta', key: 'revised_prompt', value: revisedPayload })
    }
    if (typeof summaryPayload === 'string' && summaryPayload) {
      parts.push({ type: 'meta', key: 'summary_text', value: summaryPayload })
    }
    if (typeof incompletePayload === 'string' && incompletePayload) {
      parts.push({ type: 'meta', key: 'incomplete', value: incompletePayload })
    }
    if (citationPayload) {
      try {
        const citation = JSON.parse(citationPayload)
        if (citation.url) {
          parts.push({ 
            type: 'citation', 
            url: citation.url, 
            title: citation.title || '',
            content: citation.content || ''
          })
        }
      } catch {}
    }
    lastIndex = match.index + full.length
  }
  
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts
}

/**
 * Check if message content has any visible content (not just metadata)
 */
export function hasVisibleAssistantContent(content: string): boolean {
  if (!content) return false
  // Images or citations count as visible content
  if (/<image_partial:[^>]+>/.test(content) || /<image:[^>]+>/.test(content)) return true
  if (/<citation:[^>]+>/.test(content)) return true
  // Strip out meta/control tags that don't render main message text
  const stripped = content
    .replace(/<response_id:[^>]+>/g, '')
    .replace(/<summary_text:[^>]+>/g, '')
    .replace(/<incomplete:[^>]+>/g, '')
    .replace(/<thinking:[^>]+>/g, '')
    .trim()
  return stripped.length > 0
}

/**
 * Determine whether to enable web search based on query
 */
export function shouldEnableSearch(query: string): boolean {
  const q = (query || '').toLowerCase()
  // Explicit user controls
  if (/^(?:\s*\/no\-?search|\s*offline:)/.test(q)) return false
  if (/^(?:\s*\/search|\s*\/web|\s*online:)/.test(q)) return true
  // Default to enabling web search automatically
  return true
}

/**
 * Remove search control prefixes from query
 */
export function stripSearchControls(query: string): string {
  const q = query || ''
  return q
    .replace(/^\s*\/no\-?search\s*/i, '')
    .replace(/^\s*offline:\s*/i, '')
    .replace(/^\s*\/search\s*/i, '')
    .replace(/^\s*\/web\s*/i, '')
    .replace(/^\s*online:\s*/i, '')
}

/**
 * Strip image and PDF data from text for API submission
 */
export function stripImageData(text: string): string {
  const angleTag = /<image:[^>]+>/gi
  const bracketDataUrl = /\[data:image\/[a-zA-Z0-9+.-]+;base64,[^\]]+\]/gi
  const bareDataUrl = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi
  const bracketPdfDataUrl = /\[data:application\/pdf;base64,[^\]]+\]/gi
  const barePdfDataUrl = /data:application\/pdf;base64,[A-Za-z0-9+/=]+/gi
  return text
    .replace(angleTag, '[image omitted]')
    .replace(bracketDataUrl, '[image omitted]')
    .replace(bareDataUrl, '[image omitted]')
    .replace(bracketPdfDataUrl, '[pdf omitted]')
    .replace(barePdfDataUrl, '[pdf omitted]')
}

/**
 * Extract image and PDF URLs from message text
 */
export function extractUrls(text: string): { images: string[]; pdfs: string[] } {
  if (!text) return { images: [], pdfs: [] }
  // Match http/https URLs, excluding obvious trailing punctuation and brackets
  const urlRe = /https?:\/\/[^\s<>\]\)"}]+/gi
  const imageExts = ['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.heic','.heif','.tif','.tiff','.avif']
  const images: string[] = []
  const pdfs: string[] = []
  const matches = text.match(urlRe) || []
  for (let raw of matches) {
    // Trim common trailing punctuation that can stick to URLs in prose
    while (/[.,;!?)]$/.test(raw)) raw = raw.slice(0, -1)
    const lower = raw.toLowerCase()
    if (lower.endsWith('.pdf')) {
      pdfs.push(raw)
      continue
    }
    const hasImageExt = imageExts.some((e) => lower.endsWith(e))
    // Heuristic: some CDNs encode format in query (e.g., ?format=jpg)
    const qpExtMatch = /[?&](?:format|ext)=([a-z0-9]+)\b/.exec(lower)
    const qpIsImage = qpExtMatch ? imageExts.includes('.' + qpExtMatch[1]) : false
    if (hasImageExt || qpIsImage) images.push(raw)
  }
  return { images, pdfs }
}

