/**
 * Suggestion Parser
 * 
 * Parses follow-up suggestions from assistant responses.
 */

export type ParsedContent = {
  content: string
  suggestions?: string[]
}

/**
 * Parses content to extract suggestions from the SUGGESTIONS: block
 * 
 * @param rawContent - The raw content string from the assistant
 * @returns Parsed content and optional suggestions array
 */
export function parseSuggestions(rawContent: string): ParsedContent {
  if (!rawContent.includes('SUGGESTIONS:')) {
    return { content: rawContent }
  }

  const parts = rawContent.split('SUGGESTIONS:')
  const content = parts[0].trim()
  const suggestions = parts[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.slice(1).trim())

  return {
    content,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  }
}

