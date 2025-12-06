import { Composio } from '@composio/core'
import { XAIProvider } from './xai-provider'
import { env } from '@/lib/config/env'

let composioClient: Composio | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let composioXAIClient: Composio<any> | null = null

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
 * Lazily initialized Composio Client with xAI provider.
 * Use this when integrating with xAI's Grok models.
 * Returns null if COMPOSIO_API_KEY is not configured.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComposioXAIClient(): Composio<any> | null {
  if (!env.COMPOSIO_API_KEY) {
    return null
  }

  if (!composioXAIClient) {
    composioXAIClient = new Composio({
      apiKey: env.COMPOSIO_API_KEY,
      provider: new XAIProvider(),
    })
  }

  return composioXAIClient
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
