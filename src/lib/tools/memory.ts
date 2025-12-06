import type { SupabaseClient } from '@supabase/supabase-js'

const MEMORIES_PREFIX = '/memories'

export type MemoryToolInput = {
  command: 'view' | 'create' | 'str_replace' | 'insert' | 'delete' | 'rename'
  path?: string
  view_range?: [number, number]
  file_text?: string
  old_str?: string
  new_str?: string
  insert_line?: number
  insert_text?: string
  old_path?: string
  new_path?: string
}

export type MemoryToolResult = {
  success: boolean
  content?: string
  error?: string
}

type MemoryRow = {
  path: string
  content: string
  updated_at: string
  accessed_at: string
  size_bytes: number
}

function normalizePath(path: string): string {
  if (!path) return MEMORIES_PREFIX
  if (!path.startsWith(MEMORIES_PREFIX)) {
    return path.startsWith('/') 
      ? `${MEMORIES_PREFIX}${path}` 
      : `${MEMORIES_PREFIX}/${path}`
  }
  return path
}

function getLineContent(content: string, range?: [number, number]): string {
  const lines = content.split('\n')
  if (!range) return content
  
  const [start, end] = range
  const startIdx = Math.max(0, start - 1)
  const endIdx = Math.min(lines.length, end)
  
  return lines
    .slice(startIdx, endIdx)
    .map((line, idx) => `${startIdx + idx + 1}: ${line}`)
    .join('\n')
}

export function createMemoryToolHandler(supabase: SupabaseClient, userId: string) {
  return {
    async execute(input: MemoryToolInput): Promise<MemoryToolResult> {
      const { command } = input

      switch (command) {
        case 'view':
          return await handleView(supabase, userId, input)
        case 'create':
          return await handleCreate(supabase, userId, input)
        case 'str_replace':
          return await handleStrReplace(supabase, userId, input)
        case 'insert':
          return await handleInsert(supabase, userId, input)
        case 'delete':
          return await handleDelete(supabase, userId, input)
        case 'rename':
          return await handleRename(supabase, userId, input)
        default:
          return { success: false, error: `Unknown command: ${command}` }
      }
    }
  }
}

async function handleView(
  supabase: SupabaseClient,
  userId: string,
  input: MemoryToolInput
): Promise<MemoryToolResult> {
  const path = input.path ? normalizePath(input.path) : MEMORIES_PREFIX

  // Check if listing directory (path ends with / or is the root)
  if (path === MEMORIES_PREFIX || path.endsWith('/')) {
    const { data, error } = await supabase
      .from('memories')
      .select('path, content, updated_at, size_bytes')
      .eq('user_id', userId)
      .like('path', `${path.replace(/\/$/, '')}%`)
      .order('path')

    if (error) {
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      return { success: true, content: 'No memories found. Directory is empty.' }
    }

    const listing = (data as MemoryRow[]).map(m => {
      const relativePath = m.path.replace(MEMORIES_PREFIX, '')
      return `${relativePath} (${m.size_bytes} bytes, updated: ${new Date(m.updated_at).toLocaleString()})`
    }).join('\n')

    return { success: true, content: `Files in ${path}:\n${listing}` }
  }

  // View specific file
  const { data, error } = await supabase
    .from('memories')
    .select('path, content, updated_at, size_bytes')
    .eq('user_id', userId)
    .eq('path', path)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: `File not found: ${path}` }
    }
    return { success: false, error: error.message }
  }

  const content = getLineContent((data as MemoryRow).content, input.view_range)
  return { success: true, content }
}

async function handleCreate(
  supabase: SupabaseClient,
  userId: string,
  input: MemoryToolInput
): Promise<MemoryToolResult> {
  if (!input.path) {
    return { success: false, error: 'Path is required for create command' }
  }

  const path = normalizePath(input.path)
  const content = input.file_text || ''

  // Check if file already exists
  const { data: existing } = await supabase
    .from('memories')
    .select('path')
    .eq('user_id', userId)
    .eq('path', path)
    .single()

  if (existing) {
    // Update existing file
    const { error } = await supabase
      .from('memories')
      .update({
        content,
        size_bytes: new Blob([content]).size,
        updated_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('path', path)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, content: `Updated file: ${path}` }
  }

  // Create new file
  const { error } = await supabase
    .from('memories')
    .insert({
      user_id: userId,
      path,
      content,
      size_bytes: new Blob([content]).size,
      updated_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, content: `Created file: ${path}` }
}

async function handleStrReplace(
  supabase: SupabaseClient,
  userId: string,
  input: MemoryToolInput
): Promise<MemoryToolResult> {
  if (!input.path) {
    return { success: false, error: 'Path is required for str_replace command' }
  }
  if (input.old_str === undefined) {
    return { success: false, error: 'old_str is required for str_replace command' }
  }
  if (input.new_str === undefined) {
    return { success: false, error: 'new_str is required for str_replace command' }
  }

  const path = normalizePath(input.path)

  const { data, error: fetchError } = await supabase
    .from('memories')
    .select('content')
    .eq('user_id', userId)
    .eq('path', path)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return { success: false, error: `File not found: ${path}` }
    }
    return { success: false, error: fetchError.message }
  }

  const oldContent = (data as { content: string }).content
  if (!oldContent.includes(input.old_str)) {
    return { success: false, error: `String not found in file: "${input.old_str}"` }
  }

  const newContent = oldContent.replace(input.old_str, input.new_str)

  const { error: updateError } = await supabase
    .from('memories')
    .update({
      content: newContent,
      size_bytes: new Blob([newContent]).size,
      updated_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('path', path)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, content: `Replaced string in: ${path}` }
}

async function handleInsert(
  supabase: SupabaseClient,
  userId: string,
  input: MemoryToolInput
): Promise<MemoryToolResult> {
  if (!input.path) {
    return { success: false, error: 'Path is required for insert command' }
  }
  if (input.insert_line === undefined) {
    return { success: false, error: 'insert_line is required for insert command' }
  }
  if (input.insert_text === undefined) {
    return { success: false, error: 'insert_text is required for insert command' }
  }

  const path = normalizePath(input.path)

  const { data, error: fetchError } = await supabase
    .from('memories')
    .select('content')
    .eq('user_id', userId)
    .eq('path', path)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return { success: false, error: `File not found: ${path}` }
    }
    return { success: false, error: fetchError.message }
  }

  const lines = (data as { content: string }).content.split('\n')
  const insertIdx = Math.max(0, Math.min(input.insert_line - 1, lines.length))
  lines.splice(insertIdx, 0, input.insert_text)
  const newContent = lines.join('\n')

  const { error: updateError } = await supabase
    .from('memories')
    .update({
      content: newContent,
      size_bytes: new Blob([newContent]).size,
      updated_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('path', path)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, content: `Inserted text at line ${input.insert_line} in: ${path}` }
}

async function handleDelete(
  supabase: SupabaseClient,
  userId: string,
  input: MemoryToolInput
): Promise<MemoryToolResult> {
  if (!input.path) {
    return { success: false, error: 'Path is required for delete command' }
  }

  const path = normalizePath(input.path)

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('user_id', userId)
    .eq('path', path)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, content: `Deleted: ${path}` }
}

async function handleRename(
  supabase: SupabaseClient,
  userId: string,
  input: MemoryToolInput
): Promise<MemoryToolResult> {
  if (!input.old_path) {
    return { success: false, error: 'old_path is required for rename command' }
  }
  if (!input.new_path) {
    return { success: false, error: 'new_path is required for rename command' }
  }

  const oldPath = normalizePath(input.old_path)
  const newPath = normalizePath(input.new_path)

  // Check if old file exists
  const { data, error: fetchError } = await supabase
    .from('memories')
    .select('content, size_bytes')
    .eq('user_id', userId)
    .eq('path', oldPath)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return { success: false, error: `File not found: ${oldPath}` }
    }
    return { success: false, error: fetchError.message }
  }

  // Check if new path already exists
  const { data: existingNew } = await supabase
    .from('memories')
    .select('path')
    .eq('user_id', userId)
    .eq('path', newPath)
    .single()

  if (existingNew) {
    return { success: false, error: `Destination already exists: ${newPath}` }
  }

  // Update the path
  const { error: updateError } = await supabase
    .from('memories')
    .update({
      path: newPath,
      updated_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('path', oldPath)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, content: `Renamed: ${oldPath} -> ${newPath}` }
}

