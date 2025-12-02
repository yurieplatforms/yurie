import { Composio } from '@composio/core'
import { AnthropicProvider } from '@composio/anthropic'
import { env } from '@/lib/config/env'

let composioClient: Composio | null = null
let composioAnthropicClient: Composio | null = null

/**
 * Lazily initialized base Composio Client.
 * Returns null if COMPOSIO_API_KEY is not configured.
 *
 * @see https://docs.composio.dev/sdk-reference/type-script/core-classes/composio
 */
export function getComposioClient(): Composio | null {
  if (!env.COMPOSIO_API_KEY) {
    return null
  }

  if (!composioClient) {
    composioClient = new Composio({
      apiKey: env.COMPOSIO_API_KEY,
    })
  }

  return composioClient
}

/**
 * Lazily initialized Composio Client with Anthropic provider.
 * Use this when integrating with Anthropic's Claude models.
 * Returns null if COMPOSIO_API_KEY is not configured.
 *
 * @see https://docs.composio.dev/providers/anthropic
 */
export function getComposioAnthropicClient(): Composio | null {
  if (!env.COMPOSIO_API_KEY) {
    return null
  }

  if (!composioAnthropicClient) {
    composioAnthropicClient = new Composio({
      apiKey: env.COMPOSIO_API_KEY,
      provider: new AnthropicProvider(),
    })
  }

  return composioAnthropicClient
}

/**
 * Check if Composio is available (API key is configured)
 */
export function isComposioAvailable(): boolean {
  return Boolean(env.COMPOSIO_API_KEY)
}

/**
 * Default user ID for Composio operations.
 * In production, this should be the authenticated user's ID.
 */
export const COMPOSIO_DEFAULT_USER_ID = 'default'
