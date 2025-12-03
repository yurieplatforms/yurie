import Exa from 'exa-js'
import { env } from '@/config/env'
import type { RetryConfig } from './errors'

// ============================================================================
// EXA Client
// ============================================================================

/**
 * Lazily initialized EXA client.
 * Returns null if EXA_API_KEY is not configured.
 */
let exaClient: Exa | null = null

export function getExaClient(): Exa | null {
  if (!env.EXA_API_KEY) {
    return null
  }

  if (!exaClient) {
    exaClient = new Exa(env.EXA_API_KEY)
  }

  return exaClient
}

/**
 * Check if EXA is available (API key is configured)
 */
export function isExaAvailable(): boolean {
  return Boolean(env.EXA_API_KEY)
}

/**
 * Default retry configuration for EXA API calls
 * @see https://docs.exa.ai/reference/error-codes
 */
export const DEFAULT_EXA_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
}

