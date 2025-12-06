import { z } from 'zod'
import { tool } from 'ai'
import { createMemoryToolHandler, type MemoryToolInput } from '@/lib/tools/memory'
import type { SupabaseClient } from '@supabase/supabase-js'

export const createMemoryTool = (supabase: SupabaseClient, userId: string) => tool({
  description: `Persistent memory storage...`,
  parameters: z.object({
    command: z.enum(['view', 'create', 'str_replace', 'insert', 'delete', 'rename']).describe('The memory operation to perform.'),
    path: z.string().optional().describe('Path to the file or directory (e.g., "/memories" or "/memories/notes.txt").'),
    view_range: z.tuple([z.number(), z.number()]).optional().describe('Optional: For view command, specify [start_line, end_line] to view specific lines.'),
    file_text: z.string().optional().describe('For create command: The content to write to the file.'),
    old_str: z.string().optional().describe('For str_replace command: The text to find and replace.'),
    new_str: z.string().optional().describe('For str_replace command: The replacement text.'),
    insert_line: z.number().optional().describe('For insert command: The line number to insert at (1-indexed).'),
    insert_text: z.string().optional().describe('For insert command: The text to insert.'),
    old_path: z.string().optional().describe('For rename command: The current path of the file/directory.'),
    new_path: z.string().optional().describe('For rename command: The new path for the file/directory.'),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async (input: any) => {
    const handler = createMemoryToolHandler(supabase, userId)
    // Cast input to MemoryToolInput because zod types match but are inferred
    const result = await handler.execute(input as unknown as MemoryToolInput)
    
    if (result.success) {
        return result.content
    } else {
        return `Error: ${result.error}`
    }
  },
} as any)

