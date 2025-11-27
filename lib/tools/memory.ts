/**
 * Memory Tool Handler
 * 
 * Implements Anthropic's Memory Tool with Supabase storage backend.
 * Handles all 6 memory commands: view, create, str_replace, insert, delete, rename
 * 
 * Security measures:
 * - Path traversal protection (validates paths start with /memories, rejects ../)
 * - User isolation via Supabase RLS
 * - File size limits (100KB per file, 1MB total per user)
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SearchResultBlock } from '@/lib/types'

// ============================================================================
// Types
// ============================================================================

export type MemoryCommand = 'view' | 'create' | 'str_replace' | 'insert' | 'delete' | 'rename'

export type MemoryToolInput = {
  command: MemoryCommand
  path?: string
  // For view command - optional line range
  view_range?: [number, number]
  // For create command
  file_text?: string
  // For str_replace command
  old_str?: string
  new_str?: string
  // For insert command
  insert_line?: number
  insert_text?: string
  // For rename command
  old_path?: string
  new_path?: string
}

export type MemoryToolResult = {
  success: boolean
  content: string
  error?: string
  // Search result block for file views with citations enabled
  // See: https://platform.claude.com/docs/en/build-with-claude/search-results
  searchResult?: SearchResultBlock
}

// ============================================================================
// Constants
// ============================================================================

const MEMORIES_PREFIX = '/memories'
const MAX_FILE_SIZE_BYTES = 100 * 1024 // 100KB per file
const MAX_TOTAL_SIZE_BYTES = 1024 * 1024 // 1MB total per user
const MAX_CONTENT_RETURN_CHARS = 50000 // Max chars to return in view

// ============================================================================
// Path Security
// ============================================================================

/**
 * Validates and normalizes a memory path.
 * Implements security measures to prevent directory traversal attacks.
 * 
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool#path-traversal-protection
 */
function validatePath(path: string): { valid: boolean; normalized: string; error?: string } {
  // Check for empty path
  if (!path || typeof path !== 'string') {
    return { valid: false, normalized: '', error: 'Path is required' }
  }

  // Decode URL-encoded sequences that could hide traversal
  let decodedPath = path
  try {
    decodedPath = decodeURIComponent(path)
  } catch {
    // If decoding fails, use original
  }

  // Check for traversal patterns
  const traversalPatterns = [
    /\.\./,           // ..
    /\.\.\\/, // ..\
    /%2e%2e/i,        // URL encoded ..
    /%252e%252e/i,    // Double URL encoded
  ]

  for (const pattern of traversalPatterns) {
    if (pattern.test(decodedPath) || pattern.test(path)) {
      return { valid: false, normalized: '', error: 'Path traversal detected' }
    }
  }

  // Normalize the path
  let normalized = decodedPath
    .replace(/\\/g, '/') // Convert backslashes
    .replace(/\/+/g, '/') // Collapse multiple slashes

  // Ensure path starts with /memories
  if (!normalized.startsWith(MEMORIES_PREFIX)) {
    if (normalized.startsWith('/')) {
      return { valid: false, normalized: '', error: `Path must start with ${MEMORIES_PREFIX}` }
    }
    // Auto-prefix if relative path given
    normalized = `${MEMORIES_PREFIX}/${normalized}`
  }

  // Remove trailing slash unless it's just /memories
  if (normalized !== MEMORIES_PREFIX && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return { valid: true, normalized }
}

/**
 * Check if path represents a directory (ends with / or is exactly /memories)
 */
function isDirectoryPath(path: string): boolean {
  return path === MEMORIES_PREFIX || path.endsWith('/')
}

// ============================================================================
// Memory Tool Handler Class
// ============================================================================

export class MemoryToolHandler {
  private supabase: SupabaseClient
  private userId: string

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase
    this.userId = userId
  }

  /**
   * Execute a memory tool command
   */
  async execute(input: MemoryToolInput): Promise<MemoryToolResult> {
    const { command } = input

    try {
      switch (command) {
        case 'view':
          return await this.view(input.path || MEMORIES_PREFIX, input.view_range)
        case 'create':
          return await this.create(input.path!, input.file_text || '')
        case 'str_replace':
          return await this.strReplace(input.path!, input.old_str!, input.new_str!)
        case 'insert':
          return await this.insert(input.path!, input.insert_line!, input.insert_text!)
        case 'delete':
          return await this.deleteFile(input.path!)
        case 'rename':
          return await this.rename(input.old_path!, input.new_path!)
        default:
          return { success: false, content: '', error: `Unknown command: ${command}` }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[memory-tool] Error executing ${command}:`, message)
      return { success: false, content: '', error: message }
    }
  }

  /**
   * VIEW command - shows directory contents or file contents with optional line ranges
   */
  private async view(path: string, viewRange?: [number, number]): Promise<MemoryToolResult> {
    const validation = validatePath(path)
    if (!validation.valid) {
      return { success: false, content: '', error: validation.error }
    }

    const normalizedPath = validation.normalized

    // Check if viewing directory or file
    if (normalizedPath === MEMORIES_PREFIX || isDirectoryPath(normalizedPath)) {
      return await this.viewDirectory(normalizedPath)
    }

    return await this.viewFile(normalizedPath, viewRange)
  }

  /**
   * View directory contents
   */
  private async viewDirectory(dirPath: string): Promise<MemoryToolResult> {
    // List all files in the directory
    const { data, error } = await this.supabase
      .from('memories')
      .select('path')
      .eq('user_id', this.userId)
      .like('path', `${dirPath}%`)
      .order('path')

    if (error) {
      return { success: false, content: '', error: `Database error: ${error.message}` }
    }

    // Update accessed_at for all viewed files
    if (data && data.length > 0) {
      await this.supabase
        .from('memories')
        .update({ accessed_at: new Date().toISOString() })
        .eq('user_id', this.userId)
        .like('path', `${dirPath}%`)
    }

    if (!data || data.length === 0) {
      return { success: true, content: `Directory: ${dirPath}\n(empty)` }
    }

    // Extract unique filenames relative to directory
    const files = data
      .map(row => {
        const relativePath = row.path.replace(dirPath === MEMORIES_PREFIX ? MEMORIES_PREFIX + '/' : dirPath, '')
        // Only show immediate children (no nested paths)
        const firstSlash = relativePath.indexOf('/')
        return firstSlash === -1 ? relativePath : relativePath.substring(0, firstSlash) + '/'
      })
      .filter((v, i, a) => a.indexOf(v) === i) // Unique
      .sort()

    const content = `Directory: ${dirPath}\n${files.map(f => `- ${f}`).join('\n')}`
    return { success: true, content }
  }

  /**
   * View file contents with optional line range
   * Returns a search_result block for citations support
   * See: https://platform.claude.com/docs/en/build-with-claude/search-results
   */
  private async viewFile(filePath: string, viewRange?: [number, number]): Promise<MemoryToolResult> {
    const { data, error } = await this.supabase
      .from('memories')
      .select('content')
      .eq('user_id', this.userId)
      .eq('path', filePath)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, content: '', error: `File not found: ${filePath}` }
      }
      return { success: false, content: '', error: `Database error: ${error.message}` }
    }

    // Update accessed_at
    await this.supabase
      .from('memories')
      .update({ accessed_at: new Date().toISOString() })
      .eq('user_id', this.userId)
      .eq('path', filePath)

    let content = data.content || ''

    // Apply line range if specified
    if (viewRange && viewRange.length === 2) {
      const lines = content.split('\n')
      const [start, end] = viewRange
      const startIdx = Math.max(0, start - 1) // 1-indexed to 0-indexed
      const endIdx = Math.min(lines.length, end)
      content = lines.slice(startIdx, endIdx).join('\n')
    }

    // Truncate if too long
    if (content.length > MAX_CONTENT_RETURN_CHARS) {
      content = content.substring(0, MAX_CONTENT_RETURN_CHARS) + '\n\n[Content truncated. Use view_range to paginate.]'
    }

    // Extract filename from path for title
    const filename = filePath.split('/').pop() || filePath

    // Return with search_result block for citation support
    // See: https://platform.claude.com/docs/en/build-with-claude/search-results
    const searchResult: SearchResultBlock = {
      type: 'search_result',
      source: filePath,
      title: filename,
      content: [{ type: 'text', text: content }],
      citations: { enabled: true },
    }

    return { success: true, content, searchResult }
  }

  /**
   * CREATE command - create or overwrite a file
   */
  private async create(path: string, fileText: string): Promise<MemoryToolResult> {
    const validation = validatePath(path)
    if (!validation.valid) {
      return { success: false, content: '', error: validation.error }
    }

    const normalizedPath = validation.normalized

    // Validate path is a file, not directory
    if (normalizedPath === MEMORIES_PREFIX) {
      return { success: false, content: '', error: 'Cannot create file at root directory path' }
    }

    // Check file size
    const fileSizeBytes = new TextEncoder().encode(fileText).length
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return { 
        success: false, 
        content: '', 
        error: `File too large: ${fileSizeBytes} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes` 
      }
    }

    // Check total storage limit
    const totalCheck = await this.checkTotalStorageLimit(fileSizeBytes, normalizedPath)
    if (!totalCheck.allowed) {
      return { success: false, content: '', error: totalCheck.error }
    }

    // Upsert the file
    const { error } = await this.supabase
      .from('memories')
      .upsert({
        user_id: this.userId,
        path: normalizedPath,
        content: fileText,
        updated_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,path'
      })

    if (error) {
      return { success: false, content: '', error: `Database error: ${error.message}` }
    }

    return { success: true, content: `File created: ${normalizedPath}` }
  }

  /**
   * STR_REPLACE command - replace text in a file
   */
  private async strReplace(path: string, oldStr: string, newStr: string): Promise<MemoryToolResult> {
    const validation = validatePath(path)
    if (!validation.valid) {
      return { success: false, content: '', error: validation.error }
    }

    const normalizedPath = validation.normalized

    // Get current content
    const { data, error: fetchError } = await this.supabase
      .from('memories')
      .select('content')
      .eq('user_id', this.userId)
      .eq('path', normalizedPath)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { success: false, content: '', error: `File not found: ${normalizedPath}` }
      }
      return { success: false, content: '', error: `Database error: ${fetchError.message}` }
    }

    const content = data.content || ''
    
    // Check if old_str exists
    if (!content.includes(oldStr)) {
      return { success: false, content: '', error: `Text not found in file: "${oldStr.substring(0, 50)}..."` }
    }

    // Replace first occurrence
    const newContent = content.replace(oldStr, newStr)

    // Check new file size
    const newSizeBytes = new TextEncoder().encode(newContent).length
    if (newSizeBytes > MAX_FILE_SIZE_BYTES) {
      return { 
        success: false, 
        content: '', 
        error: `Resulting file too large: ${newSizeBytes} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes` 
      }
    }

    // Update the file
    const { error: updateError } = await this.supabase
      .from('memories')
      .update({
        content: newContent,
        updated_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
      })
      .eq('user_id', this.userId)
      .eq('path', normalizedPath)

    if (updateError) {
      return { success: false, content: '', error: `Database error: ${updateError.message}` }
    }

    return { success: true, content: `Replaced text in: ${normalizedPath}` }
  }

  /**
   * INSERT command - insert text at a specific line
   */
  private async insert(path: string, insertLine: number, insertText: string): Promise<MemoryToolResult> {
    const validation = validatePath(path)
    if (!validation.valid) {
      return { success: false, content: '', error: validation.error }
    }

    const normalizedPath = validation.normalized

    // Get current content
    const { data, error: fetchError } = await this.supabase
      .from('memories')
      .select('content')
      .eq('user_id', this.userId)
      .eq('path', normalizedPath)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { success: false, content: '', error: `File not found: ${normalizedPath}` }
      }
      return { success: false, content: '', error: `Database error: ${fetchError.message}` }
    }

    const content = data.content || ''
    const lines = content.split('\n')

    // Validate line number (1-indexed)
    if (insertLine < 1) {
      return { success: false, content: '', error: 'Line number must be >= 1' }
    }

    // Insert at the specified line (or at end if beyond file length)
    const insertIdx = Math.min(insertLine - 1, lines.length)
    lines.splice(insertIdx, 0, insertText)

    const newContent = lines.join('\n')

    // Check new file size
    const newSizeBytes = new TextEncoder().encode(newContent).length
    if (newSizeBytes > MAX_FILE_SIZE_BYTES) {
      return { 
        success: false, 
        content: '', 
        error: `Resulting file too large: ${newSizeBytes} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes` 
      }
    }

    // Update the file
    const { error: updateError } = await this.supabase
      .from('memories')
      .update({
        content: newContent,
        updated_at: new Date().toISOString(),
        accessed_at: new Date().toISOString(),
      })
      .eq('user_id', this.userId)
      .eq('path', normalizedPath)

    if (updateError) {
      return { success: false, content: '', error: `Database error: ${updateError.message}` }
    }

    return { success: true, content: `Inserted text at line ${insertLine} in: ${normalizedPath}` }
  }

  /**
   * DELETE command - delete a file or directory
   */
  private async deleteFile(path: string): Promise<MemoryToolResult> {
    const validation = validatePath(path)
    if (!validation.valid) {
      return { success: false, content: '', error: validation.error }
    }

    const normalizedPath = validation.normalized

    // Prevent deleting root
    if (normalizedPath === MEMORIES_PREFIX) {
      return { success: false, content: '', error: 'Cannot delete root memories directory' }
    }

    // Delete the file (or files if it's a directory pattern)
    const { data, error } = await this.supabase
      .from('memories')
      .delete()
      .eq('user_id', this.userId)
      .or(`path.eq.${normalizedPath},path.like.${normalizedPath}/%`)
      .select('path')

    if (error) {
      return { success: false, content: '', error: `Database error: ${error.message}` }
    }

    if (!data || data.length === 0) {
      return { success: false, content: '', error: `File or directory not found: ${normalizedPath}` }
    }

    const deletedCount = data.length
    return { 
      success: true, 
      content: deletedCount === 1 
        ? `Deleted: ${normalizedPath}` 
        : `Deleted ${deletedCount} files from: ${normalizedPath}`
    }
  }

  /**
   * RENAME command - rename or move a file/directory
   */
  private async rename(oldPath: string, newPath: string): Promise<MemoryToolResult> {
    const oldValidation = validatePath(oldPath)
    if (!oldValidation.valid) {
      return { success: false, content: '', error: `Invalid old path: ${oldValidation.error}` }
    }

    const newValidation = validatePath(newPath)
    if (!newValidation.valid) {
      return { success: false, content: '', error: `Invalid new path: ${newValidation.error}` }
    }

    const normalizedOld = oldValidation.normalized
    const normalizedNew = newValidation.normalized

    // Prevent renaming root
    if (normalizedOld === MEMORIES_PREFIX) {
      return { success: false, content: '', error: 'Cannot rename root memories directory' }
    }

    // Check if old path exists
    const { data: existingFiles, error: fetchError } = await this.supabase
      .from('memories')
      .select('path, content')
      .eq('user_id', this.userId)
      .or(`path.eq.${normalizedOld},path.like.${normalizedOld}/%`)

    if (fetchError) {
      return { success: false, content: '', error: `Database error: ${fetchError.message}` }
    }

    if (!existingFiles || existingFiles.length === 0) {
      return { success: false, content: '', error: `File or directory not found: ${normalizedOld}` }
    }

    // Check if target already exists
    const { data: targetExists } = await this.supabase
      .from('memories')
      .select('path')
      .eq('user_id', this.userId)
      .eq('path', normalizedNew)
      .single()

    if (targetExists) {
      return { success: false, content: '', error: `Target already exists: ${normalizedNew}` }
    }

    // Rename all matching files
    for (const file of existingFiles) {
      const newFilePath = file.path.replace(normalizedOld, normalizedNew)
      
      const { error: updateError } = await this.supabase
        .from('memories')
        .update({
          path: newFilePath,
          updated_at: new Date().toISOString(),
          accessed_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId)
        .eq('path', file.path)

      if (updateError) {
        return { success: false, content: '', error: `Database error renaming ${file.path}: ${updateError.message}` }
      }
    }

    const renamedCount = existingFiles.length
    return { 
      success: true, 
      content: renamedCount === 1 
        ? `Renamed: ${normalizedOld} -> ${normalizedNew}` 
        : `Renamed ${renamedCount} files from ${normalizedOld} to ${normalizedNew}`
    }
  }

  /**
   * Check if adding a file would exceed total storage limit
   */
  private async checkTotalStorageLimit(
    newFileSizeBytes: number, 
    excludePath?: string
  ): Promise<{ allowed: boolean; error?: string }> {
    // Get current total size
    const { data, error } = await this.supabase
      .from('memories')
      .select('size_bytes')
      .eq('user_id', this.userId)
      .neq('path', excludePath || '')

    if (error) {
      return { allowed: false, error: `Database error: ${error.message}` }
    }

    const currentTotal = (data || []).reduce((sum, row) => sum + (row.size_bytes || 0), 0)
    const newTotal = currentTotal + newFileSizeBytes

    if (newTotal > MAX_TOTAL_SIZE_BYTES) {
      return { 
        allowed: false, 
        error: `Total storage limit exceeded: ${newTotal} bytes would exceed limit of ${MAX_TOTAL_SIZE_BYTES} bytes. Delete some files first.` 
      }
    }

    return { allowed: true }
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create a memory tool handler for a user
 */
export function createMemoryToolHandler(
  supabase: SupabaseClient, 
  userId: string
): MemoryToolHandler {
  return new MemoryToolHandler(supabase, userId)
}

