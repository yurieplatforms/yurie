/**
 * Response Schema
 *
 * Defines structured output formats for AI responses.
 * Using JSON schema instead of XML tags eliminates parsing errors
 * and improves UI reliability.
 *
 * @see https://platform.openai.com/docs/guides/structured-outputs
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas
// =============================================================================

/**
 * Schema for follow-up suggestions
 */
export const SuggestionSchema = z.object({
  text: z.string().describe('Short, casual follow-up suggestion (e.g., "tell me more", "what about X?")'),
})

/**
 * Schema for structured response with suggestions
 */
export const StructuredResponseSchema = z.object({
  content: z.string().describe('The main response content'),
  suggestions: z
    .array(SuggestionSchema)
    .length(3)
    .describe('Exactly 3 natural follow-up suggestions'),
})

/**
 * Schema for chat responses (lightweight)
 */
export const ChatResponseSchema = z.object({
  content: z.string().describe('Conversational response'),
  suggestions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('2-4 short follow-up suggestions'),
})

// =============================================================================
// TypeScript Types (inferred from Zod)
// =============================================================================

export type Suggestion = z.infer<typeof SuggestionSchema>
export type StructuredResponse = z.infer<typeof StructuredResponseSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>

// =============================================================================
// JSON Schema Exports (for OpenAI API)
// =============================================================================

/**
 * JSON Schema for structured responses
 * Use with response_format: { type: "json_schema", json_schema: { ... } }
 */
export const STRUCTURED_RESPONSE_JSON_SCHEMA = {
  name: 'structured_response',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The main response content in markdown format',
      },
      suggestions: {
        type: 'array',
        description: 'Exactly 3 natural follow-up suggestions',
        items: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Short, casual follow-up (e.g., "tell me more", "what about X?")',
            },
          },
          required: ['text'],
          additionalProperties: false,
        },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ['content', 'suggestions'],
    additionalProperties: false,
  },
} as const

/**
 * Simplified JSON Schema for when strict mode is not needed
 */
export const SIMPLE_RESPONSE_JSON_SCHEMA = {
  name: 'chat_response',
  schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The response content',
      },
      suggestions: {
        type: 'array',
        description: '2-4 follow-up suggestions',
        items: {
          type: 'string',
        },
      },
    },
    required: ['content'],
  },
} as const

// =============================================================================
// Parsing Utilities
// =============================================================================

/**
 * Parse a structured JSON response
 *
 * @param jsonString - Raw JSON string from the API
 * @returns Parsed and validated response
 * @throws ZodError if validation fails
 */
export function parseStructuredResponse(jsonString: string): StructuredResponse {
  const parsed = JSON.parse(jsonString)
  return StructuredResponseSchema.parse(parsed)
}

/**
 * Safely parse a structured response with fallback
 *
 * @param jsonString - Raw JSON string from the API
 * @returns Parsed response or null if parsing fails
 */
export function safeParseStructuredResponse(jsonString: string): StructuredResponse | null {
  try {
    const parsed = JSON.parse(jsonString)
    const result = StructuredResponseSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Parse chat response with flexible validation
 *
 * @param jsonString - Raw JSON string from the API
 * @returns Parsed response with optional suggestions
 */
export function parseChatResponse(jsonString: string): ChatResponse | null {
  try {
    const parsed = JSON.parse(jsonString)
    const result = ChatResponseSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Extract suggestions from various response formats
 * Handles both JSON and legacy XML formats for backwards compatibility
 *
 * @param content - Response content (JSON or text with XML tags)
 * @returns Array of suggestion strings, or undefined if none found
 */
export function extractSuggestions(content: string): string[] | undefined {
  // Try JSON format first
  try {
    const jsonMatch = content.match(/^\s*\{[\s\S]*\}\s*$/)
    if (jsonMatch) {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.map((s: unknown) =>
          typeof s === 'string' ? s : (s as Suggestion).text
        )
      }
    }
  } catch {
    // Not JSON, try other formats
  }

  // Try embedded JSON in content
  try {
    const embeddedJsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
    if (embeddedJsonMatch) {
      const parsed = JSON.parse(embeddedJsonMatch[1])
      if (Array.isArray(parsed.suggestions)) {
        return parsed.suggestions.map((s: unknown) =>
          typeof s === 'string' ? s : (s as Suggestion).text
        )
      }
    }
  } catch {
    // Not embedded JSON
  }

  // Fall back to XML parsing (legacy support)
  const xmlMatch = content.match(/<suggestions>([\s\S]*?)<\/suggestions>/i)
  if (xmlMatch) {
    const suggestions = xmlMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('```'))
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line) => line.length > 0)

    return suggestions.length > 0 ? suggestions : undefined
  }

  return undefined
}

/**
 * Remove suggestion blocks from content
 * Handles both JSON and XML formats
 *
 * @param content - Response content
 * @returns Content with suggestions removed
 */
export function removesSuggestionsFromContent(content: string): string {
  // Remove XML suggestions block
  let cleaned = content.replace(/<suggestions>[\s\S]*?<\/suggestions>/gi, '')

  // Remove embedded JSON suggestion blocks
  cleaned = cleaned.replace(/```json\s*\{[\s\S]*?"suggestions"[\s\S]*?\}\s*```/gi, '')

  return cleaned.trim()
}

// =============================================================================
// Response Format Configuration
// =============================================================================

export type ResponseFormatType = 'text' | 'json_object' | 'json_schema'

/**
 * Get the appropriate response format configuration for OpenAI API
 *
 * @param format - Desired format type
 * @param strict - Whether to use strict JSON schema validation
 * @returns Response format configuration for API
 */
export function getResponseFormatConfig(
  format: ResponseFormatType,
  strict: boolean = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> | undefined {
  switch (format) {
    case 'text':
      return undefined // Default text mode

    case 'json_object':
      return { type: 'json_object' }

    case 'json_schema':
      return {
        type: 'json_schema',
        json_schema: strict ? STRUCTURED_RESPONSE_JSON_SCHEMA : SIMPLE_RESPONSE_JSON_SCHEMA,
      }

    default:
      return undefined
  }
}

