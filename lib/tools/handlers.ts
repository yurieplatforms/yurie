// ============================================================================
// Tool Execution Handlers
// Safe execution environments for client-side tools
// See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
// ============================================================================

/**
 * Safe math expression evaluator
 * Supports basic arithmetic, exponentiation, and common math functions
 */
export function evaluateMathExpression(expression: string): number {
  // Create a safe math context with allowed functions
  const mathContext: Record<string, unknown> = {
    // Constants
    pi: Math.PI,
    e: Math.E,
    PI: Math.PI,
    E: Math.E,
    // Functions
    sqrt: Math.sqrt,
    abs: Math.abs,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    log: Math.log,
    log10: Math.log10,
    log2: Math.log2,
    exp: Math.exp,
    pow: Math.pow,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    random: Math.random,
  }

  // Sanitize the expression - only allow safe characters
  const sanitized = expression.replace(/[^0-9+\-*/().,%\s\w]/g, '')

  // Build function with math context
  const contextKeys = Object.keys(mathContext)
  const contextValues = Object.values(mathContext)

  try {
    // Create a function that evaluates the expression with math functions in scope
    const fn = new Function(...contextKeys, `return (${sanitized})`)
    const result = fn(...contextValues)

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Expression did not evaluate to a valid number')
    }

    return result
  } catch (error) {
    throw new Error(
      `Failed to evaluate expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * Safe JavaScript code execution with sandboxing
 * Provides limited access to built-in objects while blocking dangerous operations
 */
export function executeCode(code: string): string {
  const logs: string[] = []

  // Create a sandboxed console
  const sandboxConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map((a) => JSON.stringify(a)).join(' '))
    },
    error: (...args: unknown[]) => {
      logs.push(`[ERROR] ${args.map((a) => JSON.stringify(a)).join(' ')}`)
    },
    warn: (...args: unknown[]) => {
      logs.push(`[WARN] ${args.map((a) => JSON.stringify(a)).join(' ')}`)
    },
  }

  // Limited global scope
  const sandbox: Record<string, unknown> = {
    console: sandboxConsole,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    // Prevent access to dangerous globals
    fetch: undefined,
    require: undefined,
    import: undefined,
    eval: undefined,
    Function: undefined,
    process: undefined,
    global: undefined,
    window: undefined,
    document: undefined,
  }

  try {
    // Wrap code to capture return value
    const wrappedCode = `
      "use strict";
      ${code}
    `

    const fn = new Function(...Object.keys(sandbox), wrappedCode)
    const result = fn(...Object.values(sandbox))

    // Combine logs and result
    const output: string[] = []
    if (logs.length > 0) {
      output.push('Console output:')
      output.push(...logs)
    }
    if (result !== undefined) {
      output.push(`Result: ${JSON.stringify(result, null, 2)}`)
    }

    return output.length > 0 ? output.join('\n') : 'Code executed successfully (no output)'
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Execute a client-side tool and return the result
 * Returns descriptive error messages to help Claude retry with corrections
 * See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use#troubleshooting-errors
 * 
 * Note: Memory operations are now handled by Anthropic's official Memory Tool
 * See: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
 */
export async function executeClientTool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  try {
    switch (toolName) {
      case 'calculator': {
        const expression = input.expression as string
        if (!expression || typeof expression !== 'string') {
          return {
            result: 'Error: Missing required "expression" parameter. Please provide a mathematical expression as a string, e.g. "sqrt(16) + 5"',
            isError: true,
          }
        }
        if (expression.trim().length === 0) {
          return {
            result: 'Error: The "expression" parameter is empty. Please provide a valid mathematical expression.',
            isError: true,
          }
        }
        const result = evaluateMathExpression(expression)
        return { result: `${result}`, isError: false }
      }

      case 'run_code': {
        const code = input.code as string
        if (!code || typeof code !== 'string') {
          return {
            result: 'Error: Missing required "code" parameter. Please provide JavaScript code to execute.',
            isError: true,
          }
        }
        if (code.trim().length === 0) {
          return {
            result: 'Error: The "code" parameter is empty. Please provide valid JavaScript code.',
            isError: true,
          }
        }
        const result = executeCode(code)
        // Check if the execution returned an error
        if (result.startsWith('Error:')) {
          return { result, isError: true }
        }
        return { result, isError: false }
      }

      default:
        return {
          result: `Error: Unknown tool "${toolName}". Available tools are: calculator, run_code. Memory operations use the dedicated memory tool.`,
          isError: true,
        }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      result: `Tool execution error: ${errorMessage}. Please check your input and try again.`,
      isError: true,
    }
  }
}

/**
 * Check if a tool is a client-side tool (needs local execution)
 * Note: The 'memory' tool is handled separately via the Memory Tool Handler
 */
export function isClientTool(toolName: string): boolean {
  return ['calculator', 'memory', 'run_code'].includes(toolName)
}

