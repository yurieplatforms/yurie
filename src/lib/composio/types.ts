/**
 * Composio Type Definitions
 *
 * Centralized type definitions for Composio integration.
 * Based on https://docs.composio.dev/docs/quickstart
 */

/**
 * Connection status types from Composio API
 * Only ACTIVE connections can be used to execute tools
 *
 * @see https://docs.composio.dev/docs/authenticating-tools#connection-statuses
 */
export type ConnectionStatus =
  | 'INITIALIZING'
  | 'INITIATED'
  | 'ACTIVE'
  | 'FAILED'
  | 'EXPIRED'
  | 'INACTIVE'

/**
 * Connected account information
 */
export interface ConnectedAccount {
  /** Unique identifier for the connected account */
  id: string
  /** Current status of the connection */
  status: ConnectionStatus
  /** User ID associated with this connection */
  userId?: string
  /** Timestamp when the account was connected */
  createdAt?: string
  /** Timestamp when the account was last updated */
  updatedAt?: string
}

/**
 * Connection request returned when initiating OAuth flow
 */
export interface ConnectionRequest {
  /** Unique identifier for the connection request */
  id: string
  /** URL to redirect user for OAuth authentication */
  redirectUrl: string
  /**
   * Wait for the connection to be established
   * @param timeoutSeconds - Optional timeout in seconds (default: 60)
   */
  waitForConnection: (timeoutSeconds?: number) => Promise<ConnectedAccount>
}

/**
 * Tool definition from Composio
 * The actual tool type is determined by the provider
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComposioTool = any

/**
 * Tool fetching options
 *
 * @see https://docs.composio.dev/docs/fetching-tools
 */
export interface GetToolsOptions {
  /** Specific tool names to fetch */
  tools?: string[]
  /** Toolkit names to fetch tools from */
  toolkits?: string[]
  /** Maximum number of tools to return (default: 20) */
  limit?: number
  /** Filter by OAuth scopes */
  scopes?: string[]
  /** Semantic search query (experimental) */
  search?: string
}
