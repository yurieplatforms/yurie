/**
 * Memory Tool Configuration
 * 
 * Creates the memory tool definition for use with the Anthropic SDK's tool runner.
 * The memory tool provides persistent file-based storage in a /memories directory.
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
 */

import type { SSEHandler } from '@/agent/sse-handler'
import type { MemoryToolHandler, MemoryToolInput } from '@/services/memory'

/**
 * Memory tool input schema definition
 */
export const memoryToolSchema = {
  type: 'object' as const,
  properties: {
    command: {
      type: 'string' as const,
      enum: ['view', 'create', 'str_replace', 'insert', 'delete', 'rename'] as const,
      description: 'The memory operation to perform.',
    },
    path: {
      type: 'string' as const,
      description: 'Path to the file or directory (e.g., "/memories" or "/memories/notes.txt").',
    },
    view_range: {
      type: 'array' as const,
      items: { type: 'number' as const },
      description: 'Optional: For view command, specify [start_line, end_line] to view specific lines.',
    },
    file_text: {
      type: 'string' as const,
      description: 'For create command: The content to write to the file.',
    },
    old_str: {
      type: 'string' as const,
      description: 'For str_replace command: The text to find and replace.',
    },
    new_str: {
      type: 'string' as const,
      description: 'For str_replace command: The replacement text.',
    },
    insert_line: {
      type: 'number' as const,
      description: 'For insert command: The line number to insert at (1-indexed).',
    },
    insert_text: {
      type: 'string' as const,
      description: 'For insert command: The text to insert.',
    },
    old_path: {
      type: 'string' as const,
      description: 'For rename command: The current path of the file/directory.',
    },
    new_path: {
      type: 'string' as const,
      description: 'For rename command: The new path for the file/directory.',
    },
  },
  required: ['command'] as const,
  additionalProperties: false,
}

/**
 * Creates the memory tool with SSE event handlers
 * 
 * @param sseHandler - Handler for sending SSE events
 * @param memoryToolHandler - Handler for executing memory operations (null if unauthenticated)
 */
export function createMemoryTool(
  sseHandler: SSEHandler,
  memoryToolHandler: MemoryToolHandler | null,
) {
  return {
    name: 'memory',
    description:
      'Persistent memory storage for saving and retrieving information across conversations. Use this tool to store notes, track progress, remember user preferences, and maintain context across sessions. The memory is organized as files in a /memories directory.',
    input_schema: memoryToolSchema,
    run: async (input: Record<string, unknown>) => {
      await sseHandler.sendToolEvent('memory', 'start', input)
      
      try {
        if (!memoryToolHandler) {
          const errorMsg = 'Memory tool requires authentication. Please log in to use persistent memory.'
          await sseHandler.sendToolEvent('memory', 'end', input, errorMsg)
          return errorMsg
        }

        const result = await memoryToolHandler.execute(input as unknown as MemoryToolInput)
        
        if (result.success) {
          await sseHandler.sendToolEvent('memory', 'end', input, result.content)
          
          // Return search_result block for file views to enable citations
          if (result.searchResult) {
            return [result.searchResult] as unknown as string
          }
          
          return result.content
        } else {
          const errorMsg = result.error || 'Unknown memory operation error'
          await sseHandler.sendToolEvent('memory', 'end', input, errorMsg)
          return errorMsg
        }
      } catch (error) {
        const errorMsg = `Memory tool error: ${error instanceof Error ? error.message : 'Unknown error'}`
        await sseHandler.sendToolEvent('memory', 'end', input, errorMsg)
        return errorMsg
      }
    },
  }
}
