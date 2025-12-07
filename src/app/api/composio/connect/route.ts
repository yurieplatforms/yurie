/**
 * Composio Connect API Route
 *
 * Initiates a connection request for a user to authenticate with external services via Composio.
 * Supports Gmail and Spotify.
 *
 * POST /api/composio/connect
 * Body: { userId: string, app?: 'gmail' | 'spotify', authConfigId?: string, forceReconnect?: boolean }
 * Returns: { redirectUrl: string, connectionId: string }
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connecting-an-account
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectUserAccount, getConnectedAccount, ConnectionStatuses, type ComposioApp } from '@/lib/ai/integrations/composio'

/**
 * Initiate a connection for a user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, app = 'gmail', authConfigId, forceReconnect } = body as {
      userId?: string
      app?: ComposioApp
      authConfigId?: string
      forceReconnect?: boolean
    }

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

    // Check if user already has an active connection for this app
    if (!forceReconnect) {
      const existingAccount = await getConnectedAccount(userId, { app })

      if (existingAccount?.status === ConnectionStatuses.ACTIVE) {
        return NextResponse.json({
          alreadyConnected: true,
          accountId: existingAccount.id,
          app,
          message: `User already has an active ${app} connection`,
        })
      }
    }

    // Create a new connection request
    const connectionRequest = await connectUserAccount(userId, { app, authConfigId })

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
      app,
      message: 'Redirect user to the provided URL to complete authentication',
    })
  } catch (error) {
    console.error('[api/composio/connect] Error:', error)

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('AUTH_CONFIG_ID')) {
      return NextResponse.json(
        {
          error: 'Composio auth config is not configured. Please contact support.',
          code: 'CONFIG_ERROR',
        },
        { status: 500 }
      )
    }

    if (errorMessage.includes('COMPOSIO_API_KEY')) {
      return NextResponse.json(
        {
          error: 'Composio API is not configured. Please contact support.',
          code: 'CONFIG_ERROR',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to initiate connection',
        code: 'CONNECTION_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
