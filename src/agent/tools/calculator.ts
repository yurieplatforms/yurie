import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { evaluateMathExpression } from '@/agent/tools/handlers'
import type { SSEHandler } from '@/agent/sse-handler'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCalculatorTool(sseHandler: SSEHandler): any {
  return betaTool({
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
  })
}

