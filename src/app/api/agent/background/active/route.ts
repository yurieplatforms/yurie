/**
 * Active Background Tasks API
 * 
 * Returns all active (non-terminal) background tasks for the current user.
 * Used by the frontend to detect and resume tasks after page refresh.
 * 
 * Reference: https://platform.openai.com/docs/guides/background
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOpenAIClient, generateRequestId } from '@/lib/ai/api/openai'
import { 
  getActiveBackgroundTasks, 
  updateBackgroundTaskStatus,
  isTerminalTaskStatus,
} from '@/lib/ai/api/background-tasks'
import { env } from '@/lib/config/env'
import type { 
  ActiveBackgroundTasksResponse,
  BackgroundResponseStatus,
} from '@/lib/ai/api/types'

export async function GET() {
  const requestId = generateRequestId()

  // Verify user authentication
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required', requestId },
        { status: 401 },
      )
    }

    // Get active tasks from database
    const tasks = await getActiveBackgroundTasks(supabase, userId)

    // If we have tasks, verify their status with OpenAI and update if needed
    const apiKey = env.OPENAI_API_KEY
    if (apiKey && tasks.length > 0) {
      const openai = createOpenAIClient({ apiKey, timeout: 30000 })

      // Check each task's actual status with OpenAI
      const verifiedTasks = await Promise.all(
        tasks.map(async (task) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await (openai.responses as any).retrieve(task.responseId)
            const actualStatus = response.status as BackgroundResponseStatus

            // Update database if status changed
            if (actualStatus !== task.status) {
              await updateBackgroundTaskStatus(
                supabase,
                task.responseId,
                actualStatus,
                response.output_text
              )
              task.status = actualStatus
              if (response.output_text) {
                task.partialOutput = response.output_text
              }
            }

            // Only return non-terminal tasks
            if (!isTerminalTaskStatus(actualStatus)) {
              return task
            }
            return null
          } catch (error) {
            console.error(`[background/active] Failed to verify task ${task.responseId}:`, error)
            // If we can't verify, assume it's still active
            return task
          }
        })
      )

      // Filter out null (terminal) tasks
      const activeTasks = verifiedTasks.filter((t): t is NonNullable<typeof t> => t !== null)

      const response: ActiveBackgroundTasksResponse = {
        tasks: activeTasks,
      }

      console.log(`[background/active] Found ${activeTasks.length} active tasks for user ${userId}`)
      return NextResponse.json(response)
    }

    const response: ActiveBackgroundTasksResponse = {
      tasks,
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[background/active] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get active tasks',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
