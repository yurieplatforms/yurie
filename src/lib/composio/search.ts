import { getComposioClient, COMPOSIO_DEFAULT_USER_ID } from './client'

/**
 * Get search tools from Composio.
 */
export async function getSearchTools(userId: string = COMPOSIO_DEFAULT_USER_ID) {
  const client = getComposioClient()
  if (!client) return []
  
  return await client.tools.get(userId, {
    toolkits: ['COMPOSIO_SEARCH']
  })
}

/**
 * Execute a search tool action.
 */
export async function executeSearchTool(
  action: string, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>, 
  userId: string = COMPOSIO_DEFAULT_USER_ID
) {
  const client = getComposioClient()
  if (!client) throw new Error("Composio not configured")

  // The Composio SDK execute method signature might vary slightly based on version,
  // but based on github.ts it accepts { userId, arguments, ... }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await client.tools.execute(action, {
    userId,
    arguments: args,
    dangerouslySkipVersionCheck: true
  } as any)
}

