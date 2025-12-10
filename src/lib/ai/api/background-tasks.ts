/**
 * Background Task Persistence Module
 * 
 * Handles database persistence for background AI tasks.
 * This allows tasks to survive page refreshes and server restarts.
 * 
 * Reference: https://platform.openai.com/docs/guides/background
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { 
  PersistedBackgroundTask, 
  BackgroundResponseStatus,
} from './types'

// =============================================================================
// Database Row Type
// =============================================================================

interface BackgroundTaskRow {
  id: string
  user_id: string
  chat_id: string
  message_id: string
  response_id: string
  status: string
  sequence_number: number
  task_type: string
  partial_output: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// Row to Type Conversion
// =============================================================================

function rowToTask(row: BackgroundTaskRow): PersistedBackgroundTask {
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    messageId: row.message_id,
    responseId: row.response_id,
    status: row.status as BackgroundResponseStatus,
    sequenceNumber: row.sequence_number,
    taskType: row.task_type as 'agent' | 'research',
    partialOutput: row.partial_output ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new background task
 */
export async function createBackgroundTask(
  supabase: SupabaseClient,
  task: {
    userId: string
    chatId: string
    messageId: string
    responseId: string
    taskType: 'agent' | 'research'
  }
): Promise<PersistedBackgroundTask | null> {
  const { data, error } = await supabase
    .from('background_tasks')
    .insert({
      user_id: task.userId,
      chat_id: task.chatId,
      message_id: task.messageId,
      response_id: task.responseId,
      task_type: task.taskType,
      status: 'in_progress',
      sequence_number: 0,
    })
    .select()
    .single()

  if (error) {
    console.error('[background-tasks] Failed to create task:', error)
    return null
  }

  return rowToTask(data as BackgroundTaskRow)
}

/**
 * Get a background task by response ID
 */
export async function getBackgroundTaskByResponseId(
  supabase: SupabaseClient,
  responseId: string
): Promise<PersistedBackgroundTask | null> {
  const { data, error } = await supabase
    .from('background_tasks')
    .select('*')
    .eq('response_id', responseId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is expected
      console.error('[background-tasks] Failed to get task:', error)
    }
    return null
  }

  return rowToTask(data as BackgroundTaskRow)
}

/**
 * Get all active background tasks for a user
 * Active = not in a terminal status (completed, failed, cancelled, incomplete)
 */
export async function getActiveBackgroundTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<PersistedBackgroundTask[]> {
  const { data, error } = await supabase
    .from('background_tasks')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['queued', 'in_progress'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[background-tasks] Failed to get active tasks:', error)
    return []
  }

  return (data as BackgroundTaskRow[]).map(rowToTask)
}

/**
 * Get all background tasks for a specific chat
 */
export async function getBackgroundTasksForChat(
  supabase: SupabaseClient,
  chatId: string
): Promise<PersistedBackgroundTask[]> {
  const { data, error } = await supabase
    .from('background_tasks')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[background-tasks] Failed to get tasks for chat:', error)
    return []
  }

  return (data as BackgroundTaskRow[]).map(rowToTask)
}

/**
 * Update a background task's status
 */
export async function updateBackgroundTaskStatus(
  supabase: SupabaseClient,
  responseId: string,
  status: BackgroundResponseStatus,
  partialOutput?: string
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (partialOutput !== undefined) {
    updateData.partial_output = partialOutput
  }

  const { error } = await supabase
    .from('background_tasks')
    .update(updateData)
    .eq('response_id', responseId)

  if (error) {
    console.error('[background-tasks] Failed to update task status:', error)
    return false
  }

  return true
}

/**
 * Update a background task's sequence number
 */
export async function updateBackgroundTaskSequence(
  supabase: SupabaseClient,
  responseId: string,
  sequenceNumber: number
): Promise<boolean> {
  const { error } = await supabase
    .from('background_tasks')
    .update({
      sequence_number: sequenceNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('response_id', responseId)

  if (error) {
    console.error('[background-tasks] Failed to update task sequence:', error)
    return false
  }

  return true
}

/**
 * Delete a background task
 */
export async function deleteBackgroundTask(
  supabase: SupabaseClient,
  responseId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('background_tasks')
    .delete()
    .eq('response_id', responseId)

  if (error) {
    console.error('[background-tasks] Failed to delete task:', error)
    return false
  }

  return true
}

/**
 * Clean up old completed/failed tasks (older than 1 hour)
 */
export async function cleanupOldTasks(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('background_tasks')
    .delete()
    .eq('user_id', userId)
    .in('status', ['completed', 'failed', 'cancelled', 'incomplete'])
    .lt('updated_at', oneHourAgo)
    .select()

  if (error) {
    console.error('[background-tasks] Failed to cleanup old tasks:', error)
    return 0
  }

  return data?.length ?? 0
}

/**
 * Check if a task status is terminal (no longer in progress)
 */
export function isTerminalTaskStatus(status: BackgroundResponseStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'incomplete'].includes(status)
}
