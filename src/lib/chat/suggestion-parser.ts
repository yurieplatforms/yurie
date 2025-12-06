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
    // Inside explicit XML tags, we can be more lenient about what constitutes a suggestion line
    const suggestions = parseBulletedList(suggestionBlock, true)

    // Remove the entire XML block from the content
    const content = rawContent.replace(/<suggestions>[\s\S]*?<\/suggestions>/i, '').trim()

    return {
      content,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    }
  }

  // 2. Try Legacy format: SUGGESTIONS: ... (rest of text)
  // Supports SUGGESTIONS:, suggestions:, Suggestions:, **Suggestions:**, ## Suggestions
  // Also supports lowercase 'suggestions:' as seen in some model outputs
  const legacyMatch = rawContent.match(/(?:^|\n)(?:#{1,6}\s*)?(?:\*\*)?suggestions:?(?:\*\*)?\s*([\s\S]*)$/i)

  if (legacyMatch) {
    const suggestionBlock = legacyMatch[1]
    // For unstructured legacy text, be strict about bullets to avoid capturing conversational text
    const suggestions = parseBulletedList(suggestionBlock, false)

    if (suggestions.length > 0) {
      const content = rawContent.substring(0, legacyMatch.index).trim()
      return {
        content,
        suggestions,
      }
    }
  }

  // 3. Final Fallback: Check for 3 short lines at the very end of the content
  // This is risky, so we only do it if the lines look very much like suggestions (short, no punctuation at end?)
  // Actually, the screenshot shows lines without bullets. 
  // "dive deeper on gemini 3"
  // "what's the deal with meta's news push"
  // "tell me about that ai bubble talk"
  //
  // If we can identify a block of 1-4 short lines at the end that are separated by newlines
  // and the rest of the content has ended.
  //
  // However, doing this on streaming content is dangerous because it might eat the last paragraph while it's being typed.
  // So we skip this fallback for now and rely on the system prompt update to force better formatting.

  // No suggestions found
  return { content: rawContent }
}

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
      // The screenshot showed: "dive deeper on gemini 3" (no bullet)
      // But that was when the parser failed to find the block entirely.
      // If we match "suggestions:", we should probably be slightly more lenient if we found the header.
      // But we risk matching normal text.
      // Let's stick to requiring bullets/numbers for legacy blocks to be safe, 
      // unless the block is VERY clearly just a list (short lines).
      
      // Check for bullet/number
      if (/^(?:[-*•]|\d+\.|\[\d+\])/.test(line)) return true
      
      // Experimental: If we found a "suggestions:" header, maybe we accept lines that are short (< 100 chars)?
      // But the 'lenient' flag is currently false for legacy.
      return false
    })
    .map((line) => {
      // Remove leading bullet markers, numbers, or [n]
      return line.replace(/^(?:[-*•]|\d+\.?|\[\d+\])\s*/, '').trim()
    })
    .filter((line) => line.length > 0)
}
