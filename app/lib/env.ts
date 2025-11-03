/**
 * Centralized environment configuration helpers.
 */

/** Return an environment variable value or undefined. */
export function getEnv(name: string): string | undefined {
  try {
    return (process.env as Record<string, string | undefined>)[name]
  } catch {
    return undefined
  }
}

/** Return an environment variable or throw a descriptive Error if missing. */
export function requireEnv(name: string): string {
  const v = getEnv(name)
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

export type OpenRouterConfig = {
  apiKey: string
  referrer: string
  title: string
}

/** Load OpenRouter configuration with sensible defaults for local dev. */
export function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = requireEnv('OPENROUTER_API_KEY')
  const referrer = getEnv('OPENROUTER_REFERRER') || 'http://localhost:3000'
  const title = getEnv('OPENROUTER_TITLE') || 'Yurie'
  return { apiKey, referrer, title }
}

export type SerpConfig = {
  apiKey: string | null
}

/** Return SerpApi key if configured (server or public), otherwise null. */
export function getSerpConfig(): SerpConfig {
  const apiKey = getEnv('SERPAPI_API_KEY') || getEnv('NEXT_PUBLIC_SERPAPI_API_KEY') || null
  return { apiKey }
}


