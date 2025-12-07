/**
 * Composio Authentication Utilities
 *
 * Handles user authentication flows for connecting external accounts
 * (e.g., Gmail, Spotify) via Composio's OAuth integration.
 *
 * @see https://docs.composio.dev/docs/authenticating-tools
 */

import { getComposioClient } from './client'
import { env } from '@/lib/config/env'
import type { ConnectionStatus, ConnectedAccount, ConnectionRequest } from './types'

export type { ConnectionRequest, ConnectedAccount }

/**
 * Supported app types for Composio integration
 */
export type ComposioApp = 'gmail' | 'spotify'

/**
 * Get the auth config ID for a specific app
 */
export function getAuthConfigId(app: ComposioApp): string | undefined {
  switch (app) {
    case 'gmail':
      return env.COMPOSIO_AUTH_CONFIG_ID
    case 'spotify':
      return env.COMPOSIO_SPOTIFY_AUTH_CONFIG_ID
    default:
      return undefined
  }
}

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
 * @param options - Connection options including app type or custom auth config ID
 * @returns Connection request with redirect URL and wait function
 *
 * @example
 * // Connect Gmail (default)
 * const request = await connectUserAccount('user-123')
 * 
 * @example
 * // Connect Spotify
 * const request = await connectUserAccount('user-123', { app: 'spotify' })
 * 
 * @example
 * // Use custom auth config ID
 * const request = await connectUserAccount('user-123', { authConfigId: 'ac_custom' })
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connecting-an-account
 */
export async function connectUserAccount(
  externalUserId: string,
  options?: { app?: ComposioApp; authConfigId?: string }
): Promise<ConnectionRequest> {
  const composio = getComposioClient()
  
  // Determine the app type (defaults to gmail for backwards compatibility)
  const app = options?.app ?? 'gmail'
  
  // Determine the config ID: explicit authConfigId > app-based config
  let configId = options?.authConfigId
  if (!configId) {
    configId = getAuthConfigId(app)
  }

  if (!configId) {
    const envVarName = app === 'gmail' 
      ? 'COMPOSIO_AUTH_CONFIG_ID' 
      : `COMPOSIO_${app.toUpperCase()}_AUTH_CONFIG_ID`
    throw new Error(
      `Auth config ID for ${app} is not set. Please add ${envVarName} to your environment variables.`
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
 * @example
 * // Get Gmail connection (default)
 * const account = await getConnectedAccount('user-123')
 * 
 * @example
 * // Get Spotify connection
 * const account = await getConnectedAccount('user-123', { app: 'spotify' })
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#checking-connection-status
 */
export async function getConnectedAccount(
  externalUserId: string,
  options?: {
    /** Filter by specific app type */
    app?: ComposioApp
    /** Filter by specific auth config ID (overrides app) */
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

    // Determine auth config ID: explicit > app-based
    let authConfigId = options?.authConfigId
    if (!authConfigId && options?.app) {
      authConfigId = getAuthConfigId(options.app)
    }
    
    // Add auth config filter if we have one
    if (authConfigId) {
      listOptions.authConfigIds = [authConfigId]
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
    /** Filter by specific app type */
    app?: ComposioApp
    /** Filter by specific auth config IDs */
    authConfigIds?: string[]
    /** Filter by specific statuses */
    statuses?: ConnectionStatus[]
  }
): Promise<ConnectedAccount[]> {
  try {
    const composio = getComposioClient()

    // Build auth config IDs list
    let authConfigIds = options?.authConfigIds
    if (!authConfigIds && options?.app) {
      const configId = getAuthConfigId(options.app)
      if (configId) {
        authConfigIds = [configId]
      }
    }

    const response = await composio.connectedAccounts.list({
      userIds: [externalUserId],
      ...(authConfigIds && { authConfigIds }),
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
 * @param app - Optional app type to check (defaults to gmail)
 * @returns True if the user has an ACTIVE connection
 *
 * @example
 * // Check Gmail connection
 * const isGmailConnected = await isUserConnected('user-123')
 * 
 * @example
 * // Check Spotify connection
 * const isSpotifyConnected = await isUserConnected('user-123', 'spotify')
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connection-statuses
 */
export async function isUserConnected(externalUserId: string, app?: ComposioApp): Promise<boolean> {
  const account = await getConnectedAccount(externalUserId, { app })
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
