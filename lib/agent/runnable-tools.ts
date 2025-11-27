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
  ]
}

