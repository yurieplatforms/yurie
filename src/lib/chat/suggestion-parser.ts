/**
 * Suggestion Parser
 *
 * Parses follow-up suggestions from assistant responses.
 * Supports multiple formats for maximum compatibility:
 * 
 * 1. JSON structured output (recommended)
 * 2. XML-style <suggestions> tags
 * 3. Legacy "SUGGESTIONS:" blocks
 *
 * The parser tries each format in order of preference, falling back
 * gracefully to ensure suggestions are always extracted when present.
 */

// =============================================================================
// Types
// =============================================================================

export type ParsedContent = {
  /** Response content with suggestions block removed */
  content: string
  /** Extracted suggestions, if any */
  suggestions?: string[]
  /** Format the suggestions were found in */
  format?: 'json' | 'xml' | 'legacy' | 'none'
}

export type SuggestionObject = {
  text: string
}

// =============================================================================
// JSON Format Parsing
// =============================================================================

/**
 * Try to parse suggestions from JSON structured output
 */
function parseJsonSuggestions(rawContent: string): ParsedContent | null {
  // Check if the entire response is JSON
  const trimmed = rawContent.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.content && Array.isArray(parsed.suggestions)) {
        const suggestions = parsed.suggestions.map((s: string | SuggestionObject) =>
          typeof s === 'string' ? s : s.text
        ).filter((s: string) => s && s.length > 0)
        
        return {
          content: parsed.content,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          format: 'json',
        }
      }
    } catch {
      // Not valid JSON, continue to other formats
    }
  }

  // Check for embedded JSON code block
  const embeddedJsonMatch = rawContent.match(/```json\s*(\{[\s\S]*?\})\s*```/)
  if (embeddedJsonMatch) {
    try {
      const parsed = JSON.parse(embeddedJsonMatch[1])
      if (Array.isArray(parsed.suggestions)) {
        const suggestions = parsed.suggestions.map((s: string | SuggestionObject) =>
          typeof s === 'string' ? s : s.text
        ).filter((s: string) => s && s.length > 0)
        
        // Remove the JSON block from content
        const content = rawContent.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '').trim()
        
        return {
          content: content || parsed.content || rawContent,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          format: 'json',
        }
      }
    } catch {
      // Not valid embedded JSON
    }
  }

  return null
}

// =============================================================================
// XML Format Parsing
// =============================================================================

/**
 * Parse suggestions from XML-style <suggestions> tags
 */
function parseXmlSuggestions(rawContent: string): ParsedContent | null {
  const xmlMatch = rawContent.match(/<suggestions>([\s\S]*?)<\/suggestions>/i)
  
  if (!xmlMatch) {
    return null
  }

  const suggestionBlock = xmlMatch[1]
  const suggestions = parseBulletedList(suggestionBlock, true)

  // Remove the entire XML block from the content
  const content = rawContent.replace(/<suggestions>[\s\S]*?<\/suggestions>/i, '').trim()

  return {
    content,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    format: 'xml',
  }
}

// =============================================================================
// Legacy Format Parsing
// =============================================================================

/**
 * Parse suggestions from legacy "SUGGESTIONS:" format
 */
function parseLegacySuggestions(rawContent: string): ParsedContent | null {
  // Supports SUGGESTIONS:, suggestions:, Suggestions:, **Suggestions:**, ## Suggestions
  const legacyMatch = rawContent.match(
    /(?:^|\n)(?:#{1,6}\s*)?(?:\*\*)?suggestions:?(?:\*\*)?\s*([\s\S]*)$/i
  )

  if (!legacyMatch) {
    return null
  }

  const suggestionBlock = legacyMatch[1]
  // For unstructured legacy text, be strict about bullets to avoid capturing conversational text
  const suggestions = parseBulletedList(suggestionBlock, false)

  if (suggestions.length === 0) {
    return null
  }

  const content = rawContent.substring(0, legacyMatch.index).trim()

  return {
    content,
    suggestions,
    format: 'legacy',
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to parse bulleted lists from a text block.
 * Handles lines starting with -, *, •, numbers (1.), or [n].
 *
 * @param text - The text block to parse
 * @param lenient - If true, accepts any non-empty line as a list item. If false, requires bullet/number.
 */
function parseBulletedList(text: string, lenient: boolean = false): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0) return false
      if (line.startsWith('```')) return false // Ignore code fences
      if (lenient) return true

      // In strict mode, line must start with bullet or number
      return /^(?:[-*•]|\d+\.|\[\d+\])/.test(line)
    })
    .map((line) => {
      // Remove leading bullet markers, numbers, or [n]
      return line.replace(/^(?:[-*•]|\d+\.?|\[\d+\])\s*/, '').trim()
    })
    .filter((line) => line.length > 0)
}

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parses content to extract suggestions.
 * Tries multiple formats in order of preference:
 * 1. JSON structured output
 * 2. XML tags
 * 3. Legacy SUGGESTIONS: format
 *
 * @param rawContent - The raw content string from the assistant
 * @returns Parsed content (minus the suggestions block) and optional suggestions array
 */
export function parseSuggestions(rawContent: string): ParsedContent {
  if (!rawContent || rawContent.trim().length === 0) {
    return { content: rawContent, format: 'none' }
  }

  // Try JSON format first (most reliable)
  const jsonResult = parseJsonSuggestions(rawContent)
  if (jsonResult) {
    return jsonResult
  }

  // Try XML format
  const xmlResult = parseXmlSuggestions(rawContent)
  if (xmlResult) {
    return xmlResult
  }

  // Try legacy format
  const legacyResult = parseLegacySuggestions(rawContent)
  if (legacyResult) {
    return legacyResult
  }

  // No suggestions found
  return { content: rawContent, format: 'none' }
}

/**
 * Extract only the suggestions from content (convenience function)
 *
 * @param rawContent - The raw content string
 * @returns Array of suggestions or undefined
 */
export function extractSuggestionsOnly(rawContent: string): string[] | undefined {
  return parseSuggestions(rawContent).suggestions
}

/**
 * Remove all suggestion blocks from content (convenience function)
 *
 * @param rawContent - The raw content string
 * @returns Content with all suggestion blocks removed
 */
export function removeAllSuggestionBlocks(rawContent: string): string {
  let content = rawContent

  // Remove JSON suggestions if entire content is JSON
  try {
    const trimmed = content.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed)
      if (parsed.content) {
        return parsed.content
      }
    }
  } catch {
    // Not JSON, continue
  }

  // Remove embedded JSON blocks
  content = content.replace(/```json\s*\{[\s\S]*?"suggestions"[\s\S]*?\}\s*```/gi, '')

  // Remove XML blocks
  content = content.replace(/<suggestions>[\s\S]*?<\/suggestions>/gi, '')

  // Remove legacy blocks
  content = content.replace(/(?:^|\n)(?:#{1,6}\s*)?(?:\*\*)?suggestions:?(?:\*\*)?\s*[\s\S]*$/i, '')

  return content.trim()
}

/**
 * Validate that suggestions look reasonable
 *
 * @param suggestions - Array of suggestion strings
 * @returns True if suggestions appear valid
 */
export function validateSuggestions(suggestions: string[]): boolean {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return false
  }

  return suggestions.every((s) => {
    if (typeof s !== 'string') return false
    if (s.length === 0 || s.length > 200) return false // Reasonable length
    if (s.includes('<') || s.includes('>')) return false // No HTML/XML
    return true
  })
}
