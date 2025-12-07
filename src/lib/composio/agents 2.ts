/**
 * Composio Agent Utilities
 *
 * Pre-configured agents for common Composio use cases using the OpenAI Agents SDK.
 * 
 * This module uses the @openai/agents SDK with the OpenAI Agents Provider.
 * For the standard OpenAI SDK (responses.create), use the Responses Provider instead.
 *
 * @see https://docs.composio.dev/providers/openai-agents
 * @see https://docs.composio.dev/providers/openai (for Responses API)
 */

import { Agent, run } from '@openai/agents'
import { getGmailToolsForAgents, GmailTools, DEFAULT_GMAIL_TOOLS, type GmailToolName } from './tools'
import type { EmailAgentResult, ComposioTool } from './types'

export type { EmailAgentResult }

/**
 * Agent configuration options
 */
export interface AgentConfig {
  /** Agent name */
  name?: string
  /** Agent instructions/system prompt */
  instructions?: string
  /** Model to use (if supported by provider) */
  model?: string
}

/**
 * Default instructions for different agent types
 */
export const AgentInstructions = {
  emailManager: `You are an email management assistant. Help users:
- Send professional emails with proper formatting
- Read and summarize emails
- Search for specific emails
- Create drafts for review
- Manage email organization

Always confirm email details before sending. Be concise but professional.`,

  emailComposer: `You are an email composition assistant. Help users:
- Draft professional emails
- Improve email tone and clarity
- Format emails appropriately for the context
- Suggest subject lines

Always review the recipient and content before sending.`,

  emailSearcher: `You are an email search assistant. Help users:
- Find specific emails by content, sender, or date
- Summarize search results
- Identify important emails

Provide clear summaries of search results.`,
} as const

/**
 * Create an email management agent with Gmail tools
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param options - Agent configuration options
 * @returns Configured Agent instance
 *
 * @example
 * const agent = await createEmailAgent('user-123')
 *
 * @example
 * // With custom configuration
 * const agent = await createEmailAgent('user-123', {
 *   toolNames: [GmailTools.SEND_EMAIL, GmailTools.CREATE_DRAFT],
 *   config: { instructions: 'Be extra formal in all emails.' }
 * })
 */
export async function createEmailAgent(
  externalUserId: string,
  options?: {
    /** Specific Gmail tools to use */
    toolNames?: GmailToolName[]
    /** Agent configuration */
    config?: AgentConfig
  }
): Promise<Agent> {
  const toolNames = options?.toolNames ?? DEFAULT_GMAIL_TOOLS
  // Use the agents provider for @openai/agents SDK
  const tools = await getGmailToolsForAgents(externalUserId, toolNames)

  const agent = new Agent({
    name: options?.config?.name ?? 'Email Manager',
    instructions: options?.config?.instructions ?? AgentInstructions.emailManager,
    // The Composio SDK formats tools correctly for OpenAI Agents
    tools: tools,
  })

  return agent
}

/**
 * Create an email composition agent (send and draft only)
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param config - Optional agent configuration
 * @returns Configured Agent instance
 */
export async function createEmailComposerAgent(
  externalUserId: string,
  config?: AgentConfig
): Promise<Agent> {
  return createEmailAgent(externalUserId, {
    toolNames: [GmailTools.SEND_EMAIL, GmailTools.CREATE_DRAFT, GmailTools.REPLY_TO_EMAIL],
    config: {
      name: config?.name ?? 'Email Composer',
      instructions: config?.instructions ?? AgentInstructions.emailComposer,
    },
  })
}

/**
 * Create an email search agent (read only)
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param config - Optional agent configuration
 * @returns Configured Agent instance
 */
export async function createEmailSearchAgent(
  externalUserId: string,
  config?: AgentConfig
): Promise<Agent> {
  return createEmailAgent(externalUserId, {
    toolNames: [
      GmailTools.FETCH_EMAILS,
      GmailTools.GET_EMAIL,
      GmailTools.SEARCH_EMAILS,
      GmailTools.GET_ATTACHMENTS,
    ],
    config: {
      name: config?.name ?? 'Email Searcher',
      instructions: config?.instructions ?? AgentInstructions.emailSearcher,
    },
  })
}

/**
 * Create a custom agent with any Composio tools
 *
 * @param tools - Array of Composio tools
 * @param config - Agent configuration
 * @returns Configured Agent instance
 *
 * @example
 * const tools = await getTools(userId, { toolkits: ['SLACK'] })
 * const agent = createCustomAgent(tools, {
 *   name: 'Slack Bot',
 *   instructions: 'Help users send Slack messages.'
 * })
 */
export function createCustomAgent(
  tools: ComposioTool[],
  config: AgentConfig
): Agent {
  return new Agent({
    name: config.name ?? 'Custom Agent',
    instructions: config.instructions ?? 'You are a helpful assistant.',
    tools: tools,
  })
}

/**
 * Run an email agent with a specific task
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param task - The task description for the agent
 * @param options - Optional configuration
 * @returns Result of the agent execution
 *
 * @example
 * const result = await runEmailAgent(
 *   'user-123',
 *   'Send an email to john@example.com with subject "Hello" and body "Hi there!"'
 * )
 *
 * @example
 * // With specific tools
 * const result = await runEmailAgent(
 *   'user-123',
 *   'Find all emails from boss@company.com this week',
 *   { toolNames: [GmailTools.SEARCH_EMAILS, GmailTools.GET_EMAIL] }
 * )
 */
export async function runEmailAgent(
  externalUserId: string,
  task: string,
  options?: {
    /** Specific Gmail tools to use */
    toolNames?: GmailToolName[]
    /** Agent configuration */
    config?: AgentConfig
  }
): Promise<EmailAgentResult> {
  try {
    const agent = await createEmailAgent(externalUserId, options)

    console.log(`[agent] Running email agent for user: ${externalUserId}`)
    console.log(`[agent] Task: ${task.substring(0, 100)}...`)

    const result = await run(agent, task)

    console.log('[agent] ✅ Agent completed successfully')

    return {
      success: true,
      output: result.finalOutput,
    }
  } catch (error) {
    console.error('[agent] ❌ Email agent error:', error)

    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Run a custom agent with a task
 *
 * @param agent - The agent to run
 * @param task - The task description
 * @returns Result of the agent execution
 */
export async function runAgent(
  agent: Agent,
  task: string
): Promise<EmailAgentResult> {
  try {
    console.log(`[agent] Running agent: ${agent.name}`)
    const result = await run(agent, task)

    return {
      success: true,
      output: result.finalOutput,
    }
  } catch (error) {
    console.error('[agent] Agent error:', error)

    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
