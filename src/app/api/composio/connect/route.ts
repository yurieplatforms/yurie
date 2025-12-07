/**
 * Composio Connect API Route
 *
 * Initiates a connection request for a user to authenticate with Gmail via Composio.
 *
 * POST /api/composio/connect
 * Body: { userId: string, authConfigId?: string }
 * Returns: { redirectUrl: string, connectionId: string }
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connecting-an-account
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectUserAccount, getConnectedAccount, ConnectionStatuses } from '@/lib/ai/integrations/composio'

/**
 * Initiate a connection for a user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, authConfigId, forceReconnect } = body as {
      userId?: string
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

    // Check if user already has an active connection
    if (!forceReconnect) {
      const existingAccount = await getConnectedAccount(userId)

      if (existingAccount?.status === ConnectionStatuses.ACTIVE) {
        return NextResponse.json({
          alreadyConnected: true,
          accountId: existingAccount.id,
          message: 'User already has an active connection',
        })
      }
    }

    // Create a new connection request
    const connectionRequest = await connectUserAccount(userId, authConfigId)

    return NextResponse.json({
      redirectUrl: connectionRequest.redirectUrl,
      connectionId: connectionRequest.id,
      message: 'Redirect user to the provided URL to complete authentication',
    })
  } catch (error) {
    console.error('[api/composio/connect] Error:', error)

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('COMPOSIO_AUTH_CONFIG_ID')) {
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
