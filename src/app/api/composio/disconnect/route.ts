/**
 * Composio Disconnect API Route
 *
 * Disconnects a user's connection for a specific app.
 * Supports Gmail and Spotify.
 *
 * POST /api/composio/disconnect
 * Body: { userId: string, app?: 'gmail' | 'spotify' }
 * Returns: { success: boolean, app: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getConnectedAccount, disconnectAccount, type ComposioApp } from '@/lib/ai/integrations/composio'

/**
 * Disconnect a user's account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, app = 'gmail' } = body as { userId?: string; app?: ComposioApp }

    if (!userId) {
      return NextResponse.json(
        {
          error: 'userId is required',
          code: 'MISSING_USER_ID',
        },
        { status: 400 }
      )
    }

    // Validate app type
    if (app !== 'gmail' && app !== 'spotify') {
      return NextResponse.json(
        {
          error: 'Invalid app type. Must be "gmail" or "spotify"',
          code: 'INVALID_APP',
        },
        { status: 400 }
      )
    }

    // Get the connected account for this app to find its ID
    const account = await getConnectedAccount(userId, { app, includeInactive: true })

    if (!account) {
      return NextResponse.json(
        {
          error: `No ${app} connection found for this user`,
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
          error: `Failed to disconnect ${app} account`,
          code: 'DISCONNECT_ERROR',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      app,
      message: `${app.charAt(0).toUpperCase() + app.slice(1)} account disconnected successfully`,
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


