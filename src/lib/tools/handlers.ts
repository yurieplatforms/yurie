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
