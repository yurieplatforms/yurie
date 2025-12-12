'use client'

/**
 * useBackgroundTasks Hook
 * 
 * Manages background AI tasks that persist across page refreshes.
 * Automatically detects and resumes active tasks when the component mounts.
 * 
 * @module hooks/useBackgroundTasks
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/providers/auth-provider'
import type { 
  PersistedBackgroundTask, 
  BackgroundResponseStatus 
} from '@/lib/ai/api/types'
import type { ChatMessage } from '@/lib/types'
import { parseSuggestions } from '@/lib/chat/suggestion-parser'

// -----------------------------------------------------------------------------
// Guest/local background task persistence (localStorage)
// -----------------------------------------------------------------------------

const LOCAL_BACKGROUND_TASKS_KEY = 'yurie-background-tasks'

type LocalBackgroundTaskRecord = {
  responseId: string
  chatId: string
  messageId: string
  status: BackgroundResponseStatus
  sequenceNumber: number
  taskType: 'agent' | 'research'
  partialOutput?: string
  createdAt: number
  updatedAt: number
}

function readLocalBackgroundTasks(): LocalBackgroundTaskRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_BACKGROUND_TASKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean) as LocalBackgroundTaskRecord[]
  } catch {
    return []
  }
}

function writeLocalBackgroundTasks(tasks: LocalBackgroundTaskRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_BACKGROUND_TASKS_KEY, JSON.stringify(tasks))
  } catch {
    // ignore
  }
}

export function upsertLocalBackgroundTask(input: {
  responseId: string
  chatId: string
  messageId: string
  status: BackgroundResponseStatus
  taskType?: 'agent' | 'research'
  partialOutput?: string
  sequenceNumber?: number
}): void {
  const now = Date.now()
  const existing = readLocalBackgroundTasks()
  const idx = existing.findIndex((t) => t.responseId === input.responseId)

  const nextRecord: LocalBackgroundTaskRecord = {
    responseId: input.responseId,
    chatId: input.chatId,
    messageId: input.messageId,
    status: input.status,
    sequenceNumber: input.sequenceNumber ?? (idx >= 0 ? existing[idx].sequenceNumber : 0),
    taskType: input.taskType ?? (idx >= 0 ? existing[idx].taskType : 'agent'),
    partialOutput:
      input.partialOutput !== undefined
        ? input.partialOutput
        : idx >= 0
          ? existing[idx].partialOutput
          : undefined,
    createdAt: idx >= 0 ? existing[idx].createdAt : now,
    updatedAt: now,
  }

  const next = idx >= 0
    ? [...existing.slice(0, idx), nextRecord, ...existing.slice(idx + 1)]
    : [nextRecord, ...existing]

  // Cleanup: drop stale entries (older than 30 minutes)
  const maxAgeMs = 30 * 60 * 1000
  const cleaned = next.filter((t) => now - t.createdAt <= maxAgeMs)

  writeLocalBackgroundTasks(cleaned)
}

export function removeLocalBackgroundTask(responseId: string): void {
  const existing = readLocalBackgroundTasks()
  const next = existing.filter((t) => t.responseId !== responseId)
  writeLocalBackgroundTasks(next)
}

function toPseudoPersistedTask(local: LocalBackgroundTaskRecord): PersistedBackgroundTask {
  // Shape it like a PersistedBackgroundTask so the rest of the hook can stay unchanged.
  return {
    id: `local_${local.responseId}`,
    userId: 'guest',
    chatId: local.chatId,
    messageId: local.messageId,
    responseId: local.responseId,
    status: local.status,
    sequenceNumber: local.sequenceNumber,
    taskType: local.taskType,
    partialOutput: local.partialOutput,
    createdAt: new Date(local.createdAt),
    updatedAt: new Date(local.updatedAt),
  }
}

/**
 * Active background task with resume capability
 */
export interface ActiveTask {
  /** The persisted task data */
  task: PersistedBackgroundTask
  /** Whether we're currently resuming this task */
  isResuming: boolean
}

/**
 * Return type for the useBackgroundTasks hook
 */
export interface UseBackgroundTasksReturn {
  /** Active background tasks for the current user */
  activeTasks: ActiveTask[]
  /** Whether we're loading active tasks */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Check for active tasks (called automatically on mount) */
  checkActiveTasks: () => Promise<void>
  /** Resume a specific background task */
  resumeTask: (
    task: PersistedBackgroundTask,
    onUpdate: (content: string, status: BackgroundResponseStatus) => void,
    onComplete: (finalContent: string) => void,
    onError: (error: string) => void
  ) => Promise<void>
  /** Cancel a background task */
  cancelTask: (responseId: string) => Promise<boolean>
  /** Get active task for a specific chat */
  getActiveTaskForChat: (chatId: string) => ActiveTask | undefined
}

/**
 * Hook for managing background AI tasks
 * 
 * Automatically checks for active background tasks on mount and provides
 * methods to resume or cancel them.
 */
export function useBackgroundTasks(): UseBackgroundTasksReturn {
  const { user } = useAuth()
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Check for active background tasks
   */
  const checkActiveTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Authenticated: use server+DB persistence
      if (user) {
        const response = await fetch('/api/agent/background/active')
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to check active tasks')
        }

        const data = await response.json()
        const tasks = (data.tasks || []).map((task: PersistedBackgroundTask) => ({
          task,
          isResuming: false,
        }))

        // If server-side persistence is working, prefer it.
        // Otherwise (e.g. missing `background_tasks` table), fall back to local tracking.
        if (tasks.length > 0) {
          setActiveTasks(tasks)
          console.log(`[useBackgroundTasks] Found ${tasks.length} background task(s)`)
          return
        }
      }

      // Guest: use localStorage persistence + status polling
      const local = readLocalBackgroundTasks()
      if (local.length === 0) {
        setActiveTasks([])
        return
      }

      const updated: LocalBackgroundTaskRecord[] = []

      for (const task of local) {
        // Only poll tasks that are potentially still running
        if (task.status !== 'queued' && task.status !== 'in_progress') {
          updated.push(task)
          continue
        }

        try {
          const res = await fetch('/api/agent/background/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ responseId: task.responseId }),
          })

          if (!res.ok) {
            updated.push(task)
            continue
          }

          const data = (await res.json()) as {
            status?: BackgroundResponseStatus
            outputText?: string
          }

          const nextStatus = data.status ?? task.status
          const isTerminal =
            nextStatus === 'completed' ||
            nextStatus === 'failed' ||
            nextStatus === 'cancelled' ||
            nextStatus === 'incomplete'
          const nextPartial = isTerminal ? (data.outputText ?? task.partialOutput) : task.partialOutput

          const nextTask: LocalBackgroundTaskRecord = {
            ...task,
            status: nextStatus,
            partialOutput: nextPartial,
            updatedAt: Date.now(),
          }

          // Persist latest status/output locally
          upsertLocalBackgroundTask({
            responseId: nextTask.responseId,
            chatId: nextTask.chatId,
            messageId: nextTask.messageId,
            status: nextTask.status,
            taskType: nextTask.taskType,
            partialOutput: nextTask.partialOutput,
            sequenceNumber: nextTask.sequenceNumber,
          })

          updated.push(nextTask)
        } catch {
          updated.push(task)
        }
      }

      setActiveTasks(
        updated.map((t) => ({
          task: toPseudoPersistedTask(t),
          isResuming: false,
        })),
      )
    } catch (err) {
      console.error('[useBackgroundTasks] Error checking active tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to check active tasks')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  /**
   * Resume a background task
   */
  const resumeTask = useCallback(async (
    task: PersistedBackgroundTask,
    onUpdate: (content: string, status: BackgroundResponseStatus) => void,
    onComplete: (finalContent: string) => void,
    onError: (error: string) => void
  ) => {
    // Mark task as resuming
    setActiveTasks((prev) =>
      prev.map((t) =>
        t.task.responseId === task.responseId
          ? { ...t, isResuming: true }
          : t
      )
    )

    // Cancel any existing resume request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/agent/background/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId: task.responseId,
          startingAfter: task.sequenceNumber,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error('Failed to resume background task')
      }

      // Process the stream
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let accumulatedContent = task.partialOutput || ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith('data:')) continue

          const dataPart = trimmedLine.slice('data:'.length).trim()
          if (dataPart === '' || dataPart === '[DONE]') {
            // Stream complete
            onComplete(accumulatedContent)
            
            // Remove from active tasks
            setActiveTasks((prev) =>
              prev.filter((t) => t.task.responseId !== task.responseId)
            )
            return
          }

          try {
            const json = JSON.parse(dataPart)

            // Handle error events
            if (json.error) {
              onError(json.error.message || 'Background task failed')
              setActiveTasks((prev) =>
                prev.filter((t) => t.task.responseId !== task.responseId)
              )
              return
            }

            // Handle background status updates
            if (json.background) {
              const status = json.background.status as BackgroundResponseStatus
              onUpdate(accumulatedContent, status)
              // Do not early-complete on terminal status.
              // Some servers send final output after the terminal status event.
              continue
            }

            // Handle content updates
            const choice = json.choices?.[0]
            const deltaContent = choice?.delta?.content ?? choice?.message?.content ?? ''
            
            if (typeof deltaContent === 'string' && deltaContent.length > 0) {
              // The resume endpoint may send the full `output_text` as a single chunk.
              // If so, prefer replacing rather than appending to avoid duplication.
              if (
                accumulatedContent.length > 0 &&
                deltaContent.length >= accumulatedContent.length &&
                deltaContent.startsWith(accumulatedContent)
              ) {
                accumulatedContent = deltaContent
              } else {
                accumulatedContent += deltaContent
              }
              onUpdate(accumulatedContent, 'in_progress')
            }
          } catch {
            // Ignore malformed chunks
          }
        }
      }

      // Stream ended without explicit [DONE]
      onComplete(accumulatedContent)
      setActiveTasks((prev) =>
        prev.filter((t) => t.task.responseId !== task.responseId)
      )

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }
      
      console.error('[useBackgroundTasks] Error resuming task:', err)
      onError(err instanceof Error ? err.message : 'Failed to resume task')
      
      // Mark task as no longer resuming
      setActiveTasks((prev) =>
        prev.map((t) =>
          t.task.responseId === task.responseId
            ? { ...t, isResuming: false }
            : t
        )
      )
    }
  }, [])

  /**
   * Cancel a background task
   */
  const cancelTask = useCallback(async (responseId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/agent/background/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel task')
      }

      // Remove from active tasks
      setActiveTasks((prev) =>
        prev.filter((t) => t.task.responseId !== responseId)
      )

      return true
    } catch (err) {
      console.error('[useBackgroundTasks] Error cancelling task:', err)
      return false
    }
  }, [])

  /**
   * Get active task for a specific chat
   */
  const getActiveTaskForChat = useCallback((chatId: string): ActiveTask | undefined => {
    return activeTasks.find((t) => t.task.chatId === chatId)
  }, [activeTasks])

  // Check for active tasks on mount
  useEffect(() => {
    checkActiveTasks()
  }, [user, checkActiveTasks])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    activeTasks,
    isLoading,
    error,
    checkActiveTasks,
    resumeTask,
    cancelTask,
    getActiveTaskForChat,
  }
}

/**
 * Build a message update from resumed background task content
 */
export function buildMessageFromResumedContent(
  baseMessage: ChatMessage,
  content: string
): ChatMessage {
  const { content: parsedContent, suggestions } = parseSuggestions(content)
  
  return {
    ...baseMessage,
    content: parsedContent,
    suggestions,
  }
}


