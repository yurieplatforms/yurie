export const runtime = 'nodejs'

import type { ApiRequestBody } from '@/app/types/api'
import { getOpenRouterConfig } from '@/app/lib/env'
import { jsonError, text, methodNotAllowed } from '@/app/lib/http'
import { buildOpenRouterPayload, fetchOpenRouterStream } from '@/app/services/openrouter'

export async function POST(req: Request) {
  try {
    const cfg = getOpenRouterConfig()
    const body = (await req.json()) as ApiRequestBody
    const payload = buildOpenRouterPayload(body)

    const controller = new AbortController()
    const stream = await fetchOpenRouterStream(payload, cfg, controller.signal, req.signal as AbortSignal)

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    return jsonError(500, 'server_error', msg)
  }
}

export function GET() {
  return methodNotAllowed()
}