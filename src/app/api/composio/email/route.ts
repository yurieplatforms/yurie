/**
 * Composio Email API Route
 *
 * Send and manage emails using the Composio Gmail integration.
 *
 * POST /api/composio/email
 * Body: { userId: string, task: string, tools?: string[] }
 * Returns: { success: boolean, output?: any, error?: string }
 *
 * @see https://docs.composio.dev/docs/executing-tools
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  runEmailAgent,
  isUserConnected,
  GmailTools,
  type GmailToolName,
} from '@/lib/ai/integrations/composio'

/**
 * Tool name mapping for cleaner API
 */
const TOOL_ALIASES: Record<string, GmailToolName> = {
  send: GmailTools.SEND_EMAIL,
  fetch: GmailTools.FETCH_EMAILS,
  read: GmailTools.GET_EMAIL,
  draft: GmailTools.CREATE_DRAFT,
  search: GmailTools.SEARCH_EMAILS,
  reply: GmailTools.REPLY_TO_EMAIL,
  forward: GmailTools.FORWARD_EMAIL,
  archive: GmailTools.ARCHIVE_EMAIL,
  trash: GmailTools.TRASH_EMAIL,
}

/**
 * Execute an email task using the AI agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, task, tools } = body as {
      userId?: string
      task?: string
      tools?: string[]
    }

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        {
          error: 'userId is required',
          code: 'MISSING_USER_ID',
        },
        { status: 400 }
      )
    }

    if (!task || typeof task !== 'string' || task.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'task is required and must be a non-empty string',
          code: 'MISSING_TASK',
        },
        { status: 400 }
      )
    }

    // Check if user is connected to Gmail
    const connected = await isUserConnected(userId)

    if (!connected) {
      return NextResponse.json(
        {
          error: 'User is not connected to Gmail. Please connect first.',
          code: 'NOT_CONNECTED',
          requiresAuth: true,
        },
        { status: 403 }
      )
    }

    // Parse tool names (support aliases and full names)
    let toolNames: GmailToolName[] | undefined

    if (tools && Array.isArray(tools)) {
      toolNames = tools
        .map((t) => {
          const alias = TOOL_ALIASES[t.toLowerCase()]
          if (alias) return alias
          // Check if it's already a valid tool name
          if (Object.values(GmailTools).includes(t as GmailToolName)) {
            return t as GmailToolName
          }
          return null
        })
        .filter((t): t is GmailToolName => t !== null)
    }

    // Run the email agent
    const result = await runEmailAgent(userId, task.trim(), {
      toolNames,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        output: result.output,
      })
    }

    // Handle agent errors
    return NextResponse.json(
      {
        success: false,
        error: result.error ?? 'Agent execution failed',
        code: 'AGENT_ERROR',
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('[api/composio/email] Error:', error)

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('rate limit')) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          code: 'RATE_LIMIT',
        },
        { status: 429 }
      )
    }

    if (errorMessage.includes('invalid_api_key')) {
      return NextResponse.json(
        {
          error: 'Invalid API configuration. Please contact support.',
          code: 'CONFIG_ERROR',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to process email request',
        code: 'INTERNAL_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * Get available email tools
 */
export async function GET() {
  return NextResponse.json({
    tools: Object.entries(GmailTools).map(([key, value]) => ({
      name: value,
      alias: key.toLowerCase(),
    })),
    aliases: TOOL_ALIASES,
  })
}


