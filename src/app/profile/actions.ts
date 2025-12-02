'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getComposioClient } from '@/lib/composio'
import { headers } from 'next/headers'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const fullName = formData.get('fullName') as string
  const avatarUrl = formData.get('avatarUrl') as string
  const coverUrl = formData.get('coverUrl') as string
  const birthday = formData.get('birthday') as string
  const location = formData.get('location') as string
  const timezone = formData.get('timezone') as string

  const updates: { 
    full_name?: string
    avatar_url?: string
    cover_url?: string
    birthday?: string
    location?: string
    timezone?: string
  } = {}
  
  if (fullName) updates.full_name = fullName
  if (avatarUrl) updates.avatar_url = avatarUrl
  if (coverUrl !== null) updates.cover_url = coverUrl
  if (birthday !== null) updates.birthday = birthday
  if (location !== null) updates.location = location
  if (timezone !== null) updates.timezone = timezone

  const { error } = await supabase.auth.updateUser({
    data: updates,
  })

  if (error) {
    console.error('Profile update error:', error)
    return { error: error.message }
  }

  revalidatePath('/profile')
  return { success: true }
}

export async function initiateConnection(appName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const client = getComposioClient()
  if (!client) {
    return { error: 'Composio not configured' }
  }

  try {
    const headersList = await headers()
    const origin = headersList.get('origin') || 'http://localhost:3000'
    const toolkitName = appName.toUpperCase() // e.g., "github" -> "GITHUB"
    
    console.log(`[Composio] Initiating ${toolkitName} connection for user ${user.id}`)
    
    // Step 1: Find or create an auth config for the toolkit
    // @see https://docs.composio.dev/docs/authenticating-tools
    let authConfigId: string | undefined
    
    // List existing auth configs
    const authConfigs = await client.authConfigs.list({})
    
    // Find one matching this toolkit (checking various possible field names)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingConfig = authConfigs.items?.find((config: any) => {
      const appSlug = config.appName || config.provider || config.app || ''
      return appSlug.toUpperCase() === toolkitName
    })
    
    if (existingConfig) {
      authConfigId = existingConfig.id
      console.log('[Composio] Using existing auth config:', authConfigId)
    } else {
      // Create a new auth config using Composio managed auth
      console.log('[Composio] Creating new auth config for', toolkitName)
      const newConfig = await client.authConfigs.create(toolkitName, {
        type: 'use_composio_managed_auth',
        name: `${toolkitName} Auth Config`,
      })
      authConfigId = newConfig.id
      console.log('[Composio] Created auth config:', authConfigId)
    }
    
    // Step 2: Initiate the connection using the auth config
    // Use user.id as the entityId so we can filter connections later
    const connectionRequest = await client.connectedAccounts.initiate(
      user.id,
      authConfigId,
      {
        redirectUrl: `${origin}/profile`,
      }
    )
    
    console.log('[Composio] Connection request created:', connectionRequest.id)
    
    // Return the redirect URL for OAuth flow
    return { url: connectionRequest.redirectUrl }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Composio] Connection error:', errorMessage)
    return { error: `Failed to initiate connection: ${errorMessage}` }
  }
}

export interface ConnectionInfo {
  connected: boolean
  connectionId?: string
  accountName?: string
  metadata?: Record<string, unknown>
}

export async function checkConnectionStatus(appName: string): Promise<ConnectionInfo> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { connected: false }
  }

  const client = getComposioClient()
  if (!client) {
    return { connected: false }
  }

  try {
    const toolkitSlug = appName.toLowerCase() // toolkit.slug is lowercase
    
    // List connected accounts filtered by this user's entity ID
    // @see https://docs.composio.dev/docs/authenticating-tools
    const connections = await client.connectedAccounts.list({
      userIds: [user.id],
      statuses: ['ACTIVE'],
    })
    
    // Find a connection for this specific toolkit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchingConnection = connections.items?.find((conn: any) => {
      const connToolkitSlug = conn.toolkit?.slug || conn.appName?.toLowerCase() || ''
      return connToolkitSlug === toolkitSlug
    })
    
    if (matchingConnection) {
      console.log(`[Composio] ${appName} is connected (${matchingConnection.id})`)
      
      // Extract account info from the connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = (matchingConnection as any).metadata || {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountInfo = (matchingConnection as any).accountInfo || {}
      
      return { 
        connected: true,
        connectionId: matchingConnection.id,
        accountName: accountInfo?.login || accountInfo?.username || accountInfo?.name || metadata?.login,
        metadata: { ...metadata, ...accountInfo },
      }
    }
    
    return { connected: false }
  } catch (error) {
    console.error('[Composio] Status check error:', error)
    return { connected: false }
  }
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  private: boolean
  language: string | null
  stargazers_count: number
  updated_at: string
}

export async function getGitHubRepos(): Promise<{ repos?: GitHubRepo[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const client = getComposioClient()
  if (!client) {
    return { error: 'Composio not configured' }
  }

  try {
    // First, get the connected account ID for GitHub
    const connections = await client.connectedAccounts.list({
      userIds: [user.id],
      statuses: ['ACTIVE'],
    })
    
    // Find the GitHub connection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const githubConnection = connections.items?.find((conn: any) => {
      const connToolkitSlug = conn.toolkit?.slug || conn.appName?.toLowerCase() || ''
      return connToolkitSlug === 'github'
    })
    
    if (!githubConnection) {
      return { error: 'GitHub not connected' }
    }
    
    console.log('[Composio] Found GitHub connection:', githubConnection.id)
    
    // Execute the GitHub list repos action for the authenticated user
    // @see https://docs.composio.dev/docs/executing-tools
    // @see https://docs.composio.dev/docs/migration-guide/toolkit-versioning
    const result = await client.tools.execute('GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER', {
      userId: user.id,
      connectedAccountId: githubConnection.id,
      arguments: {
        per_page: 50,
        sort: 'updated',
      },
      // Skip version check for direct tool execution (toolkit versioning)
      dangerouslySkipVersionCheck: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    if (!result.successful) {
      console.error('[Composio] Failed to fetch repos:', result.error)
      return { error: result.error || 'Failed to fetch repositories' }
    }

    // The response data contains the list of repositories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any
    
    // Handle different response formats
    const repoList = Array.isArray(data) ? data : (data?.repositories || data?.items || [])
    
    const repos: GitHubRepo[] = repoList.map((repo: Record<string, unknown>) => ({
      id: repo.id as number,
      name: repo.name as string,
      full_name: repo.full_name as string,
      description: repo.description as string | null,
      html_url: repo.html_url as string,
      private: repo.private as boolean,
      language: repo.language as string | null,
      stargazers_count: repo.stargazers_count as number,
      updated_at: repo.updated_at as string,
    }))

    return { repos }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Composio] Get repos error:', errorMessage)
    return { error: `Failed to fetch repositories: ${errorMessage}` }
  }
}

export async function disconnectApp(appName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const client = getComposioClient()
  if (!client) {
    return { error: 'Composio not configured' }
  }

  try {
    const toolkitSlug = appName.toLowerCase()
    
    // List connected accounts for this user
    const connections = await client.connectedAccounts.list({
      userIds: [user.id],
      statuses: ['ACTIVE'],
    })
    
    // Find the connection for this toolkit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchingConnection = connections.items?.find((conn: any) => {
      const connToolkitSlug = conn.toolkit?.slug || conn.appName?.toLowerCase() || ''
      return connToolkitSlug === toolkitSlug
    })
    
    if (!matchingConnection) {
      return { error: 'No active connection found' }
    }
    
    console.log(`[Composio] Disconnecting ${appName} (${matchingConnection.id})`)
    
    // Delete the connected account
    // The SDK should have a delete method on connectedAccounts
    // @see https://docs.composio.dev/sdk-reference/type-script/models/connected-accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectedAccountsClient = client.connectedAccounts as any
    
    if (typeof connectedAccountsClient.delete === 'function') {
      await connectedAccountsClient.delete(matchingConnection.id)
    } else if (typeof connectedAccountsClient.remove === 'function') {
      await connectedAccountsClient.remove(matchingConnection.id)
    } else {
      // Try using fetch directly to the Composio API
      const apiKey = process.env.COMPOSIO_API_KEY
      const response = await fetch(`https://backend.composio.dev/api/v1/connectedAccounts/${matchingConnection.id}`, {
        method: 'DELETE',
        headers: {
          'X-API-KEY': apiKey || '',
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to disconnect: ${response.status} ${errorText}`)
      }
    }
    
    // Also clear the focused repo when disconnecting
    await clearFocusedRepo()
    
    console.log(`[Composio] Successfully disconnected ${appName}`)
    revalidatePath('/profile')
    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Composio] Disconnect error:', errorMessage)
    return { error: `Failed to disconnect: ${errorMessage}` }
  }
}

// ============================================================================
// Focused Repository Management
// ============================================================================

export interface FocusedRepo {
  owner: string
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  private: boolean
  language: string | null
  defaultBranch: string
}

/**
 * Set the focused GitHub repository for the AI agent context.
 * This repo will be used as the default context when using GitHub tools.
 */
export async function setFocusedRepo(repo: FocusedRepo): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      github_focused_repo: repo
    },
  })

  if (error) {
    console.error('[GitHub] Failed to set focused repo:', error)
    return { error: error.message }
  }

  console.log(`[GitHub] Set focused repo: ${repo.fullName}`)
  revalidatePath('/profile')
  return { success: true }
}

/**
 * Get the currently focused GitHub repository.
 */
export async function getFocusedRepo(): Promise<{ repo?: FocusedRepo; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const focusedRepo = user.user_metadata?.github_focused_repo as FocusedRepo | undefined
  return { repo: focusedRepo }
}

/**
 * Clear the focused GitHub repository.
 */
export async function clearFocusedRepo(): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      github_focused_repo: null
    },
  })

  if (error) {
    console.error('[GitHub] Failed to clear focused repo:', error)
    return { error: error.message }
  }

  console.log('[GitHub] Cleared focused repo')
  revalidatePath('/profile')
  return { success: true }
}

/**
 * Get detailed repository information including README and recent activity.
 * Used to build rich context for the AI agent.
 */
export async function getRepoContext(owner: string, repo: string): Promise<{
  repo?: Record<string, unknown>
  readme?: string
  recentIssues?: Record<string, unknown>[]
  recentPRs?: Record<string, unknown>[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'User not authenticated' }
  }

  const client = getComposioClient()
  if (!client) {
    return { error: 'Composio not configured' }
  }

  try {
    // Get the GitHub connection
    const connections = await client.connectedAccounts.list({
      userIds: [user.id],
      statuses: ['ACTIVE'],
    })
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const githubConnection = connections.items?.find((conn: any) => {
      const connToolkitSlug = conn.toolkit?.slug || conn.appName?.toLowerCase() || ''
      return connToolkitSlug === 'github'
    })
    
    if (!githubConnection) {
      return { error: 'GitHub not connected' }
    }

    // Execute multiple GitHub tools to get context
    const [repoResult, readmeResult, issuesResult, prsResult] = await Promise.all([
      // Get repo info
      client.tools.execute('GITHUB_GET_A_REPOSITORY', {
        userId: user.id,
        connectedAccountId: githubConnection.id,
        arguments: { owner, repo },
        dangerouslySkipVersionCheck: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
      
      // Get README
      client.tools.execute('GITHUB_GET_A_REPOSITORY_README', {
        userId: user.id,
        connectedAccountId: githubConnection.id,
        arguments: { owner, repo },
        dangerouslySkipVersionCheck: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => null),
      
      // Get recent issues
      client.tools.execute('GITHUB_LIST_REPOSITORY_ISSUES', {
        userId: user.id,
        connectedAccountId: githubConnection.id,
        arguments: { owner, repo, state: 'open', per_page: 10 },
        dangerouslySkipVersionCheck: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => null),
      
      // Get recent PRs
      client.tools.execute('GITHUB_LIST_PULL_REQUESTS', {
        userId: user.id,
        connectedAccountId: githubConnection.id,
        arguments: { owner, repo, state: 'open', per_page: 10 },
        dangerouslySkipVersionCheck: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => null),
    ])

    // Process README content
    let readmeContent: string | undefined
    if (readmeResult?.successful) {
      const readmeData = readmeResult.data as Record<string, unknown>
      if (readmeData.content && readmeData.encoding === 'base64') {
        readmeContent = Buffer.from(readmeData.content as string, 'base64').toString('utf-8')
      }
    }

    return {
      repo: repoResult.successful ? repoResult.data as Record<string, unknown> : undefined,
      readme: readmeContent,
      recentIssues: issuesResult?.successful ? issuesResult.data as Record<string, unknown>[] : undefined,
      recentPRs: prsResult?.successful ? prsResult.data as Record<string, unknown>[] : undefined,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GitHub] Get repo context error:', errorMessage)
    return { error: `Failed to get repo context: ${errorMessage}` }
  }
}
