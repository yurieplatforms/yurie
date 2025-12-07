/**
 * Composio Client Configuration
 *
 * Initializes and exports the Composio client with OpenAI Responses provider.
 * 
 * The OpenAI Responses Provider transforms Composio tools into a format compatible
 * with OpenAI's Responses API for building agentic flows.
 * 
 * @see https://docs.composio.dev/providers/openai
 */

import { Composio } from '@composio/core'
import { OpenAIResponsesProvider } from '@composio/openai'
import { OpenAIAgentsProvider } from '@composio/openai-agents'
import { env } from '@/lib/config/env'

// Provider types
export type ProviderType = 'responses' | 'agents'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let composioClient: Composio<any> | null = null
let composioResponsesProvider: OpenAIResponsesProvider | null = null
let composioAgentsProvider: OpenAIAgentsProvider | null = null

/**
 * Get the OpenAI Responses provider for Composio
 * Use this with the standard OpenAI SDK's responses.create() API
 * 
 * @see https://docs.composio.dev/providers/openai#responses-api
 */
export function getComposioResponsesProvider(): OpenAIResponsesProvider {
  if (!composioResponsesProvider) {
    composioResponsesProvider = new OpenAIResponsesProvider()
  }
  return composioResponsesProvider
}

/**
 * Get the OpenAI Agents provider for Composio
 * Use this with the @openai/agents SDK (Agent, run)
 * 
 * @see https://docs.composio.dev/providers/openai-agents
 */
export function getComposioAgentsProvider(): OpenAIAgentsProvider {
  if (!composioAgentsProvider) {
    composioAgentsProvider = new OpenAIAgentsProvider()
  }
  return composioAgentsProvider
}

/**
 * Legacy alias for getComposioAgentsProvider
 * @deprecated Use getComposioResponsesProvider() or getComposioAgentsProvider() instead
 */
export function getComposioProvider(): OpenAIAgentsProvider {
  return getComposioAgentsProvider()
}

/**
 * Get the Composio client instance (singleton)
 * 
 * By default, uses the OpenAI Responses provider which is recommended for
 * building agentic flows with the standard OpenAI SDK.
 * 
 * @param providerType - Which provider to use ('responses' or 'agents')
 * @returns Composio client instance
 * 
 * @example
 * // For OpenAI Responses API (default)
 * const composio = getComposioClient()
 * const tools = await composio.tools.get(userId, { tools: ['GMAIL_SEND_EMAIL'] })
 * const result = await composio.provider.handleToolCalls(userId, response.output)
 * 
 * @example
 * // For OpenAI Agents SDK
 * const composio = getComposioClient('agents')
 * const tools = await composio.tools.get(userId, { tools: ['GMAIL_SEND_EMAIL'] })
 * // Use with @openai/agents Agent and run()
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComposioClient(providerType: ProviderType = 'responses'): Composio<any> {
  // Check for API key
  const apiKey = env.COMPOSIO_API_KEY

  if (!apiKey) {
    throw new Error(
      'COMPOSIO_API_KEY is not set. Please add it to your environment variables.'
    )
  }

  // Create client with the requested provider
  // Note: We cache a single client, so switching providers requires app restart
  if (!composioClient) {
    const provider = providerType === 'agents' 
      ? getComposioAgentsProvider() 
      : getComposioResponsesProvider()
    
    composioClient = new Composio({
      apiKey,
      provider,
    })
    
    console.log(`[composio] Initialized client with ${providerType} provider`)
  }

  return composioClient
}

/**
 * Handle tool calls from OpenAI Responses API
 * 
 * This executes the function calls returned by OpenAI and returns the results.
 * 
 * @param userId - The user ID for tool execution context
 * @param output - The response output from OpenAI responses.create()
 * @returns Results of tool execution
 * 
 * @example
 * const response = await openai.responses.create({...})
 * const result = await handleToolCalls(userId, response.output)
 * 
 * @see https://docs.composio.dev/providers/openai#responses-api
 */
export async function handleToolCalls(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const composio = getComposioClient('responses')
  return composio.provider.handleToolCalls(userId, output)
}
