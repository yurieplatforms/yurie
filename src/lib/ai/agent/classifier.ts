/**
 * Request Classifier
 *
 * Analyzes user requests to determine the optimal processing mode:
 * - "chat": Simple conversational queries, Q&A, casual chat
 * - "agent": Complex tasks requiring tools, web search, or multi-step execution
 *
 * This enables adaptive processing for better latency and cost optimization.
 */

export type RequestMode = 'chat' | 'agent'

export type ClassificationResult = {
  mode: RequestMode
  reason: string
  confidence: 'high' | 'medium' | 'low'
  /** Suggested reasoning effort for the request */
  reasoningEffort: 'none' | 'low' | 'medium' | 'high'
  /** Whether tools should be available (even in chat mode, some may be useful) */
  toolsRecommended: string[]
}

// =============================================================================
// Intent Detection Patterns
// =============================================================================

/** Patterns that strongly indicate web search is needed */
const WEB_SEARCH_PATTERNS = [
  /\b(search|google|look up|find out|what('s| is) (the )?(latest|current|recent|new))\b/i,
  /\b(news|today|yesterday|this (week|month|year))\b/i,
  /\b(weather|forecast|stock|price|score|result)\b/i,
  /\b(who won|what happened|when (is|was|did))\b/i,
  /\b(trending|popular|best \d{4})\b/i,
  /\b(how much (does|is)|where (can i|to) buy)\b/i,
  /\b(reviews?|ratings?|compare|vs\.?|versus)\b/i,
]

/** Patterns that indicate email/Gmail tasks */
const EMAIL_PATTERNS = [
  /\b(send|compose|write|draft|reply).{0,20}(email|mail|message)\b/i,
  /\b(email|mail|inbox|unread|messages?)\b/i,
  /\b(check.{0,10}(my )?(email|inbox|mail))\b/i,
  /\bto\s+[\w.-]+@[\w.-]+\b/i, // Email address pattern
]

/** Patterns that indicate Spotify/music tasks */
const MUSIC_PATTERNS = [
  /\b(play|pause|skip|next|previous|stop|resume).{0,15}(song|music|track|album|playlist)?\b/i,
  /\b(spotify|music|song|track|artist|album|playlist)\b/i,
  /\b(what('s| is) playing|currently playing|now playing)\b/i,
  /\b(volume|louder|quieter|mute)\b/i,
  /\b(queue|add to queue)\b/i,
  /\b(shuffle|repeat|loop)\b/i,
]

/** Patterns indicating complex multi-step tasks */
const COMPLEX_TASK_PATTERNS = [
  /\b(and then|after that|next|also|additionally)\b/i,
  /\b(step by step|steps?|process|guide me|walk me through)\b/i,
  /\b(create|build|develop|implement|set up|configure)\b/i,
  /\b(analyze|research|investigate|compare|evaluate)\b/i,
  /\b(schedule|plan|organize|coordinate)\b/i,
  /\b(summarize|compile|aggregate|gather)\b/i,
]

/** Patterns indicating simple conversational queries */
const CASUAL_CHAT_PATTERNS = [
  /^(hi|hey|hello|yo|sup|what's up|how are you|good (morning|afternoon|evening))/i,
  /^(thanks|thank you|thx|ty|appreciate it)/i,
  /^(ok|okay|sure|got it|cool|nice|great|awesome)/i,
  /^(bye|goodbye|see you|later|gotta go)/i,
  /\?(?: |$)/, // Simple questions (single question mark at end)
]

/** Patterns indicating explanation/information requests (chat-suitable) */
const EXPLANATION_PATTERNS = [
  /^(what is|what's|what are|define|explain|describe|tell me about)\b/i,
  /^(how does|how do|how can|why does|why do|why is)\b/i,
  /^(can you (explain|tell|describe|help me understand))\b/i,
  /\b(meaning of|definition of)\b/i,
]

/** Patterns indicating image generation tasks */
const IMAGE_GENERATION_PATTERNS = [
  /\b(generate|create|make|draw|paint|render|visualize).{0,20}(image|picture|photo|illustration|art|drawing|painting)\b/i,
  /\b(image|picture|drawing|sketch) of\b/i,
]

// =============================================================================
// Classification Logic
// =============================================================================

/**
 * Check if any pattern in the list matches the text
 */
function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

/**
 * Count how many patterns match the text
 */
function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(text)).length
}

/**
 * Extract the last few user messages for context
 */
function getRecentUserContent(
  messages: Array<{ role: string; content: unknown }>
): string {
  const userMessages = messages.filter((m) => m.role === 'user').slice(-3)

  return userMessages
    .map((m) => {
      if (typeof m.content === 'string') return m.content
      if (Array.isArray(m.content)) {
        return m.content
          .filter(
            (seg): seg is { type: 'text'; text: string } => seg?.type === 'text'
          )
          .map((seg) => seg.text)
          .join(' ')
      }
      return ''
    })
    .join(' ')
}

/**
 * Classify a request to determine optimal processing mode
 */
export function classifyRequest(
  messages: Array<{ role: string; content: unknown }>,
  options: {
    /** Tools selected by user in UI */
    selectedTools?: string[]
    /** Whether user has connected integrations */
    connectedIntegrations?: string[]
  } = {}
): ClassificationResult {
  const { selectedTools = [], connectedIntegrations = [] } = options

  const userContent = getRecentUserContent(messages)
  const lastMessage =
    messages.filter((m) => m.role === 'user').pop()?.content ?? ''
  const lastMessageText =
    typeof lastMessage === 'string'
      ? lastMessage
      : Array.isArray(lastMessage)
        ? lastMessage
            .filter(
              (seg): seg is { type: 'text'; text: string } =>
                seg?.type === 'text'
            )
            .map((seg) => seg.text)
            .join(' ')
        : ''

  // Track signals for each mode
  let agentSignals = 0
  let chatSignals = 0
  const toolsRecommended: string[] = []

  // ==========================================================================
  // Signal 1: Explicit tool selection (strong agent signal)
  // ==========================================================================
  if (selectedTools.length > 0) {
    agentSignals += 3
    toolsRecommended.push(...selectedTools)
  }

  // ==========================================================================
  // Signal 2: Web search patterns
  // ==========================================================================
  const webSearchMatches = countMatches(userContent, WEB_SEARCH_PATTERNS)
  if (webSearchMatches > 0) {
    agentSignals += webSearchMatches * 2
    if (!toolsRecommended.includes('web_search')) {
      toolsRecommended.push('web_search')
    }
  }

  // ==========================================================================
  // Signal 3: Email patterns (if Gmail connected)
  // ==========================================================================
  if (
    connectedIntegrations.includes('gmail') ||
    selectedTools.includes('gmail')
  ) {
    const emailMatches = countMatches(userContent, EMAIL_PATTERNS)
    if (emailMatches > 0) {
      agentSignals += emailMatches * 2
      if (!toolsRecommended.includes('gmail')) {
        toolsRecommended.push('gmail')
      }
    }
  }

  // ==========================================================================
  // Signal 4: Music patterns (if Spotify connected)
  // ==========================================================================
  if (
    connectedIntegrations.includes('spotify') ||
    selectedTools.includes('spotify')
  ) {
    const musicMatches = countMatches(userContent, MUSIC_PATTERNS)
    if (musicMatches > 0) {
      agentSignals += musicMatches * 2
      if (!toolsRecommended.includes('spotify')) {
        toolsRecommended.push('spotify')
      }
    }
  }

  // ==========================================================================
  // Signal 4.5: Image generation patterns (if available)
  // ==========================================================================
  if (
    connectedIntegrations.includes('image_generation') ||
    selectedTools.includes('image_generation')
  ) {
    const imageMatches = countMatches(userContent, IMAGE_GENERATION_PATTERNS)
    if (imageMatches > 0) {
      agentSignals += imageMatches * 3 // Strong signal
      if (!toolsRecommended.includes('image_generation')) {
        toolsRecommended.push('image_generation')
      }
    }
  }

  // ==========================================================================
  // Signal 5: Complex task patterns
  // ==========================================================================
  const complexMatches = countMatches(userContent, COMPLEX_TASK_PATTERNS)
  if (complexMatches > 0) {
    agentSignals += complexMatches
  }

  // ==========================================================================
  // Signal 6: Simple chat patterns (chat signal)
  // ==========================================================================
  if (matchesAny(lastMessageText, CASUAL_CHAT_PATTERNS)) {
    chatSignals += 2
  }

  // ==========================================================================
  // Signal 7: Explanation requests (generally chat-suitable)
  // ==========================================================================
  if (matchesAny(lastMessageText, EXPLANATION_PATTERNS)) {
    // Unless it's about current events
    if (!matchesAny(userContent, WEB_SEARCH_PATTERNS)) {
      chatSignals += 1
    }
  }

  // ==========================================================================
  // Signal 8: Message length heuristic
  // ==========================================================================
  if (lastMessageText.length < 50) {
    chatSignals += 1 // Short messages tend to be simple
  } else if (lastMessageText.length > 200) {
    agentSignals += 1 // Longer messages often have complex requests
  }

  // ==========================================================================
  // Signal 9: File/image attachments (suggests need for analysis)
  // ==========================================================================
  if (Array.isArray(lastMessage)) {
    const hasMedia = lastMessage.some(
      (seg) =>
        seg?.type === 'image_url' ||
        seg?.type === 'file' ||
        seg?.type === 'url_image' ||
        seg?.type === 'url_document'
    )
    if (hasMedia) {
      // Media analysis benefits from higher reasoning
      agentSignals += 1
    }
  }

  // ==========================================================================
  // Determine mode and confidence
  // ==========================================================================
  const totalSignals = agentSignals + chatSignals
  let mode: RequestMode
  let confidence: 'high' | 'medium' | 'low'
  let reason: string

  if (agentSignals > chatSignals + 2) {
    mode = 'agent'
    confidence = agentSignals >= 4 ? 'high' : 'medium'
    reason =
      toolsRecommended.length > 0
        ? `Task requires tools: ${toolsRecommended.join(', ')}`
        : 'Complex task detected'
  } else if (chatSignals > agentSignals + 1) {
    mode = 'chat'
    confidence = chatSignals >= 3 ? 'high' : 'medium'
    reason = 'Simple conversational query'
  } else {
    // Ambiguous - default to agent for safety (tools available if needed)
    mode = totalSignals === 0 ? 'chat' : 'agent'
    confidence = 'low'
    reason = 'Ambiguous request, defaulting to ' + mode + ' mode'
  }

  // ==========================================================================
  // Determine reasoning effort
  // ==========================================================================
  let reasoningEffort: 'none' | 'low' | 'medium' | 'high'

  if (mode === 'chat') {
    // Simple chat doesn't need heavy reasoning
    reasoningEffort =
      complexMatches > 0 || lastMessageText.length > 150 ? 'low' : 'none'
  } else {
    // Agent mode benefits from reasoning
    reasoningEffort =
      agentSignals >= 5 || complexMatches >= 2
        ? 'high'
        : agentSignals >= 3
          ? 'medium'
          : 'low'
  }

  return {
    mode,
    reason,
    confidence,
    reasoningEffort,
    toolsRecommended,
  }
}

/**
 * Quick check if a message likely needs web search
 */
export function likelyNeedsWebSearch(text: string): boolean {
  return matchesAny(text, WEB_SEARCH_PATTERNS)
}

/**
 * Quick check if a message is likely a simple greeting/acknowledgment
 */
export function isSimpleGreeting(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.length < 30 && matchesAny(trimmed, CASUAL_CHAT_PATTERNS)
}

