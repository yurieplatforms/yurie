/**
 * Suggestion Parser
 *
 * Parses follow-up suggestions from assistant responses.
 * Supports both XML-style <suggestions> tags (new) and "SUGGESTIONS:" blocks (legacy).
 */

export type ParsedContent = {
  content: string
  suggestions?: string[]
}

/**
 * Parses content to extract suggestions.
 *
 * @param rawContent - The raw content string from the assistant
 * @returns Parsed content (minus the suggestions block) and optional suggestions array
 */
export function parseSuggestions(rawContent: string): ParsedContent {
  // 1. Try XML format: <suggestions> ... </suggestions>
  // Matches <suggestions> content </suggestions> with any whitespace including newlines
  const xmlMatch = rawContent.match(/<suggestions>([\s\S]*?)<\/suggestions>/i)

  if (xmlMatch) {
    const suggestionBlock = xmlMatch[1]
    const suggestions = parseBulletedList(suggestionBlock)

    // Remove the entire XML block from the content
    const content = rawContent.replace(/<suggestions>[\s\S]*?<\/suggestions>/i, '').trim()

    return {
      content,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    }
  }

  // 2. Try Legacy format: SUGGESTIONS: ... (rest of text)
  if (rawContent.includes('SUGGESTIONS:')) {
    const parts = rawContent.split('SUGGESTIONS:')
    const content = parts[0].trim()
    const suggestionBlock = parts[1]
    const suggestions = parseBulletedList(suggestionBlock)

    return {
      content,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    }
  }

  // No suggestions found
  return { content: rawContent }
}

/**
 * Helper to parse bulleted lists from a text block.
 * Handles lines starting with -, *, or just text lines if clearly separated.
 */
function parseBulletedList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      // Keep lines that start with - or * or are non-empty
      return line.length > 0
    })
    .map((line) => {
      // Remove leading bullet markers
      return line.replace(/^[-*•]\s*/, '').trim()
    })
    .filter((line) => line.length > 0) // Filter out empty lines after trimming
}
