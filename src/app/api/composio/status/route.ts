/**
 * Composio Status API Route
 *
 * Check if a user has an active Composio connection for a specific app.
 * Supports Gmail and Spotify.
 *
 * GET /api/composio/status?userId=xxx&app=gmail
 * Returns: { connected: boolean, accountId?: string, status?: string, app: string }
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#checking-connection-status
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getConnectedAccount,
  listConnectedAccounts,
  ConnectionStatuses,
  type ComposioApp,
} from '@/lib/ai/integrations/composio'

/**
 * Check connection status for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const app = (searchParams.get('app') || 'gmail') as ComposioApp
    const includeInactive = searchParams.get('includeInactive') === 'true'

    if (!userId) {
      return NextResponse.json(
        {
          error: 'userId query parameter is required',
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

    // Get connection with ACTIVE status filter by default
    const account = await getConnectedAccount(userId, {
      app,
      includeInactive,
    })

    if (account) {
      // Only return connected=true for ACTIVE status
      const isActive = account.status === ConnectionStatuses.ACTIVE

      return NextResponse.json({
        connected: isActive,
        accountId: account.id,
        status: account.status,
        app,
        ...(account.createdAt && { createdAt: account.createdAt }),
        ...(account.updatedAt && { updatedAt: account.updatedAt }),
      })
    }

    // Check if there are any non-active connections for this app
    if (!includeInactive) {
      const allAccounts = await listConnectedAccounts(userId, { app })

      if (allAccounts.length > 0) {
        // User has connections but none are active
        const latestAccount = allAccounts[0]
        return NextResponse.json({
          connected: false,
          status: latestAccount.status,
          app,
          message: getStatusMessage(latestAccount.status, app),
          requiresReauth: ['FAILED', 'EXPIRED'].includes(latestAccount.status),
        })
      }
    }

    return NextResponse.json({
      connected: false,
      app,
      message: `No ${app} connection found for this user`,
    })
  } catch (error) {
    console.error('[api/composio/status] Error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to check connection status',
        code: 'CHECK_STATUS_ERROR',
      },
      { status: 500 }
    )
  }
}

/**
 * Get a human-readable message for connection status
 */
function getStatusMessage(status: string, app: string): string {
  const appName = app.charAt(0).toUpperCase() + app.slice(1)
  switch (status) {
    case 'ACTIVE':
      return `${appName} connection is active and ready`
    case 'INITIATED':
      return `${appName} connection started but not completed. Please complete the authorization.`
    case 'PROCESSING':
      return `${appName} connection is being processed. Please wait.`
    case 'FAILED':
      return `${appName} connection failed. Please reconnect your account.`
    case 'EXPIRED':
      return `${appName} connection has expired. Please reconnect your account.`
    default:
      return `${appName} connection status: ${status}`
  }
}
