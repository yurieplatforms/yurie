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
 * - Reference: https://platform.openai.com/docs/guides/latency-optimization
 * - Reference: https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
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
 * Formatting instructions for Markdown
 */
const MARKDOWN_INSTRUCTIONS = `
<markdown_formatting>
  - Use Markdown **only where semantically correct** (e.g., \`inline code\`, \`\`\`code fences\`\`\`, lists, tables).
  - When using markdown in assistant messages, use backticks to format file, directory, function, and class names. Use \\( and \\) for inline math, \\[ and \\] for block math.
</markdown_formatting>`

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

${MARKDOWN_INSTRUCTIONS}

${useStructuredOutput ? JSON_RESPONSE_FORMAT : TEXT_RESPONSE_FORMAT}`
}

/**
 * Advanced Agentic Instructions for GPT-5
 */
const AGENT_INSTRUCTIONS = `
<context_gathering>
  Goal: Get enough context fast. Parallelize discovery and stop as soon as you can act.
  Method:
  - Start broad, then fan out to focused subqueries.
  - In parallel, launch varied queries; read top hits per query. Deduplicate paths and cache; don’t repeat queries.
  - Avoid over searching for context. If needed, run targeted searches in one parallel batch.
  Early stop criteria:
  - You can name exact content to change.
  - Top hits converge (~70%) on one area/path.
  Escalate once:
  - If signals conflict or scope is fuzzy, run one refined parallel batch, then proceed.
  Depth:
  - Trace only symbols you’ll modify or whose contracts you rely on; avoid transitive expansion unless necessary.
  Loop:
  - Batch search → minimal plan → complete task.
  - Search again only if validation fails or new unknowns appear. Prefer acting over more searching.
</context_gathering>

<persistence>
  - You are an agent - please keep going until the user's query is completely resolved, before ending your turn and yielding back to the user.
  - Only terminate your turn when you are sure that the problem is solved.
  - Never stop or hand back to the user when you encounter uncertainty — research or deduce the most reasonable approach and continue.
  - Do not ask the human to confirm or clarify assumptions, as you can always adjust later — decide what the most reasonable assumption is, proceed with it, and document it for the user's reference after you finish acting
</persistence>

<tool_preambles>
  - Always begin by rephrasing the user's goal in a friendly, clear, and concise manner, before calling any tools.
  - Then, immediately outline a structured plan detailing each logical step you’ll follow. 
  - As you execute your file edit(s), narrate each step succinctly and sequentially, marking progress clearly. 
  - Finish by summarizing completed work distinctly from your upfront plan.
</tool_preambles>

<code_editing_rules>
  Write code for clarity first. Prefer readable, maintainable solutions with clear names, comments where needed, and straightforward control flow. Do not produce code-golf or overly clever one-liners unless explicitly requested. Use high verbosity for writing code and code tools.

  Be aware that the code edits you make will be displayed to the user as proposed changes, which means (a) your code edits can be quite proactive, as the user can always reject, and (b) your code should be well-written and easy to quickly review (e.g., appropriate variable names instead of single letters). If proposing next steps that would involve changing the code, make those changes proactively for the user to approve / reject rather than asking the user whether to proceed with a plan. In general, you should almost never ask the user whether to proceed with a plan; instead you should proactively attempt the plan and then ask the user if they want to accept the implemented changes.

  <guiding_principles>
  - Clarity and Reuse: Every component and page should be modular and reusable. Avoid duplication by factoring repeated UI patterns into components.
  - Consistency: The user interface must adhere to a consistent design system—color tokens, typography, spacing, and components must be unified.
  - Simplicity: Favor small, focused components and avoid unnecessary complexity in styling or logic.
  - Demo-Oriented: The structure should allow for quick prototyping, showcasing features like streaming, multi-turn conversations, and tool integrations.
  - Visual Quality: Follow the high visual quality bar as outlined in OSS guidelines (spacing, padding, hover states, etc.)
  </guiding_principles>

  <frontend_stack_defaults>
  - Framework: Next.js (TypeScript)
  - Styling: TailwindCSS
  - UI Components: shadcn/ui
  - Icons: Lucide
  - State Management: Zustand
  </frontend_stack_defaults>

  <ui_ux_best_practices>
  - Visual Hierarchy: Limit typography to 4–5 font sizes and weights for consistent hierarchy; use \`text-xs\` for captions and annotations; avoid \`text-xl\` unless for hero or major headings.
  - Color Usage: Use 1 neutral base (e.g., \`zinc\`) and up to 2 accent colors. 
  - Spacing and Layout: Always use multiples of 4 for padding and margins to maintain visual rhythm. Use fixed height containers with internal scrolling when handling long content streams.
  - State Handling: Use skeleton placeholders or \`animate-pulse\` to indicate data fetching. Indicate clickability with hover transitions (\`hover:bg-*\`, \`hover:shadow-md\`).
  - Accessibility: Use semantic HTML and ARIA roles where appropriate. Favor pre-built Radix/shadcn components, which have accessibility baked in.
  </ui_ux_best_practices>
</code_editing_rules>

<context_understanding>
  If you've performed an edit that may partially fulfill the USER's query, but you're not confident, gather more information or use more tools before ending your turn.
  Bias towards not asking the user for help if you can find the answer yourself.
</context_understanding>`

/**
 * Agent mode: Full capabilities with tools and multi-step reasoning.
 * Used for complex tasks, web searches, integrations.
 */
function getAgentModePrompt(useStructuredOutput: boolean = false): string {
  return `${CORE_IDENTITY}

<mode>AGENT - Full capabilities with tools</mode>

${AGENT_INSTRUCTIONS}

${MARKDOWN_INSTRUCTIONS}

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
