/**
 * Utilities for processing streaming chat responses
 */

/**
 * Process a chunk from the stream, handling reasoning tokens and incomplete tags
 */
export function processStreamChunk(
  raw: string,
  assistantIndex: number,
  streamBuffer: { current: string },
  setReasoningByMessageIndex: (fn: (prev: Record<number, string>) => Record<number, string>) => void,
  setLastResponseId: (id: string) => void
): string {
  if (!raw) return ''
  const thoughtRegex = /<thinking:([^>]+)>/g

  // Prepend any buffered partial tag from previous chunk
  let text = streamBuffer.current ? streamBuffer.current + raw : raw
  streamBuffer.current = ''

  // De-duplicate overlapping reasoning tokens by computing the non-overlapping suffix
  let clean = text.replace(thoughtRegex, (_m, delta: string) => {
    if (!delta) return ''
    setReasoningByMessageIndex((prev) => {
      const prevAll = prev[assistantIndex] || ''
      // Find the longest suffix of prevAll that is a prefix of delta
      let overlap = 0
      const maxOverlap = Math.min(prevAll.length, delta.length)
      for (let k = maxOverlap; k > 0; k--) {
        if (prevAll.slice(-k) === delta.slice(0, k)) { overlap = k; break }
      }
      const toAppend = delta.slice(overlap)
      if (!toAppend) return prev
      return { ...prev, [assistantIndex]: prevAll + toAppend }
    })
    return ''
  })

  // If a chunk ends with an incomplete tag (missing closing '>'),
  // buffer it so it doesn't leak to the UI and will be completed by the next chunk.
  const incompleteTagPatterns = ['<thinking:', '<citation:', '<response_id:', '<summary_text:']
  for (const pattern of incompleteTagPatterns) {
    const lastStart = clean.lastIndexOf(pattern)
    if (lastStart !== -1) {
      const tail = clean.slice(lastStart)
      if (!tail.includes('>')) {
        streamBuffer.current = tail
        clean = clean.slice(0, lastStart)
        break
      }
    }
  }

  const idMatch = /<response_id:([^>]+)>/.exec(clean)
  if (idMatch && idMatch[1]) setLastResponseId(idMatch[1])
  return clean
}