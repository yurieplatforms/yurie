/**
 * Tool Definitions
 *
 * Defines all tools available to the AI agent.
 *
 * @module lib/tools/definitions
 */

import type { WebSearchUserLocation } from '@/lib/types'

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Represents a tool use block
 */
export type ToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

/**
 * Represents a tool result
 */
export type ToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

/** Server-side tools */
export type ServerToolType = 'web_search' | 'web_fetch'

/** Client-side tools executed by our application */
export type ClientToolType = 'exa_search'

/** GitHub tools via Composio */
export type GitHubToolType =
  // Read tools
  | 'github_get_repo'
  | 'github_get_readme'
  | 'github_get_file'
  | 'github_get_tree'
  | 'github_list_branches'
  | 'github_list_releases'
  | 'github_get_latest_release'
  | 'github_list_contributors'
  // Issues
  | 'github_list_issues'
  | 'github_get_issue'
  | 'github_create_issue'
  | 'github_update_issue'
  | 'github_add_comment'
  | 'github_list_issue_comments'
  | 'github_add_labels'
  // Pull requests
  | 'github_list_prs'
  | 'github_get_pr'
  | 'github_create_pr'
  | 'github_review_pr'
  | 'github_merge_pr'
  | 'github_list_pr_files'
  // Commits
  | 'github_list_commits'
  // Search
  | 'github_search_repos'
  | 'github_search_issues'
  | 'github_search_code'
  // Repository actions
  | 'github_star_repo'
  | 'github_unstar_repo'
  | 'github_fork_repo'
  | 'github_watch_repo'
  // User
  | 'github_get_me'
  // Workflows
  | 'github_list_workflows'
  | 'github_list_workflow_runs'
  | 'github_trigger_workflow'

/** All tool types available to the agent */
export type ToolName = ServerToolType | ClientToolType | GitHubToolType

// ============================================================================
// Web Search Tool Configuration
// ============================================================================

export type WebSearchToolConfig = {
  maxUses?: number
  userLocation?: WebSearchUserLocation
  allowedDomains?: string[]
  blockedDomains?: string[]
}

/**
 * Creates a web search tool definition (OpenAI format).
 * Note: xAI/Grok might support different tool definitions, but generally follows OpenAI.
 * We'll use a placeholder or remove it if xAI doesn't support server-side tools.
 * For now, returning a standard function definition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWebSearchTool(config: WebSearchToolConfig = {}): any {
  return {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for real-time information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
        },
        required: ['query'],
      },
    },
  }
}

/**
 * Creates server tools.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServerTools(webSearchConfig?: WebSearchToolConfig): any[] {
  return [createWebSearchTool(webSearchConfig)]
}
