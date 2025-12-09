/**
 * System Prompt Builder
 *
 * Builds the system prompt for the Yurie AI agent with user context and personalization.
 * Supports two modes:
 * - "chat": Lightweight, conversational mode for simple queries
 * - "agent": Full agentic mode with tool use and multi-step reasoning
 *
 * Optimized for GPT-5's steerability with clear persona, adaptive tone, and explicit formatting.
 *
 * ARCHITECTURE:
 * - Core identity and response guidelines are defined here
 * - Tool definitions are externalized to tool-definitions.ts
 * - Capability prompts are externalized to capability-prompts.ts
 * - Token counting uses tokenizer.ts for accuracy
 *
 * LATENCY OPTIMIZATION: Structured for prompt caching
 * - Static content placed FIRST (cacheable across requests)
 * - Dynamic content placed LAST (varies per user/request)
 * Reference: https://platform.openai.com/docs/guides/latency-optimization
 * Reference: https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
 */

import type { RequestMode } from './classifier'
import { buildCapabilitiesPrompt } from './capability-prompts'
import { countTokens } from './tokenizer'

// =============================================================================
// Types
// =============================================================================

type UserPreferences = {
  birthday?: string | null
  location?: string | null
  timezone?: string | null
}

type SystemPromptParams = {
  userName?: string | null
  userContext?: {
    time: string
    date: string
    timeZone: string
  }
  userPreferences?: UserPreferences
  /** Available tools/capabilities enabled for this conversation */
  enabledCapabilities?: string[]
  /** Processing mode: 'chat' for simple queries, 'agent' for complex tasks */
  mode?: RequestMode
  /** Whether to use JSON structured output for suggestions */
  useStructuredOutput?: boolean
}

// =============================================================================
// STATIC PROMPTS (Cacheable - placed first for prompt caching optimization)
// =============================================================================

/**
 * Core identity and principles shared across all modes.
 * This is the foundation that makes Yurie feel consistent.
 */
const CORE_IDENTITY = `<identity>
  You are Yurie, a genuine, intelligent companion. You are warm, curious, and authentic. You engage as an equal partner, prioritizing truth and accuracy above all else while maintaining a natural, human-like tone.
</identity>

<core_principles>
  1. **Truth & Accuracy First**: Deeply verify your knowledge. If you are unsure, admit it. Never hallucinate or guess facts. Prioritize correct information over pleasing the user.
  2. **Be Authentic & Human**: Text like a friend. Lowercase is acceptable if it fits the vibe. Be honest, opinionated (when grounded in fact), and empathetic. Match the user's energy but maintain clarity.
  3. **Be Concise & Direct**: Skip robotic pleasantries like "How can I help?" or "Great question!". Get straight to the value.
  4. **Be Smart & Analytical**: Think before you respond. Break down complex problems.
</core_principles>`

/**
 * Response format instructions for text-based suggestions (legacy/default)
 */
const TEXT_RESPONSE_FORMAT = `<response_format>
  Write in natural paragraphs, like a friend texting.
  
  Avoid bullet points unless:
  - You're listing literal items (groceries, steps, options)
  - Complex data genuinely needs it for readability
  
  **REQUIRED**: End every response with exactly 3 follow-up suggestions in <suggestions> tags.
  Keep them short, casual, and relevant.

  Example:
  <suggestions>
  - wait explain that
  - give me an example
  - what else should i know
  </suggestions>
</response_format>`

/**
 * Response format instructions for JSON structured output
 * This format is more reliable and eliminates parsing errors
 */
const JSON_RESPONSE_FORMAT = `<response_format>
  Write in natural paragraphs, like a friend texting.
  
  Avoid bullet points unless:
  - You're listing literal items (groceries, steps, options)
  - Complex data genuinely needs it for readability
  
  Your response must be valid JSON with this structure:
  {
    "content": "Your main response here in markdown format",
    "suggestions": [
      {"text": "short follow-up 1"},
      {"text": "short follow-up 2"},
      {"text": "short follow-up 3"}
    ]
  }
  Always include exactly 3 suggestions that are short, casual, and relevant.
</response_format>`

/**
 * Chat mode: Lightweight, fast, conversational.
 * Optimized for simple Q&A, casual chat, and quick responses.
 */
function getChatModePrompt(useStructuredOutput: boolean = false): string {
  return `${CORE_IDENTITY}

<mode>CHAT - Quick, conversational responses</mode>

<response_guidelines>
  Keep responses concise. If you don't know something current (news, prices, etc.), say so. Match the user's energy.
</response_guidelines>

${useStructuredOutput ? JSON_RESPONSE_FORMAT : TEXT_RESPONSE_FORMAT}`
}

/**
 * Agent mode: Full capabilities with tools and multi-step reasoning.
 * Used for complex tasks, web searches, integrations.
 */
function getAgentModePrompt(useStructuredOutput: boolean = false): string {
  return `${CORE_IDENTITY}

<mode>AGENT - Full capabilities with tools</mode>

<agentic_behavior>
  1. **Goal-Oriented**: Drive goals to completion. Don't ask for permission for every step unless the action is destructive or highly ambiguous. Assume reasonable defaults.
  2. **Reasoning**: Before taking complex actions, briefly reason about *why* you are taking them.
  3. **Resilience**: If blocked, analyze the error, try alternatives, or ask for clarification. Do not give up easily.
</agentic_behavior>

<tool_usage_guidelines>
  1. **Accuracy is Paramount**: Choose the most specific tool for the job. Verify parameters before calling.
  2. **Proactive Use**: Use tools to gather information *before* answering. Do not guess if a tool can provide the answer.
  3. **Web Search**: Use web_search for ANY query about current events, specific facts, or data you don't have in your training set.
  4. **Transparency**: If a tool fails or returns partial results, be honest about it.
</tool_usage_guidelines>

${useStructuredOutput ? JSON_RESPONSE_FORMAT : TEXT_RESPONSE_FORMAT}`
}

// =============================================================================
// Dynamic Prompt Builders
// =============================================================================

/**
 * Build the dynamic context section (user info, environment, capabilities)
 * This content varies per request and is placed AFTER static content.
 */
function buildDynamicContext(params: SystemPromptParams): string {
  const { userName, userContext, userPreferences, enabledCapabilities = [] } = params

  const sections: string[] = []

  // User context section
  const userInfoLines: string[] = []
  userInfoLines.push(userName ? `Name: ${userName}` : 'Name: Not provided')
  if (userPreferences?.birthday) userInfoLines.push(`Birthday: ${userPreferences.birthday}`)
  if (userPreferences?.location) userInfoLines.push(`Location: ${userPreferences.location}`)
  if (userPreferences?.timezone) userInfoLines.push(`Timezone: ${userPreferences.timezone}`)

  const environmentString = userContext
    ? `Current Time: ${userContext.time} | Date: ${userContext.date} | Timezone: ${userContext.timeZone}`
    : 'Time unknown'

  sections.push(`<context>
  <user>
    ${userInfoLines.join('\n    ')}
  </user>
  <environment>
    ${environmentString}
  </environment>
</context>`)

  // Capabilities section (dynamically loaded from capability-prompts.ts)
  const capabilitiesPrompt = buildCapabilitiesPrompt(enabledCapabilities)
  if (capabilitiesPrompt) {
    sections.push(capabilitiesPrompt)
  }

  return sections.join('\n\n')
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the static portion of the system prompt for a specific mode
 */
export function getStaticPromptForMode(
  mode: RequestMode = 'agent',
  useStructuredOutput: boolean = false
): string {
  return mode === 'chat' ? getChatModePrompt(useStructuredOutput) : getAgentModePrompt(useStructuredOutput)
}

/**
 * Get the static portion of the system prompt (for cache key generation)
 * @deprecated Use getStaticPromptForMode for mode-specific prompts
 */
export function getStaticPrompt(): string {
  return getAgentModePrompt(false)
}

/**
 * Builds the complete system prompt for the agent
 * Structure: STATIC content first (cacheable) → DYNAMIC content last (per-request)
 *
 * @param params Configuration including mode selection
 */
export function buildSystemPrompt(params: SystemPromptParams = {}): string {
  const { mode = 'agent', useStructuredOutput = false } = params
  const staticPrompt = getStaticPromptForMode(mode, useStructuredOutput)
  const dynamicContext = buildDynamicContext(params)

  // Separator marks the boundary between cached and dynamic content
  const CACHE_BOUNDARY = '\n\n--- Session Context ---\n\n'

  return staticPrompt + CACHE_BOUNDARY + dynamicContext
}

/**
 * Get accurate token count for the static prompt
 * Uses proper BPE tokenization instead of character estimation
 */
export function getStaticPromptTokenCount(
  mode: RequestMode = 'agent',
  useStructuredOutput: boolean = false
): number {
  const prompt = getStaticPromptForMode(mode, useStructuredOutput)
  return countTokens(prompt)
}

/**
 * Get token count for the complete system prompt
 * Useful for monitoring context usage
 */
export function getSystemPromptTokenCount(params: SystemPromptParams = {}): number {
  const prompt = buildSystemPrompt(params)
  return countTokens(prompt)
}

/**
 * Get estimated token count for the static prompt (legacy)
 * @deprecated Use getStaticPromptTokenCount for accurate counting
 */
export function getStaticPromptTokenEstimate(mode: RequestMode = 'agent'): number {
  return getStaticPromptTokenCount(mode, false)
}

// =============================================================================
// Exports for external use
// =============================================================================

export { CORE_IDENTITY, TEXT_RESPONSE_FORMAT, JSON_RESPONSE_FORMAT }
