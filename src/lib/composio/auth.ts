/**
 * Composio Authentication Utilities
 *
 * Handles user authentication flows for connecting external accounts
 * (e.g., Gmail) via Composio's OAuth integration.
 *
 * @see https://docs.composio.dev/docs/authenticating-tools
 */

import { getComposioClient } from './client'
import { env } from '@/lib/config/env'
import type { ConnectionStatus, ConnectedAccount, ConnectionRequest } from './types'

export type { ConnectionRequest, ConnectedAccount }

/**
 * Connection status constants matching Composio API
 * Only ACTIVE connections can be used to execute tools
 */
export const ConnectionStatuses = {
  /** Connection is being initialized */
  INITIALIZING: 'INITIALIZING',
  /** Connection was initiated but user hasn't completed auth */
  INITIATED: 'INITIATED',
  /** Connection is active and ready for tool execution */
  ACTIVE: 'ACTIVE',
  /** Connection failed - requires re-authentication */
  FAILED: 'FAILED',
  /** Connection expired - requires re-authentication */
  EXPIRED: 'EXPIRED',
  /** Connection is inactive */
  INACTIVE: 'INACTIVE',
} as const satisfies Record<string, ConnectionStatus>

/**
 * Initiate a connection request for a user to authenticate with an external service
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param authConfigId - Optional auth config ID (defaults to COMPOSIO_AUTH_CONFIG_ID env var)
 * @returns Connection request with redirect URL and wait function
 *
 * @example
 * const request = await connectUserAccount('user-123')
 * // Redirect user to: request.redirectUrl
 * const account = await request.waitForConnection()
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connecting-an-account
 */
export async function connectUserAccount(
  externalUserId: string,
  authConfigId?: string
): Promise<ConnectionRequest> {
  const composio = getComposioClient()
  const configId = authConfigId ?? env.COMPOSIO_AUTH_CONFIG_ID

  if (!configId) {
    throw new Error(
      'COMPOSIO_AUTH_CONFIG_ID is not set. Please add it to your environment variables or provide an authConfigId.'
    )
  }

  const connectionRequest = await composio.connectedAccounts.link(
    externalUserId,
    configId as string
  )

  if (!connectionRequest.redirectUrl) {
    throw new Error('Failed to get redirect URL from Composio')
  }

  return {
    id: connectionRequest.id,
    redirectUrl: connectionRequest.redirectUrl,
    waitForConnection: async (timeoutSeconds?: number): Promise<ConnectedAccount> => {
      try {
        const connectedAccount = await connectionRequest.waitForConnection(timeoutSeconds)
        return {
          id: connectedAccount.id,
          status: (connectedAccount.status as ConnectionStatus) ?? ConnectionStatuses.ACTIVE,
          userId: externalUserId,
          createdAt: connectedAccount.createdAt,
          updatedAt: connectedAccount.updatedAt,
        }
      } catch (error) {
        // Handle timeout or other errors
        throw new Error(
          `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  }
}

/**
 * Get an existing connected account for a user
 * Only returns accounts that are in ACTIVE status for tool execution
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param options - Optional filtering options
 * @returns Connected account info or null if not connected
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#checking-connection-status
 */
export async function getConnectedAccount(
  externalUserId: string,
  options?: {
    /** Filter by specific auth config ID */
    authConfigId?: string
    /** Include non-active connections (default: false) */
    includeInactive?: boolean
  }
): Promise<ConnectedAccount | null> {
  try {
    const composio = getComposioClient()

    // Build list options
    const listOptions: {
      userIds: string[]
      authConfigIds?: string[]
      statuses?: ConnectionStatus[]
    } = {
      userIds: [externalUserId],
    }

    // Add auth config filter if provided
    if (options?.authConfigId) {
      listOptions.authConfigIds = [options.authConfigId]
    }

    // Only return ACTIVE accounts unless explicitly including inactive
    if (!options?.includeInactive) {
      listOptions.statuses = [ConnectionStatuses.ACTIVE]
    }

    const response = await composio.connectedAccounts.list(listOptions)

    if (response && response.items && response.items.length > 0) {
      const account = response.items[0]
      return {
        id: account.id,
        status: (account.status as ConnectionStatus) ?? 'ACTIVE',
        userId: externalUserId,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }
    }

    return null
  } catch (error) {
    console.error('[composio/auth] Failed to get connected account:', error)
    return null
  }
}

/**
 * Get all connected accounts for a user
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @param options - Optional filtering options
 * @returns Array of connected accounts
 */
export async function listConnectedAccounts(
  externalUserId: string,
  options?: {
    /** Filter by specific auth config IDs */
    authConfigIds?: string[]
    /** Filter by specific statuses */
    statuses?: ConnectionStatus[]
  }
): Promise<ConnectedAccount[]> {
  try {
    const composio = getComposioClient()

    const response = await composio.connectedAccounts.list({
      userIds: [externalUserId],
      ...(options?.authConfigIds && { authConfigIds: options.authConfigIds }),
      ...(options?.statuses && { statuses: options.statuses }),
    })

    if (!response?.items) return []

    return response.items.map((account) => ({
      id: account.id,
      status: (account.status as ConnectionStatus) ?? 'ACTIVE',
      userId: externalUserId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }))
  } catch (error) {
    console.error('[composio/auth] Failed to list connected accounts:', error)
    return []
  }
}

/**
 * Check if a user has an active connection ready for tool execution
 *
 * @param externalUserId - Unique identifier for the user in your system
 * @returns True if the user has an ACTIVE connection
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connection-statuses
 */
export async function isUserConnected(externalUserId: string): Promise<boolean> {
  const account = await getConnectedAccount(externalUserId)
  // Only ACTIVE connections can execute tools
  return account !== null && account.status === ConnectionStatuses.ACTIVE
}

/**
 * Disconnect a user's account
 *
 * @param connectedAccountId - The connected account ID to disconnect
 * @returns True if disconnection was successful
 */
export async function disconnectAccount(connectedAccountId: string): Promise<boolean> {
  try {
    const composio = getComposioClient()
    await composio.connectedAccounts.delete(connectedAccountId)
    return true
  } catch (error) {
    console.error('[composio/auth] Failed to disconnect account:', error)
    return false
  }
}
