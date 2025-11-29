/**
 * Runnable Tools
 * 
 * Creates tool definitions with run functions for the Anthropic SDK's tool runner.
 * Uses betaTool helper for type-safe tool definitions.
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
 */

import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { evaluateMathExpression, executeCode } from '@/lib/tools/handlers'
import { exaSearch, formatExaResultsForLLM, isExaAvailable } from '@/lib/tools/exa'
import type { ExaSearchInput } from '@/lib/tools/exa'
import type { ExaSearchCategory } from '@/lib/types'
import type { SSEHandler } from './sse-handler'

/**
 * Creates runnable tools with access to SSE handlers for real-time updates
 */
export function createRunnableTools(sseHandler: SSEHandler) {
  return [
    // Calculator tool for mathematical expressions
    betaTool({
      name: 'calculator',
      description:
        'Evaluates mathematical expressions and returns the numerical result. Use this tool for ANY math calculation beyond simple mental arithmetic, including percentages, unit conversions, trigonometry, and complex formulas. The tool supports basic arithmetic operators (+, -, *, /), exponentiation (**), parentheses for grouping, and common math functions (sqrt, sin, cos, tan, asin, acos, atan, log, log10, log2, exp, pow, abs, floor, ceil, round, min, max, random) as well as constants (pi, e, PI, E). Do NOT use this tool for non-numeric operations, string manipulation, or when the user is asking about math concepts rather than computing a specific value.',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate. Use standard math notation with function calls for complex operations. Examples: "2 + 2", "sqrt(16)", "sin(pi/2)", "max(1, 2, 3)", "log(100)/log(10)", "(5 + 3) * 2 ** 3"',
          },
        },
        required: ['expression'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        const expression = input.expression
        try {
          if (!expression || typeof expression !== 'string' || expression.trim().length === 0) {
            const errorMsg = 'Error: Missing or empty "expression" parameter. Please provide a mathematical expression as a string.'
            await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = evaluateMathExpression(expression)
          const resultStr = `${result}`
          await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, resultStr)
          return resultStr
        } catch (error) {
          const errorMsg = `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Run code tool for JavaScript execution
    betaTool({
      name: 'run_code',
      description:
        'Executes JavaScript code in a secure sandboxed environment and returns the result. Use this tool for complex calculations, data transformations, array/object manipulation, date operations, or any logic that would be tedious to express in a single mathematical expression. The sandbox provides access to standard JavaScript built-ins (Math, Date, JSON, Array, Object, String, Number, Boolean, parseInt, parseFloat) and a console object for logging. The last expression in the code is returned as the result. Do NOT use this for simple math (use calculator instead), and note that network requests (fetch), file system access, and other system operations are blocked for security.',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description:
              'JavaScript code to execute. The code runs in strict mode. Use console.log() for intermediate output and ensure the last expression evaluates to the desired result. Multi-line code is supported.',
          },
        },
        required: ['code'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        const code = input.code

        try {
          if (!code || typeof code !== 'string' || code.trim().length === 0) {
            const errorMsg = 'Error: Missing or empty "code" parameter. Please provide JavaScript code to execute.'
            await sseHandler.sendToolEvent('run_code', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }

          const result = executeCode(code)
          await sseHandler.sendToolEvent('run_code', 'end', input as Record<string, unknown>, result)
          return result
        } catch (error) {
          const errorMsg = `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('run_code', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // EXA semantic web search tool
    // Only include if EXA API key is configured
    ...(isExaAvailable()
      ? [
          betaTool({
            name: 'exa_search',
            description:
              'Performs semantic/neural web search using the EXA API. Use this tool when you need to find information with deep semantic understanding, search for specific content types (news, research papers, companies, GitHub repos), or need more control over search parameters. EXA excels at understanding the meaning behind queries, not just keyword matching. Use this for: research tasks, finding specific document types, searching within date ranges, or when the built-in web_search does not return relevant results. Do NOT use this for simple factual lookups where web_search suffices.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    'The search query. EXA uses semantic search, so natural language queries work well. Be descriptive about what you\'re looking for.',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Optional category to filter results. Use this to focus on specific content types.',
                },
                numResults: {
                  type: 'number',
                  description:
                    'Number of results to return (1-10). Default is 5.',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published after this date (ISO 8601 format, e.g., "2024-01-01").',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published before this date (ISO 8601 format).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only search these domains (e.g., ["arxiv.org", "github.com"]).',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude results from these domains.',
                },
                livecrawl: {
                  type: 'boolean',
                  description:
                    'Enable livecrawling to get the freshest content. Use when you need very recent information.',
                },
              },
              required: ['query'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const searchInput: ExaSearchInput = {
                query: input.query,
                category: input.category as ExaSearchCategory | undefined,
                numResults: input.numResults,
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                livecrawl: input.livecrawl,
              }

              try {
                if (!searchInput.query || searchInput.query.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "query" parameter. Please provide a search query.'
                  await sseHandler.sendToolEvent('exa_search', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaSearch(searchInput)
                const formattedResult = formatExaResultsForLLM(result)

                // Send SSE event with structured EXA search data
                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_search',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaSearch: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA search error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_search', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),
        ]
      : []),
  ]
}

