/**
 * Composio Disconnect API Route
 *
 * Disconnects a user's Gmail connection.
 *
 * POST /api/composio/disconnect
 * Body: { userId: string }
 * Returns: { success: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnectedAccount, disconnectAccount } from '@/lib/ai/integrations/composio'

/**
 * Disconnect a user's Gmail account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body as { userId?: string }

    if (!userId) {
      return NextResponse.json(
        {
          error: 'userId is required',
          code: 'MISSING_USER_ID',
        },
        { status: 400 }
      )
    }

    // Get the connected account to find its ID
    const account = await getConnectedAccount(userId, { includeInactive: true })

    if (!account) {
      return NextResponse.json(
        {
          error: 'No connection found for this user',
          code: 'NO_CONNECTION',
        },
        { status: 404 }
      )
    }

    // Disconnect the account
    const success = await disconnectAccount(account.id)

    if (!success) {
      return NextResponse.json(
        {
          error: 'Failed to disconnect account',
          code: 'DISCONNECT_ERROR',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account disconnected successfully',
    })
  } catch (error) {
    console.error('[api/composio/disconnect] Error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to disconnect account',
        code: 'DISCONNECT_ERROR',
      },
      { status: 500 }
    )
  }
}


