/**
 * Small HTTP helpers for JSON/text responses and standardized errors.
 */

export function json(data: unknown, init?: number | ResponseInit): Response {
  const baseInit: ResponseInit = typeof init === 'number' ? { status: init } : (init || {})
  return new Response(JSON.stringify(data), {
    ...baseInit,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(baseInit.headers || {}),
    },
  })
}

export function text(message: string, init?: number | ResponseInit): Response {
  const baseInit: ResponseInit = typeof init === 'number' ? { status: init } : (init || {})
  return new Response(message, {
    ...baseInit,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(baseInit.headers || {}),
    },
  })
}

/**
 * Create a standardized error JSON response.
 * Shape: { error: { code: string, message: string, ...extras } }
 */
export function jsonError(status: number, code: string, message: string, extras?: Record<string, unknown>): Response {
  const payload = { error: { code, message, ...(extras || {}) } }
  return json(payload, { status })
}

export function methodNotAllowed(): Response {
  return text('Method Not Allowed', 405)
}


