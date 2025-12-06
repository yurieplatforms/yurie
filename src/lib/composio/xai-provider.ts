import { BaseNonAgenticProvider, Tool } from '@composio/core'

/**
 * Tool definition for xAI (Grok)
 * Follows OpenAI's function calling format as xAI is API-compatible
 */
export interface XAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type XAIToolCollection = XAITool[]

/**
 * Composio Provider for xAI (Grok)
 * Transforms Composio tools into xAI-compatible function tools
 */
export class XAIProvider extends BaseNonAgenticProvider<XAIToolCollection, XAITool> {
  readonly name = 'xai'

  constructor() {
    super()
  }

  /**
   * Transforms a single Composio tool into an xAI tool
   */
  override wrapTool(tool: Tool): XAITool {
    return {
      type: 'function',
      function: {
        name: tool.slug,
        description: tool.description || '',
        parameters: {
          type: 'object',
          properties: tool.inputParameters?.properties || {},
          required: tool.inputParameters?.required || [],
        },
      },
    }
  }

  /**
   * Transforms a collection of Composio tools into xAI tools
   */
  override wrapTools(tools: Tool[]): XAIToolCollection {
    return tools.map((tool) => this.wrapTool(tool))
  }

  /**
   * Execute a tool call from xAI response
   */
  async executeXAIToolCall(
    userId: string,
    toolCall: {
      name: string
      arguments: Record<string, unknown>
    },
    connectionId?: string
  ): Promise<string> {
    const result = await this.executeTool(toolCall.name, {
      userId,
      arguments: toolCall.arguments,
      ...(connectionId ? { connectedAccountId: connectionId } : {}),
    })

    return JSON.stringify(result.data)
  }
}

