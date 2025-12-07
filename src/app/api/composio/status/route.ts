/**
 * Composio Status API Route
 *
 * Check if a user has an active Composio connection.
 *
 * GET /api/composio/status?userId=xxx
 * Returns: { connected: boolean, accountId?: string, status?: string }
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#checking-connection-status
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getConnectedAccount,
  listConnectedAccounts,
  ConnectionStatuses,
} from '@/lib/ai/integrations/composio'

/**
 * Check connection status for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
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

    // Get connection with ACTIVE status filter by default
    const account = await getConnectedAccount(userId, {
      includeInactive,
    })

    if (account) {
      // Only return connected=true for ACTIVE status
      const isActive = account.status === ConnectionStatuses.ACTIVE

      return NextResponse.json({
        connected: isActive,
        accountId: account.id,
        status: account.status,
        ...(account.createdAt && { createdAt: account.createdAt }),
        ...(account.updatedAt && { updatedAt: account.updatedAt }),
      })
    }

    // Check if there are any non-active connections
    if (!includeInactive) {
      const allAccounts = await listConnectedAccounts(userId)

      if (allAccounts.length > 0) {
        // User has connections but none are active
        const latestAccount = allAccounts[0]
        return NextResponse.json({
          connected: false,
          status: latestAccount.status,
          message: getStatusMessage(latestAccount.status),
          requiresReauth: ['FAILED', 'EXPIRED'].includes(latestAccount.status),
        })
      }
    }

    return NextResponse.json({
      connected: false,
      message: 'No connection found for this user',
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
function getStatusMessage(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Connection is active and ready'
    case 'INITIATED':
      return 'Connection started but not completed. Please complete the authorization.'
    case 'PROCESSING':
      return 'Connection is being processed. Please wait.'
    case 'FAILED':
      return 'Connection failed. Please reconnect your account.'
    case 'EXPIRED':
      return 'Connection has expired. Please reconnect your account.'
    default:
      return `Connection status: ${status}`
  }
}
