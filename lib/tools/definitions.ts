import type Anthropic from '@anthropic-ai/sdk'
import type { WebSearchUserLocation } from '@/lib/types'

// Re-export execution handlers for backward compatibility
export {
  evaluateMathExpression,
  executeCode,
  executeClientTool,
  isClientTool,
} from './handlers'

// ============================================================================
// Tool Types
// ============================================================================

export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ServerToolType = 'web_search' | 'web_fetch'
export type ClientToolType = 'calculator' | 'memory' | 'run_code'
export type ToolName = ServerToolType | ClientToolType

// ============================================================================
// Web Search Tool Configuration
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
// ============================================================================

export type WebSearchToolConfig = {
  maxUses?: number
  userLocation?: WebSearchUserLocation
  allowedDomains?: string[]
  blockedDomains?: string[]
}

/**
 * Creates a web search tool with optional configuration
 * Supports user_location for localized search results
 * See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool#localization
 */
export function createWebSearchTool(config: WebSearchToolConfig = {}): Anthropic.Tool {
  const tool: Record<string, unknown> = {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: config.maxUses ?? 5,
  }

  // Add user location for localized search results
  if (config.userLocation) {
    tool.user_location = config.userLocation
  }

  // Add domain filtering (can only use one at a time)
  if (config.allowedDomains && config.allowedDomains.length > 0) {
    tool.allowed_domains = config.allowedDomains
  } else if (config.blockedDomains && config.blockedDomains.length > 0) {
    tool.blocked_domains = config.blockedDomains
  }

  return tool as unknown as Anthropic.Tool
}

// ============================================================================
// Server-Side Tool Definitions (Anthropic executes these)
// ============================================================================

// Default server tools without user location (for backwards compatibility)
export const serverTools: Anthropic.Tool[] = [
  createWebSearchTool(),
  // Web fetch tool - Retrieves full content from web pages and PDFs
  // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
  {
    type: 'web_fetch_20250910',
    name: 'web_fetch',
    max_uses: 5,                    // Limit fetches per request
    max_content_tokens: 50000,      // Prevent excessive token usage (~20 average pages)
    citations: { enabled: true },   // Enable citations for proper attribution
  } as unknown as Anthropic.Tool,
]

/**
 * Creates server tools with optional web search configuration
 * Use this when you need to pass user location for localized search results
 */
export function createServerTools(webSearchConfig?: WebSearchToolConfig): Anthropic.Tool[] {
  return [
    createWebSearchTool(webSearchConfig),
    // Web fetch tool
    {
      type: 'web_fetch_20250910',
      name: 'web_fetch',
      max_uses: 5,
      max_content_tokens: 50000,
      citations: { enabled: true },
    } as unknown as Anthropic.Tool,
  ]
}

// ============================================================================
// Client-Side Tool Definitions (We execute these)
// Best practices: Detailed descriptions, input examples, strict schema validation
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
// See: https://platform.claude.com/docs/en/build-with-claude/structured-outputs#strict-tool-use
// ============================================================================

export const clientTools: Anthropic.Tool[] = [
  {
    name: 'calculator',
    description:
      'Evaluates mathematical expressions and returns the numerical result as a string. Use this tool for ANY math calculation beyond simple mental arithmetic, including percentages, unit conversions, trigonometry, and complex formulas. The tool supports basic arithmetic operators (+, -, *, /), exponentiation (**), parentheses for grouping, and common math functions (sqrt, sin, cos, tan, asin, acos, atan, log, log10, log2, exp, pow, abs, floor, ceil, round, min, max, random) as well as constants (pi, e, PI, E). Returns: A string containing the numeric result (e.g., "42" or "3.14159"). On error, returns an error message string starting with "Error:".',
    // Enable strict mode for guaranteed schema-compliant inputs
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            'The mathematical expression to evaluate. Use standard math notation with function calls for complex operations. Examples: "2 + 2", "sqrt(16)", "sin(pi/2)", "max(1, 2, 3)", "log(100)/log(10)", "(5 + 3) * 2 ** 3"',
        },
      },
      required: ['expression'],
      additionalProperties: false,
    },
    input_examples: [
      { expression: 'sqrt(144) + 15' },
      { expression: 'sin(pi/4) * 2' },
      { expression: 'max(10, 25, 8) / min(2, 3)' },
      { expression: '(100 * 0.15) + 50' },
      { expression: 'pow(2, 10)' },
    ],
  } as Anthropic.Tool,
  // Note: Memory tool is now handled by Anthropic's official Memory Tool
  // See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
  {
    name: 'run_code',
    description:
      'Executes JavaScript code in a secure sandboxed environment and returns the result. Use this tool for complex calculations, data transformations, array/object manipulation, date operations, or any logic that would be tedious to express in a single mathematical expression. The sandbox provides access to standard JavaScript built-ins (Math, Date, JSON, Array, Object, String, Number, Boolean, parseInt, parseFloat) and a console object for logging. The last expression in the code is returned as the result. Do NOT use this for simple math (use calculator instead), and note that network requests (fetch), file system access, and other system operations are blocked for security. Returns: A string containing console output (if any) followed by "Result: <JSON value>" for the last expression, or "Error: <message>" on failure.',
    // Enable strict mode for guaranteed schema-compliant inputs
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description:
            'JavaScript code to execute. The code runs in strict mode. Use console.log() for intermediate output and ensure the last expression evaluates to the desired result. Multi-line code is supported.',
        },
      },
      required: ['code'],
      additionalProperties: false,
    },
    input_examples: [
      { code: 'const arr = [1, 2, 3, 4, 5];\narr.reduce((sum, n) => sum + n, 0)' },
      { code: 'const date = new Date();\n`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`' },
      { code: 'const obj = {a: 1, b: 2, c: 3};\nObject.entries(obj).map(([k, v]) => `${k}=${v}`).join("&")' },
    ],
  } as Anthropic.Tool,
]

// All tools combined for the API request
export const allTools: Anthropic.Tool[] = [...serverTools, ...clientTools]

// ============================================================================
// Tool Extraction Helpers
// ============================================================================

/**
 * Extract tool use blocks from message content
 */
export function extractToolUseBlocks(
  content: Anthropic.ContentBlock[],
): ToolUseBlock[] {
  return content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  ) as ToolUseBlock[]
}

/**
 * Extract text blocks from message content
 */
export function extractTextContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

