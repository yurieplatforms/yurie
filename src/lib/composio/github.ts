/**
 * GitHub Tools via Composio
 *
 * Provides GitHub repository context tools using Composio's GitHub toolkit.
 * These tools allow the AI agent to fetch repo information, issues, PRs, commits, etc.
 *
 * @see https://docs.composio.dev/toolkits/github
 */

import { Composio } from '@composio/core'
import { AnthropicProvider } from '@composio/anthropic'
import { env } from '@/lib/config/env'

// ============================================================================
// Types
// ============================================================================

/**
 * Output type for Composio tool execution results.
 */
export interface ComposioToolOutput {
  successful: boolean
  data?: unknown
  error?: string
}

export interface GitHubRepoInfo {
  owner: string
  repo: string
}

export interface GitHubIssueParams extends GitHubRepoInfo {
  state?: 'open' | 'closed' | 'all'
  per_page?: number
  page?: number
}

export interface GitHubPRParams extends GitHubRepoInfo {
  state?: 'open' | 'closed' | 'all'
  per_page?: number
  page?: number
}

export interface GitHubCommitParams extends GitHubRepoInfo {
  per_page?: number
  page?: number
  sha?: string
}

export interface GitHubSearchParams {
  query: string
  per_page?: number
  page?: number
}

export interface GitHubFileParams extends GitHubRepoInfo {
  path: string
  ref?: string
}

export interface GitHubToolContext {
  userId: string
  connectedAccountId?: string
}

// ============================================================================
// Composio Client with Anthropic Provider
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let composioWithAnthropic: Composio<any> | null = null

/**
 * Get Composio client configured with Anthropic provider for GitHub tools.
 * Returns null if COMPOSIO_API_KEY is not configured.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComposioAnthropicClient(): Composio<any> | null {
  if (!env.COMPOSIO_API_KEY) {
    return null
  }

  if (!composioWithAnthropic) {
    composioWithAnthropic = new Composio({
      apiKey: env.COMPOSIO_API_KEY,
      provider: new AnthropicProvider(),
    })
  }

  return composioWithAnthropic
}

/**
 * Check if GitHub tools are available (Composio API key is configured)
 */
export function isGitHubToolsAvailable(): boolean {
  return Boolean(env.COMPOSIO_API_KEY)
}

// ============================================================================
// Tool Execution Helpers
// ============================================================================

/**
 * Default user ID for Composio operations.
 * In a real app, this would be the authenticated user's ID.
 */
const DEFAULT_USER_ID = 'default'

// Store the current tool context (set per request)
let currentToolContext: GitHubToolContext = { userId: DEFAULT_USER_ID }

/**
 * Set the context for GitHub tool execution (user ID and connected account).
 * Call this before executing GitHub tools.
 */
export function setGitHubToolContext(context: GitHubToolContext): void {
  currentToolContext = context
}

/**
 * Get the current tool context.
 */
export function getGitHubToolContext(): GitHubToolContext {
  return currentToolContext
}

/**
 * Find the user's GitHub connected account ID.
 */
export async function findGitHubConnectionId(userId: string): Promise<string | undefined> {
  const composio = getComposioAnthropicClient()
  if (!composio) return undefined

  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
      statuses: ['ACTIVE'],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const githubConnection = connections.items?.find((conn: any) => {
      const connToolkitSlug = conn.toolkit?.slug || conn.appName?.toLowerCase() || ''
      return connToolkitSlug === 'github'
    })

    return githubConnection?.id
  } catch (error) {
    console.error('[Composio] Failed to find GitHub connection:', error)
    return undefined
  }
}

/**
 * Execute a Composio GitHub tool and return the result.
 * Uses dangerouslySkipVersionCheck to bypass version requirements.
 * @see https://docs.composio.dev/docs/migration-guide/toolkit-versioning
 */
async function executeGitHubTool(
  toolSlug: string,
  args: Record<string, unknown>
): Promise<ComposioToolOutput> {
  const composio = getComposioAnthropicClient()
  if (!composio) {
    throw new Error('Composio is not configured. Please set COMPOSIO_API_KEY.')
  }

  const context = getGitHubToolContext()
  
  console.log(`[GitHub Tool] Executing ${toolSlug} for user ${context.userId}`)
  if (context.connectedAccountId) {
    console.log(`[GitHub Tool] Using connection: ${context.connectedAccountId}`)
  }

  try {
    // Execute with dangerouslySkipVersionCheck to bypass toolkit versioning
    // This is necessary because the SDK doesn't properly support toolkitVersion yet
    const result = await composio.tools.execute(toolSlug, {
      userId: context.userId,
      arguments: args,
      ...(context.connectedAccountId && { connectedAccountId: context.connectedAccountId }),
      // Skip version check - required for now until SDK properly supports toolkitVersion
      dangerouslySkipVersionCheck: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    
    console.log(`[GitHub Tool] ${toolSlug} result: successful=${result.successful}`)
    return result
  } catch (error) {
    console.error(`[GitHub Tool] ${toolSlug} error:`, error)
    throw error
  }
}

// ============================================================================
// GitHub Repository Tools
// ============================================================================

/**
 * Get repository information.
 *
 * @example
 * const repo = await getRepository({ owner: 'facebook', repo: 'react' })
 */
export async function getRepository(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_REPOSITORY', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * List repository issues.
 *
 * @example
 * const issues = await listIssues({ owner: 'vercel', repo: 'next.js', state: 'open' })
 */
export async function listIssues(params: GitHubIssueParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_REPOSITORY_ISSUES', {
    owner: params.owner,
    repo: params.repo,
    state: params.state ?? 'open',
    per_page: params.per_page ?? 10,
    page: params.page ?? 1,
  })
}

/**
 * Get a specific issue by number.
 *
 * @example
 * const issue = await getIssue({ owner: 'vercel', repo: 'next.js' }, 123)
 */
export async function getIssue(
  params: GitHubRepoInfo,
  issueNumber: number
): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_AN_ISSUE', {
    owner: params.owner,
    repo: params.repo,
    issue_number: issueNumber,
  })
}

/**
 * List repository pull requests.
 *
 * @example
 * const prs = await listPullRequests({ owner: 'facebook', repo: 'react', state: 'open' })
 */
export async function listPullRequests(params: GitHubPRParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_PULL_REQUESTS', {
    owner: params.owner,
    repo: params.repo,
    state: params.state ?? 'open',
    per_page: params.per_page ?? 10,
    page: params.page ?? 1,
  })
}

/**
 * Get a specific pull request by number.
 *
 * @example
 * const pr = await getPullRequest({ owner: 'facebook', repo: 'react' }, 456)
 */
export async function getPullRequest(
  params: GitHubRepoInfo,
  pullNumber: number
): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_PULL_REQUEST', {
    owner: params.owner,
    repo: params.repo,
    pull_number: pullNumber,
  })
}

/**
 * List repository commits.
 *
 * @example
 * const commits = await listCommits({ owner: 'vercel', repo: 'next.js', per_page: 20 })
 */
export async function listCommits(params: GitHubCommitParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_COMMITS', {
    owner: params.owner,
    repo: params.repo,
    per_page: params.per_page ?? 10,
    page: params.page ?? 1,
    ...(params.sha && { sha: params.sha }),
  })
}

/**
 * Get a specific commit by SHA.
 *
 * @example
 * const commit = await getCommit({ owner: 'vercel', repo: 'next.js' }, 'abc123')
 */
export async function getCommit(params: GitHubRepoInfo, sha: string): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_COMMIT', {
    owner: params.owner,
    repo: params.repo,
    ref: sha,
  })
}

/**
 * Get repository README content.
 *
 * @example
 * const readme = await getReadme({ owner: 'facebook', repo: 'react' })
 */
export async function getReadme(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_REPOSITORY_README', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Get file content from repository.
 *
 * @example
 * const file = await getFileContent({ owner: 'vercel', repo: 'next.js', path: 'package.json' })
 */
export async function getFileContent(params: GitHubFileParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_REPOSITORY_CONTENT', {
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    ...(params.ref && { ref: params.ref }),
  })
}

/**
 * List repository branches.
 *
 * @example
 * const branches = await listBranches({ owner: 'facebook', repo: 'react' })
 */
export async function listBranches(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_BRANCHES', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * List repository releases.
 *
 * @example
 * const releases = await listReleases({ owner: 'vercel', repo: 'next.js' })
 */
export async function listReleases(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_RELEASES', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Get latest release from repository.
 *
 * @example
 * const latest = await getLatestRelease({ owner: 'vercel', repo: 'next.js' })
 */
export async function getLatestRelease(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_THE_LATEST_RELEASE', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Search repositories on GitHub.
 *
 * @example
 * const repos = await searchRepositories({ query: 'react state management stars:>1000' })
 */
export async function searchRepositories(params: GitHubSearchParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_SEARCH_REPOSITORIES', {
    q: params.query,
    per_page: params.per_page ?? 10,
    page: params.page ?? 1,
  })
}

/**
 * Search issues and PRs on GitHub.
 *
 * @example
 * const results = await searchIssues({ query: 'repo:vercel/next.js is:issue is:open' })
 */
export async function searchIssues(params: GitHubSearchParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_SEARCH_ISSUES_AND_PULL_REQUESTS', {
    q: params.query,
    per_page: params.per_page ?? 10,
    page: params.page ?? 1,
  })
}

/**
 * Search code on GitHub.
 *
 * @example
 * const code = await searchCode({ query: 'filename:package.json react-dom' })
 */
export async function searchCode(params: GitHubSearchParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_SEARCH_CODE', {
    q: params.query,
    per_page: params.per_page ?? 10,
    page: params.page ?? 1,
  })
}

/**
 * Get repository contributors.
 *
 * @example
 * const contributors = await listContributors({ owner: 'facebook', repo: 'react' })
 */
export async function listContributors(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_REPOSITORY_CONTRIBUTORS', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Get repository languages breakdown.
 *
 * @example
 * const languages = await getLanguages({ owner: 'vercel', repo: 'next.js' })
 */
export async function getLanguages(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_REPOSITORY_LANGUAGES', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Get a user's profile information.
 *
 * @example
 * const user = await getUser('octocat')
 */
export async function getUser(username: string): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_USER', {
    username,
  })
}

/**
 * List user's repositories.
 *
 * @example
 * const repos = await listUserRepos('octocat')
 */
export async function listUserRepos(
  username: string,
  options?: { per_page?: number; page?: number; sort?: 'created' | 'updated' | 'pushed' | 'full_name' }
): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_REPOSITORIES_FOR_A_USER', {
    username,
    per_page: options?.per_page ?? 10,
    page: options?.page ?? 1,
    sort: options?.sort ?? 'updated',
  })
}

// ============================================================================
// GitHub Write/Action Tools
// ============================================================================

export interface CreateIssueParams extends GitHubRepoInfo {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
}

/**
 * Create a new issue in a repository.
 *
 * @example
 * const issue = await createIssue({ owner: 'vercel', repo: 'next.js', title: 'Bug report', body: 'Description...' })
 */
export async function createIssue(params: CreateIssueParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_CREATE_AN_ISSUE', {
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    labels: params.labels,
    assignees: params.assignees,
  })
}

export interface CreateIssueCommentParams extends GitHubRepoInfo {
  issue_number: number
  body: string
}

/**
 * Add a comment to an issue or pull request.
 *
 * @example
 * const comment = await createIssueComment({ owner: 'vercel', repo: 'next.js', issue_number: 123, body: 'Great work!' })
 */
export async function createIssueComment(params: CreateIssueCommentParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_CREATE_AN_ISSUE_COMMENT', {
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issue_number,
    body: params.body,
  })
}

export interface CreatePullRequestParams extends GitHubRepoInfo {
  title: string
  body?: string
  head: string
  base: string
  draft?: boolean
}

/**
 * Create a pull request.
 *
 * @example
 * const pr = await createPullRequest({ owner: 'vercel', repo: 'next.js', title: 'Fix bug', head: 'fix-branch', base: 'main' })
 */
export async function createPullRequest(params: CreatePullRequestParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_CREATE_A_PULL_REQUEST', {
    owner: params.owner,
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
    draft: params.draft,
  })
}

export interface UpdateIssueParams extends GitHubRepoInfo {
  issue_number: number
  title?: string
  body?: string
  state?: 'open' | 'closed'
  labels?: string[]
  assignees?: string[]
}

/**
 * Update an existing issue.
 *
 * @example
 * const issue = await updateIssue({ owner: 'vercel', repo: 'next.js', issue_number: 123, state: 'closed' })
 */
export async function updateIssue(params: UpdateIssueParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_UPDATE_AN_ISSUE', {
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issue_number,
    title: params.title,
    body: params.body,
    state: params.state,
    labels: params.labels,
    assignees: params.assignees,
  })
}

export interface MergePullRequestParams extends GitHubRepoInfo {
  pull_number: number
  commit_title?: string
  commit_message?: string
  merge_method?: 'merge' | 'squash' | 'rebase'
}

/**
 * Merge a pull request.
 *
 * @example
 * const result = await mergePullRequest({ owner: 'vercel', repo: 'next.js', pull_number: 456, merge_method: 'squash' })
 */
export async function mergePullRequest(params: MergePullRequestParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_MERGE_A_PULL_REQUEST', {
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pull_number,
    commit_title: params.commit_title,
    commit_message: params.commit_message,
    merge_method: params.merge_method ?? 'squash',
  })
}

export interface AddLabelsParams extends GitHubRepoInfo {
  issue_number: number
  labels: string[]
}

/**
 * Add labels to an issue or pull request.
 *
 * @example
 * const result = await addLabels({ owner: 'vercel', repo: 'next.js', issue_number: 123, labels: ['bug', 'priority'] })
 */
export async function addLabels(params: AddLabelsParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_ADD_LABELS_TO_AN_ISSUE', {
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issue_number,
    labels: params.labels,
  })
}

export interface CreatePRReviewParams extends GitHubRepoInfo {
  pull_number: number
  body?: string
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
}

/**
 * Create a review on a pull request.
 *
 * @example
 * const review = await createPRReview({ owner: 'vercel', repo: 'next.js', pull_number: 456, event: 'APPROVE', body: 'LGTM!' })
 */
export async function createPRReview(params: CreatePRReviewParams): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST', {
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pull_number,
    body: params.body,
    event: params.event,
  })
}

// ============================================================================
// Additional GitHub Actions
// ============================================================================

/**
 * Star a repository for the authenticated user.
 *
 * @example
 * const result = await starRepository({ owner: 'vercel', repo: 'next.js' })
 */
export async function starRepository(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Unstar a repository for the authenticated user.
 *
 * @example
 * const result = await unstarRepository({ owner: 'vercel', repo: 'next.js' })
 */
export async function unstarRepository(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_UNSTAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Fork a repository.
 *
 * @example
 * const fork = await forkRepository({ owner: 'vercel', repo: 'next.js' })
 */
export async function forkRepository(params: GitHubRepoInfo & { 
  organization?: string
  name?: string
  default_branch_only?: boolean
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_CREATE_A_FORK', {
    owner: params.owner,
    repo: params.repo,
    ...(params.organization && { organization: params.organization }),
    ...(params.name && { name: params.name }),
    ...(params.default_branch_only !== undefined && { default_branch_only: params.default_branch_only }),
  })
}

/**
 * Watch a repository (subscribe to notifications).
 *
 * @example
 * const result = await watchRepository({ owner: 'vercel', repo: 'next.js', subscribed: true })
 */
export async function watchRepository(params: GitHubRepoInfo & { 
  subscribed?: boolean
  ignored?: boolean
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_SET_A_REPOSITORY_SUBSCRIPTION', {
    owner: params.owner,
    repo: params.repo,
    subscribed: params.subscribed ?? true,
    ignored: params.ignored ?? false,
  })
}

/**
 * Get the authenticated user's information.
 *
 * @example
 * const user = await getAuthenticatedUser()
 */
export async function getAuthenticatedUser(): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_THE_AUTHENTICATED_USER', {})
}

/**
 * List workflow runs for a repository.
 *
 * @example
 * const runs = await listWorkflowRuns({ owner: 'vercel', repo: 'next.js' })
 */
export async function listWorkflowRuns(params: GitHubRepoInfo & {
  workflow_id?: string | number
  branch?: string
  event?: string
  status?: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending'
  per_page?: number
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY', {
    owner: params.owner,
    repo: params.repo,
    ...(params.workflow_id && { workflow_id: params.workflow_id }),
    ...(params.branch && { branch: params.branch }),
    ...(params.event && { event: params.event }),
    ...(params.status && { status: params.status }),
    per_page: params.per_page ?? 10,
  })
}

/**
 * List repository workflows.
 *
 * @example
 * const workflows = await listWorkflows({ owner: 'vercel', repo: 'next.js' })
 */
export async function listWorkflows(params: GitHubRepoInfo): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_REPOSITORY_WORKFLOWS', {
    owner: params.owner,
    repo: params.repo,
  })
}

/**
 * Trigger a workflow dispatch event.
 *
 * @example
 * const result = await triggerWorkflow({ owner: 'vercel', repo: 'next.js', workflow_id: 'ci.yml', ref: 'main' })
 */
export async function triggerWorkflow(params: GitHubRepoInfo & {
  workflow_id: string | number
  ref: string
  inputs?: Record<string, string>
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_CREATE_A_WORKFLOW_DISPATCH_EVENT', {
    owner: params.owner,
    repo: params.repo,
    workflow_id: params.workflow_id,
    ref: params.ref,
    ...(params.inputs && { inputs: params.inputs }),
  })
}

/**
 * List comments on an issue.
 *
 * @example
 * const comments = await listIssueComments({ owner: 'vercel', repo: 'next.js', issue_number: 123 })
 */
export async function listIssueComments(params: GitHubRepoInfo & {
  issue_number: number
  per_page?: number
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_ISSUE_COMMENTS', {
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issue_number,
    per_page: params.per_page ?? 30,
  })
}

/**
 * Get the diff for a pull request.
 *
 * @example
 * const diff = await getPullRequestDiff({ owner: 'vercel', repo: 'next.js', pull_number: 456 })
 */
export async function getPullRequestDiff(params: GitHubRepoInfo & {
  pull_number: number
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_PULL_REQUEST', {
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pull_number,
    // Request diff format via media type
    mediaType: { format: 'diff' },
  })
}

/**
 * List files changed in a pull request.
 *
 * @example
 * const files = await listPullRequestFiles({ owner: 'vercel', repo: 'next.js', pull_number: 456 })
 */
export async function listPullRequestFiles(params: GitHubRepoInfo & {
  pull_number: number
  per_page?: number
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_PULL_REQUESTS_FILES', {
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pull_number,
    per_page: params.per_page ?? 100,
  })
}

/**
 * List commits on a pull request.
 *
 * @example
 * const commits = await listPullRequestCommits({ owner: 'vercel', repo: 'next.js', pull_number: 456 })
 */
export async function listPullRequestCommits(params: GitHubRepoInfo & {
  pull_number: number
  per_page?: number
}): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_LIST_COMMITS_ON_A_PULL_REQUEST', {
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pull_number,
    per_page: params.per_page ?? 100,
  })
}

/**
 * Get the directory tree structure of a repository.
 *
 * @example
 * const tree = await getRepoTree({ owner: 'vercel', repo: 'next.js' })
 */
export async function getRepoTree(params: GitHubRepoInfo & { sha?: string; recursive?: boolean }): Promise<ComposioToolOutput> {
  return executeGitHubTool('GITHUB_GET_A_TREE', {
    owner: params.owner,
    repo: params.repo,
    tree_sha: params.sha ?? 'HEAD',
    recursive: params.recursive ?? true,
  })
}

// ============================================================================
// GitHub Tools for Anthropic
// ============================================================================

/**
 * Get pre-configured GitHub tools formatted for Anthropic's API.
 * These can be passed directly to Anthropic's messages.create() tools parameter.
 *
 * @example
 * const tools = await getGitHubToolsForAnthropic()
 * const response = await anthropic.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   tools: [...otherTools, ...tools],
 *   messages: [...]
 * })
 */
export async function getGitHubToolsForAnthropic(
  options?: { tools?: string[]; search?: string; limit?: number }
): Promise<unknown[]> {
  const composio = getComposioAnthropicClient()
  if (!composio) {
    return []
  }

  try {
    const tools = await composio.tools.get(DEFAULT_USER_ID, {
      toolkits: ['github'],
      ...(options?.tools && { tools: options.tools }),
      ...(options?.search && { search: options.search }),
      ...(options?.limit && { limit: options.limit }),
    })

    return tools
  } catch (error) {
    console.error('Failed to get GitHub tools from Composio:', error)
    return []
  }
}

/**
 * Handle tool calls from Anthropic response using Composio.
 * This executes the tool calls and returns results.
 *
 * @example
 * const result = await handleGitHubToolCalls(response)
 */
export async function handleGitHubToolCalls(response: unknown): Promise<unknown> {
  const composio = getComposioAnthropicClient()
  if (!composio) {
    throw new Error('Composio is not configured')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return composio.provider.handleToolCalls(DEFAULT_USER_ID, response as any)
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format GitHub repository info for LLM consumption.
 */
export function formatRepoForLLM(data: Record<string, unknown>): string {
  const lines = [
    `# ${data.full_name || data.name}`,
    '',
    data.description ? `${data.description}` : '',
    '',
    '## Stats',
    `- ⭐ Stars: ${data.stargazers_count ?? 'N/A'}`,
    `- 🔀 Forks: ${data.forks_count ?? 'N/A'}`,
    `- 👁 Watchers: ${data.watchers_count ?? 'N/A'}`,
    `- 📝 Open Issues: ${data.open_issues_count ?? 'N/A'}`,
    '',
    '## Details',
    `- 🔗 URL: ${data.html_url ?? 'N/A'}`,
    `- 📅 Created: ${data.created_at ?? 'N/A'}`,
    `- 🔄 Updated: ${data.updated_at ?? 'N/A'}`,
    `- 📦 Size: ${data.size ?? 'N/A'} KB`,
    `- 🗣 Language: ${data.language ?? 'N/A'}`,
    `- 📜 License: ${(data.license as Record<string, unknown>)?.name ?? 'N/A'}`,
    '',
    data.topics && (data.topics as string[]).length > 0
      ? `## Topics\n${(data.topics as string[]).map((t) => `- ${t}`).join('\n')}`
      : '',
  ]

  return lines.filter(Boolean).join('\n')
}

/**
 * Format GitHub issues list for LLM consumption.
 */
export function formatIssuesForLLM(issues: Record<string, unknown>[]): string {
  if (!issues || issues.length === 0) {
    return 'No issues found.'
  }

  const lines = [
    `# Issues (${issues.length} results)`,
    '',
    ...issues.map((issue, i) => {
      const labels = (issue.labels as { name: string }[])?.map((l) => l.name).join(', ') || 'none'
      return [
        `## ${i + 1}. #${issue.number}: ${issue.title}`,
        `- State: ${issue.state}`,
        `- Author: ${(issue.user as Record<string, unknown>)?.login ?? 'unknown'}`,
        `- Labels: ${labels}`,
        `- Created: ${issue.created_at}`,
        `- URL: ${issue.html_url}`,
        '',
      ].join('\n')
    }),
  ]

  return lines.join('\n')
}

/**
 * Format GitHub PRs list for LLM consumption.
 */
export function formatPRsForLLM(prs: Record<string, unknown>[]): string {
  if (!prs || prs.length === 0) {
    return 'No pull requests found.'
  }

  const lines = [
    `# Pull Requests (${prs.length} results)`,
    '',
    ...prs.map((pr, i) => {
      return [
        `## ${i + 1}. #${pr.number}: ${pr.title}`,
        `- State: ${pr.state}`,
        `- Author: ${(pr.user as Record<string, unknown>)?.login ?? 'unknown'}`,
        `- Base: ${(pr.base as Record<string, unknown>)?.ref ?? 'N/A'} ← Head: ${(pr.head as Record<string, unknown>)?.ref ?? 'N/A'}`,
        `- Created: ${pr.created_at}`,
        `- URL: ${pr.html_url}`,
        '',
      ].join('\n')
    }),
  ]

  return lines.join('\n')
}

/**
 * Format GitHub commits list for LLM consumption.
 */
export function formatCommitsForLLM(commits: Record<string, unknown>[]): string {
  if (!commits || commits.length === 0) {
    return 'No commits found.'
  }

  const lines = [
    `# Commits (${commits.length} results)`,
    '',
    ...commits.map((commit, i) => {
      const commitData = commit.commit as Record<string, unknown>
      const author = commitData?.author as Record<string, unknown>
      return [
        `## ${i + 1}. ${(commit.sha as string)?.slice(0, 7)}`,
        `- Message: ${(commitData?.message as string)?.split('\n')[0] ?? 'N/A'}`,
        `- Author: ${author?.name ?? 'unknown'}`,
        `- Date: ${author?.date ?? 'N/A'}`,
        `- URL: ${commit.html_url}`,
        '',
      ].join('\n')
    }),
  ]

  return lines.join('\n')
}

