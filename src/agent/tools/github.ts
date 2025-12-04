import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import type { SSEHandler } from '@/agent/sse-handler'
import type { FocusedRepoContext } from './types'
import {
  isGitHubToolsAvailable,
  setGitHubToolContext,
  findGitHubConnectionId,
  getRepository,
  listIssues,
  getIssue,
  listPullRequests,
  getPullRequest,
  listCommits,
  getReadme,
  searchRepositories,
  searchIssues,
  searchCode,
  listBranches,
  listReleases,
  getLatestRelease,
  listContributors,
  // Write/Action tools
  createIssue,
  updateIssue,
  createIssueComment,
  listIssueComments,
  createPullRequest,
  mergePullRequest,
  createPRReview,
  listPullRequestFiles,
  addLabels,
  getRepoTree,
  getFileContent,
  // Repository actions
  starRepository,
  unstarRepository,
  forkRepository,
  watchRepository,
  getAuthenticatedUser,
  // Workflows
  listWorkflows,
  listWorkflowRuns,
  triggerWorkflow,
  // Formatters
  formatRepoForLLM,
  formatIssuesForLLM,
  formatPRsForLLM,
  formatCommitsForLLM,
} from '@/services/composio'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getGitHubTools(
  sseHandler: SSEHandler, 
  userId?: string, 
  focusedRepo?: FocusedRepoContext | null
): Promise<any[]> {
  // Set up GitHub context if user is authenticated and Composio is available
  if (userId && isGitHubToolsAvailable()) {
    const connectedAccountId = await findGitHubConnectionId(userId)
    setGitHubToolContext({
      userId,
      connectedAccountId,
    })
    if (connectedAccountId) {
      console.log(`[GitHub Tools] Context set for user ${userId} with connection ${connectedAccountId}`)
    }
  }

  if (!isGitHubToolsAvailable()) {
    return []
  }

  // Helper to get default owner/repo from focused repo
  const getDefaultRepo = () => focusedRepo ? { owner: focusedRepo.owner, repo: focusedRepo.name } : null
  
  // Helper to resolve owner/repo with defaults
  const resolveRepo = (input: { owner?: string; repo?: string }) => {
    const defaults = getDefaultRepo()
    return {
      owner: input.owner || defaults?.owner || '',
      repo: input.repo || defaults?.repo || '',
    }
  }

  return [
    // Get GitHub repository information
    betaTool({
      name: 'github_get_repo',
      description:
        `Get detailed information about a GitHub repository including stars, forks, description, language, license, topics, and more. Use this to understand a project before diving into issues or PRs.${focusedRepo ? ` If owner/repo not specified, defaults to the focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description:
              `The repository owner (username or organization).${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ' Example: "facebook", "vercel", "microsoft"'}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ' Example: "react", "next.js", "vscode"'}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getRepository({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_get_repo',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const formatted = formatRepoForLLM(result.data as Record<string, unknown>)
          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_get_repo',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubRepo: result.data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_get_repo',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // List GitHub issues
    {
      ...betaTool({
        name: 'github_list_issues',
        description:
          `List issues from a GitHub repository. Returns issue titles, states, labels, authors, and URLs. Use this to understand what problems or feature requests exist for a project.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
            },
            repo: {
              type: 'string',
              description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
            },
            state: {
              type: 'string',
              enum: ['open', 'closed', 'all'],
              description:
                'Filter by issue state. "open" (default) for active issues, "closed" for resolved, "all" for both.',
            },
            per_page: {
              type: 'number',
              description: 'Number of issues to return (1-100). Default is 10.',
            },
          },
          required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
          additionalProperties: false,
        },
        run: async (input) => {
          try {
            const { owner, repo } = resolveRepo(input)
            if (!owner || !repo) {
              const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
              await sseHandler.sendToolEvent('github_list_issues', 'end', input as Record<string, unknown>, errorMsg)
              return errorMsg
            }
            const result = await listIssues({
              owner,
              repo,
              state: input.state as 'open' | 'closed' | 'all' | undefined,
              per_page: input.per_page,
            })
            if (!result.successful) {
              const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
              await sseHandler.sendToolEvent(
                'github_list_issues',
                'end',
                input as Record<string, unknown>,
                errorMsg
              )
              return errorMsg
            }
            const formatted = formatIssuesForLLM(result.data as Record<string, unknown>[])
            await sseHandler.sendSSE({
              choices: [
                {
                  delta: {
                    tool_use: {
                      name: 'github_list_issues',
                      status: 'end',
                      input: input as Record<string, unknown>,
                      result: formatted,
                      githubIssues: result.data,
                    },
                  },
                },
              ],
            })
            return formatted
          } catch (error) {
            const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_list_issues',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
        },
      }),
      input_examples: [
        { owner: 'vercel', repo: 'next.js', state: 'open', per_page: 5 },
        { owner: 'facebook', repo: 'react', state: 'closed' },
      ],
    },

    // Get specific GitHub issue
    betaTool({
      name: 'github_get_issue',
      description:
        `Get detailed information about a specific GitHub issue by number. Includes full body, comments count, labels, assignees, and more.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          issue_number: {
            type: 'number',
            description: 'The issue number to retrieve.',
          },
        },
        required: focusedRepo ? ['issue_number'] as const : ['owner', 'repo', 'issue_number'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_issue', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getIssue(
            { owner, repo },
            input.issue_number
          )
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_get_issue',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const issue = result.data as Record<string, unknown>
          const formatted = [
            `# Issue #${issue.number}: ${issue.title}`,
            '',
            `**State:** ${issue.state}`,
            `**Author:** ${(issue.user as Record<string, unknown>)?.login ?? 'unknown'}`,
            `**Created:** ${issue.created_at}`,
            `**Labels:** ${(issue.labels as { name: string }[])?.map((l) => l.name).join(', ') || 'none'}`,
            `**URL:** ${issue.html_url}`,
            '',
            '## Body',
            issue.body || '_No description provided._',
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_get_issue',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubIssue: result.data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_get_issue',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // List GitHub pull requests
    betaTool({
      name: 'github_list_prs',
      description:
        `List pull requests from a GitHub repository. Returns PR titles, states, authors, branches, and URLs. Use this to see ongoing development and proposed changes.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          state: {
            type: 'string',
            enum: ['open', 'closed', 'all'],
            description:
              'Filter by PR state. "open" (default) for active PRs, "closed" for merged/closed, "all" for both.',
          },
          per_page: {
            type: 'number',
            description: 'Number of PRs to return (1-100). Default is 10.',
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_prs', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listPullRequests({
            owner,
            repo,
            state: input.state as 'open' | 'closed' | 'all' | undefined,
            per_page: input.per_page,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_list_prs',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const formatted = formatPRsForLLM(result.data as Record<string, unknown>[])
          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_list_prs',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubPRs: result.data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_list_prs',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // Get specific GitHub PR
    betaTool({
      name: 'github_get_pr',
      description:
        `Get detailed information about a specific GitHub pull request by number. Includes full description, diff stats, review status, and merge information.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          pull_number: {
            type: 'number',
            description: 'The pull request number to retrieve.',
          },
        },
        required: focusedRepo ? ['pull_number'] as const : ['owner', 'repo', 'pull_number'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getPullRequest(
            { owner, repo },
            input.pull_number
          )
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_get_pr',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const pr = result.data as Record<string, unknown>
          const formatted = [
            `# PR #${pr.number}: ${pr.title}`,
            '',
            `**State:** ${pr.state}${pr.merged ? ' (merged)' : ''}`,
            `**Author:** ${(pr.user as Record<string, unknown>)?.login ?? 'unknown'}`,
            `**Branch:** ${(pr.head as Record<string, unknown>)?.ref} → ${(pr.base as Record<string, unknown>)?.ref}`,
            `**Created:** ${pr.created_at}`,
            `**URL:** ${pr.html_url}`,
            `**Commits:** ${pr.commits ?? 'N/A'}`,
            `**Changed Files:** ${pr.changed_files ?? 'N/A'}`,
            `**Additions:** +${pr.additions ?? 0} | **Deletions:** -${pr.deletions ?? 0}`,
            '',
            '## Description',
            pr.body || '_No description provided._',
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_get_pr',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubPR: result.data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_get_pr',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // List GitHub commits
    betaTool({
      name: 'github_list_commits',
      description:
        `List recent commits from a GitHub repository. Returns commit messages, authors, dates, and SHAs. Use this to understand recent development activity.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          per_page: {
            type: 'number',
            description: 'Number of commits to return (1-100). Default is 10.',
          },
          sha: {
            type: 'string',
            description:
              'Branch name or commit SHA to start listing from. Defaults to default branch.',
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_commits', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listCommits({
            owner,
            repo,
            per_page: input.per_page,
            sha: input.sha,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_list_commits',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const formatted = formatCommitsForLLM(result.data as Record<string, unknown>[])
          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_list_commits',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubCommits: result.data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_list_commits',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // Get repository README
    betaTool({
      name: 'github_get_readme',
      description:
        `Get the README content from a GitHub repository. Returns the decoded README text. Use this to understand what a project is about, how to use it, and its documentation.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_readme', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getReadme({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_get_readme',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const data = result.data as Record<string, unknown>
          // README content is base64 encoded
          let content = data.content as string
          if (data.encoding === 'base64' && content) {
            content = Buffer.from(content, 'base64').toString('utf-8')
          }
          const formatted = `# README for ${owner}/${repo}\n\n${content || '_No README found._'}`

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_get_readme',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_get_readme',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // Search GitHub repositories
    betaTool({
      name: 'github_search_repos',
      description:
        'Search for GitHub repositories using GitHub\'s search syntax. Supports filtering by stars, language, topics, and more. Use this to discover projects matching specific criteria.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query using GitHub search syntax. Examples: "react state management", "language:typescript stars:>1000", "topic:machine-learning"',
          },
          per_page: {
            type: 'number',
            description: 'Number of results to return (1-100). Default is 10.',
          },
        },
        required: ['query'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const result = await searchRepositories({
            query: input.query,
            per_page: input.per_page,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_search_repos',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const data = result.data as { total_count: number; items: Record<string, unknown>[] }
          const repos = data.items || []
          const formatted = [
            `# Repository Search Results (${data.total_count} total)`,
            '',
            ...repos.map((repo, i) => {
              return [
                `## ${i + 1}. ${repo.full_name}`,
                repo.description ? `${repo.description}` : '',
                `- ⭐ ${repo.stargazers_count} | 🔀 ${repo.forks_count} | 🗣 ${repo.language || 'N/A'}`,
                `- URL: ${repo.html_url}`,
                '',
              ].join('\n')
            }),
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_search_repos',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubSearchRepos: data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_search_repos',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // Search GitHub issues/PRs
    betaTool({
      name: 'github_search_issues',
      description:
        'Search for issues and pull requests across GitHub using search syntax. Filter by repo, state, labels, author, and more. Use this to find specific issues or understand patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query. Examples: "repo:vercel/next.js is:issue is:open", "author:octocat is:pr", "label:bug state:open"',
          },
          per_page: {
            type: 'number',
            description: 'Number of results to return (1-100). Default is 10.',
          },
        },
        required: ['query'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const result = await searchIssues({
            query: input.query,
            per_page: input.per_page,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_search_issues',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const data = result.data as { total_count: number; items: Record<string, unknown>[] }
          const items = data.items || []
          const formatted = [
            `# Issue/PR Search Results (${data.total_count} total)`,
            '',
            ...items.map((item, i) => {
              const isPR = Boolean(item.pull_request)
              return [
                `## ${i + 1}. ${isPR ? '🔀' : '📋'} #${item.number}: ${item.title}`,
                `- Type: ${isPR ? 'Pull Request' : 'Issue'}`,
                `- State: ${item.state}`,
                `- Repo: ${(item.repository_url as string)?.split('/').slice(-2).join('/') || 'N/A'}`,
                `- URL: ${item.html_url}`,
                '',
              ].join('\n')
            }),
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_search_issues',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubSearchIssues: data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_search_issues',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // Search GitHub code
    betaTool({
      name: 'github_search_code',
      description:
        'Search for code across GitHub repositories. Find files, functions, or patterns. Use this to discover how things are implemented or find usage examples.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query. Examples: "filename:package.json react", "repo:vercel/next.js useRouter", "extension:ts async function"',
          },
          per_page: {
            type: 'number',
            description: 'Number of results to return (1-100). Default is 10.',
          },
        },
        required: ['query'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const result = await searchCode({
            query: input.query,
            per_page: input.per_page,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_search_code',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const data = result.data as { total_count: number; items: Record<string, unknown>[] }
          const items = data.items || []
          const formatted = [
            `# Code Search Results (${data.total_count} total)`,
            '',
            ...items.map((item, i) => {
              const repo = item.repository as Record<string, unknown>
              return [
                `## ${i + 1}. ${item.path}`,
                `- Repository: ${repo?.full_name || 'N/A'}`,
                `- URL: ${item.html_url}`,
                '',
              ].join('\n')
            }),
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_search_code',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubSearchCode: data,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_search_code',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // List repository branches
    betaTool({
      name: 'github_list_branches',
      description:
        `List branches in a GitHub repository. Returns branch names and their commit references.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_branches', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listBranches({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_list_branches',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const branches = result.data as Record<string, unknown>[]
          const { owner: resolvedOwner, repo: resolvedRepo } = resolveRepo(input)
          const formatted = [
            `# Branches for ${resolvedOwner}/${resolvedRepo}`,
            '',
            ...branches.map((branch) => `- ${branch.name}`),
          ].join('\n')

          await sseHandler.sendToolEvent(
            'github_list_branches',
            'end',
            input as Record<string, unknown>,
            formatted
          )
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_list_branches',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // List repository releases
    betaTool({
      name: 'github_list_releases',
      description:
        `List releases from a GitHub repository. Returns release names, tags, dates, and download information.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_releases', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listReleases({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_list_releases',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const releases = result.data as Record<string, unknown>[]
          const { owner: resolvedOwner2, repo: resolvedRepo2 } = resolveRepo(input)
          const formatted = [
            `# Releases for ${resolvedOwner2}/${resolvedRepo2}`,
            '',
            ...releases.map((release, i) => {
              return [
                `## ${i + 1}. ${release.name || release.tag_name}`,
                `- Tag: ${release.tag_name}`,
                `- Published: ${release.published_at}`,
                `- Prerelease: ${release.prerelease ? 'Yes' : 'No'}`,
                `- URL: ${release.html_url}`,
                '',
              ].join('\n')
            }),
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_list_releases',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubReleases: releases,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_list_releases',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // Get latest release
    betaTool({
      name: 'github_get_latest_release',
      description:
        `Get the latest release from a GitHub repository. Returns the most recent published release with tag, notes, and assets.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_latest_release', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getLatestRelease({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_get_latest_release',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const release = result.data as Record<string, unknown>
          const formatted = [
            `# Latest Release: ${release.name || release.tag_name}`,
            '',
            `**Tag:** ${release.tag_name}`,
            `**Published:** ${release.published_at}`,
            `**Author:** ${(release.author as Record<string, unknown>)?.login ?? 'unknown'}`,
            `**URL:** ${release.html_url}`,
            '',
            '## Release Notes',
            release.body || '_No release notes._',
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_get_latest_release',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubRelease: release,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_get_latest_release',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // List repository contributors
    betaTool({
      name: 'github_list_contributors',
      description:
        `List contributors to a GitHub repository. Returns contributors ordered by number of commits.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_contributors', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listContributors({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent(
              'github_list_contributors',
              'end',
              input as Record<string, unknown>,
              errorMsg
            )
            return errorMsg
          }
          const contributors = result.data as Record<string, unknown>[]
          const { owner: resolvedOwner3, repo: resolvedRepo3 } = resolveRepo(input)
          const formatted = [
            `# Contributors to ${resolvedOwner3}/${resolvedRepo3}`,
            '',
            ...contributors.map((c, i) => {
              return `${i + 1}. **${c.login}** - ${c.contributions} commits`
            }),
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [
              {
                delta: {
                  tool_use: {
                    name: 'github_list_contributors',
                    status: 'end',
                    input: input as Record<string, unknown>,
                    result: formatted,
                    githubContributors: contributors,
                  },
                },
              },
            ],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent(
            'github_list_contributors',
            'end',
            input as Record<string, unknown>,
            errorMsg
          )
          return errorMsg
        }
      },
    }),

    // ====================================================================
    // GitHub Write/Action Tools
    // ====================================================================

    // Get file content from repository
    betaTool({
      name: 'github_get_file',
      description:
        `Get the contents of a file from a GitHub repository. Returns the file content decoded from base64. Use this to read source code, configuration files, or any file in the repo.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          path: {
            type: 'string',
            description: 'The file path within the repository (e.g., "src/index.ts", "package.json").',
          },
          ref: {
            type: 'string',
            description: 'Branch name, tag, or commit SHA. Defaults to the default branch.',
          },
        },
        required: focusedRepo ? ['path'] as const : ['owner', 'repo', 'path'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_file', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getFileContent({
            owner,
            repo,
            path: input.path,
            ref: input.ref,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_get_file', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const data = result.data as Record<string, unknown>
          let content = data.content as string
          if (data.encoding === 'base64' && content) {
            content = Buffer.from(content, 'base64').toString('utf-8')
          }
          const formatted = `# File: ${input.path}\n\n\`\`\`\n${content}\n\`\`\``
          await sseHandler.sendToolEvent('github_get_file', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_get_file', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Get repository directory tree
    betaTool({
      name: 'github_get_tree',
      description:
        `Get the directory tree structure of a GitHub repository. Returns all files and folders recursively. Use this to understand the project structure before reading specific files.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          sha: {
            type: 'string',
            description: 'Branch name, tag, or commit SHA. Defaults to HEAD.',
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_get_tree', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await getRepoTree({
            owner,
            repo,
            sha: input.sha,
            recursive: true,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_get_tree', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const data = result.data as { tree: { path: string; type: string; size?: number }[] }
          const tree = data.tree || []
          const { owner: resolvedOwner4, repo: resolvedRepo4 } = resolveRepo(input)
          const formatted = [
            `# Repository Tree: ${resolvedOwner4}/${resolvedRepo4}`,
            '',
            ...tree
              .filter((item) => item.type === 'blob' || item.type === 'tree')
              .slice(0, 200) // Limit to 200 items
              .map((item) => {
                const icon = item.type === 'tree' ? '📁' : '📄'
                return `${icon} ${item.path}${item.size ? ` (${item.size} bytes)` : ''}`
              }),
            tree.length > 200 ? `\n... and ${tree.length - 200} more files` : '',
          ].join('\n')
          await sseHandler.sendToolEvent('github_get_tree', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_get_tree', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Create a new issue
    betaTool({
      name: 'github_create_issue',
      description:
        `Create a new issue in a GitHub repository. Use this to report bugs, request features, or document tasks. Returns the created issue details including the issue number and URL.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          title: {
            type: 'string',
            description: 'The issue title. Be descriptive and concise.',
          },
          body: {
            type: 'string',
            description: 'The issue body/description. Use markdown for formatting. Include steps to reproduce for bugs.',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to add to the issue (e.g., ["bug", "priority: high"]).',
          },
          assignees: {
            type: 'array',
            items: { type: 'string' },
            description: 'GitHub usernames to assign to the issue.',
          },
        },
        required: focusedRepo ? ['title'] as const : ['owner', 'repo', 'title'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_create_issue', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await createIssue({
            owner,
            repo,
            title: input.title,
            body: input.body,
            labels: input.labels,
            assignees: input.assignees,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_create_issue', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const issue = result.data as Record<string, unknown>
          const formatted = [
            `✅ Issue created successfully!`,
            '',
            `**#${issue.number}:** ${issue.title}`,
            `**URL:** ${issue.html_url}`,
            `**State:** ${issue.state}`,
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_create_issue', status: 'end', input: input as Record<string, unknown>, result: formatted, githubIssue: issue } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_create_issue', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Update an issue
    betaTool({
      name: 'github_update_issue',
      description:
        `Update an existing issue. Can change title, body, state (open/closed), labels, or assignees. Use this to close issues, update descriptions, or manage issue metadata.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          issue_number: {
            type: 'number',
            description: 'The issue number to update.',
          },
          title: {
            type: 'string',
            description: 'New title for the issue.',
          },
          body: {
            type: 'string',
            description: 'New body/description for the issue.',
          },
          state: {
            type: 'string',
            enum: ['open', 'closed'],
            description: 'Set issue state to open or closed.',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to set on the issue (replaces existing labels).',
          },
          assignees: {
            type: 'array',
            items: { type: 'string' },
            description: 'GitHub usernames to assign (replaces existing assignees).',
          },
        },
        required: focusedRepo ? ['issue_number'] as const : ['owner', 'repo', 'issue_number'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_update_issue', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await updateIssue({
            owner,
            repo,
            issue_number: input.issue_number,
            title: input.title,
            body: input.body,
            state: input.state as 'open' | 'closed' | undefined,
            labels: input.labels,
            assignees: input.assignees,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_update_issue', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const issue = result.data as Record<string, unknown>
          const formatted = [
            `✅ Issue #${issue.number} updated successfully!`,
            '',
            `**Title:** ${issue.title}`,
            `**State:** ${issue.state}`,
            `**URL:** ${issue.html_url}`,
          ].join('\n')
          await sseHandler.sendToolEvent('github_update_issue', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_update_issue', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Add comment to issue/PR
    betaTool({
      name: 'github_add_comment',
      description:
        `Add a comment to an issue or pull request. Use this to provide feedback, ask questions, or update stakeholders on progress.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          issue_number: {
            type: 'number',
            description: 'The issue or pull request number.',
          },
          body: {
            type: 'string',
            description: 'The comment body. Use markdown for formatting.',
          },
        },
        required: focusedRepo ? ['issue_number', 'body'] as const : ['owner', 'repo', 'issue_number', 'body'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_add_comment', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await createIssueComment({
            owner,
            repo,
            issue_number: input.issue_number,
            body: input.body,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_add_comment', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const comment = result.data as Record<string, unknown>
          const formatted = [
            `✅ Comment added to #${input.issue_number}`,
            '',
            `**URL:** ${comment.html_url}`,
          ].join('\n')
          await sseHandler.sendToolEvent('github_add_comment', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_add_comment', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Create pull request
    betaTool({
      name: 'github_create_pr',
      description:
        `Create a new pull request. Use this to propose changes from one branch to another. The head branch must exist and contain commits not in the base branch.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          title: {
            type: 'string',
            description: 'The pull request title.',
          },
          body: {
            type: 'string',
            description: 'The pull request description. Use markdown. Include what changes were made and why.',
          },
          head: {
            type: 'string',
            description: 'The name of the branch containing the changes (source branch).',
          },
          base: {
            type: 'string',
            description: 'The name of the branch to merge into (target branch, e.g., "main").',
          },
          draft: {
            type: 'boolean',
            description: 'Whether to create a draft PR. Default is false.',
          },
        },
        required: focusedRepo ? ['title', 'head', 'base'] as const : ['owner', 'repo', 'title', 'head', 'base'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_create_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await createPullRequest({
            owner,
            repo,
            title: input.title,
            body: input.body,
            head: input.head,
            base: input.base,
            draft: input.draft,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_create_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const pr = result.data as Record<string, unknown>
          const formatted = [
            `✅ Pull request created!`,
            '',
            `**#${pr.number}:** ${pr.title}`,
            `**Branch:** ${input.head} → ${input.base}`,
            `**URL:** ${pr.html_url}`,
            pr.draft ? '**Status:** Draft' : '',
          ].filter(Boolean).join('\n')

          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_create_pr', status: 'end', input: input as Record<string, unknown>, result: formatted, githubPR: pr } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_create_pr', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Create PR review
    betaTool({
      name: 'github_review_pr',
      description:
        `Submit a review on a pull request. Can approve, request changes, or leave a comment. Use this to provide code review feedback.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          pull_number: {
            type: 'number',
            description: 'The pull request number.',
          },
          body: {
            type: 'string',
            description: 'The review comment body.',
          },
          event: {
            type: 'string',
            enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
            description: 'The review action: APPROVE, REQUEST_CHANGES, or COMMENT.',
          },
        },
        required: focusedRepo ? ['pull_number', 'event'] as const : ['owner', 'repo', 'pull_number', 'event'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_review_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await createPRReview({
            owner,
            repo,
            pull_number: input.pull_number,
            body: input.body,
            event: input.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_review_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const review = result.data as Record<string, unknown>
          const eventEmoji = input.event === 'APPROVE' ? '✅' : input.event === 'REQUEST_CHANGES' ? '🔄' : '💬'
          const formatted = [
            `${eventEmoji} Review submitted on PR #${input.pull_number}`,
            '',
            `**Action:** ${input.event}`,
            `**URL:** ${review.html_url}`,
          ].join('\n')
          await sseHandler.sendToolEvent('github_review_pr', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_review_pr', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Add labels to issue
    betaTool({
      name: 'github_add_labels',
      description:
        `Add labels to an issue or pull request. Use this to categorize and organize issues.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          issue_number: {
            type: 'number',
            description: 'The issue or pull request number.',
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Labels to add (e.g., ["bug", "help wanted"]).',
          },
        },
        required: focusedRepo ? ['issue_number', 'labels'] as const : ['owner', 'repo', 'issue_number', 'labels'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_add_labels', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await addLabels({
            owner,
            repo,
            issue_number: input.issue_number,
            labels: input.labels,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_add_labels', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const formatted = `✅ Labels added to #${input.issue_number}: ${input.labels.join(', ')}`
          await sseHandler.sendToolEvent('github_add_labels', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_add_labels', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Merge pull request
    betaTool({
      name: 'github_merge_pr',
      description:
        `Merge a pull request. Choose merge method: merge (standard), squash (combine commits), or rebase. Use with caution - this permanently merges changes.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          pull_number: {
            type: 'number',
            description: 'The pull request number to merge.',
          },
          commit_title: {
            type: 'string',
            description: 'Custom merge commit title.',
          },
          commit_message: {
            type: 'string',
            description: 'Custom merge commit message.',
          },
          merge_method: {
            type: 'string',
            enum: ['merge', 'squash', 'rebase'],
            description: 'Merge method: merge (standard), squash (combine commits), or rebase. Default is squash.',
          },
        },
        required: focusedRepo ? ['pull_number'] as const : ['owner', 'repo', 'pull_number'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_merge_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await mergePullRequest({
            owner,
            repo,
            pull_number: input.pull_number,
            commit_title: input.commit_title,
            commit_message: input.commit_message,
            merge_method: input.merge_method as 'merge' | 'squash' | 'rebase' | undefined,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_merge_pr', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const mergeResult = result.data as Record<string, unknown>
          const formatted = [
            `✅ PR #${input.pull_number} merged successfully!`,
            '',
            `**SHA:** ${mergeResult.sha}`,
            `**Method:** ${input.merge_method || 'squash'}`,
          ].join('\n')

          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_merge_pr', status: 'end', input: input as Record<string, unknown>, result: formatted } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_merge_pr', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // ====================================================================
    // Additional GitHub Actions
    // ====================================================================

    // Star a repository
    betaTool({
      name: 'github_star_repo',
      description:
        `Star a GitHub repository for the authenticated user. Use this to bookmark or show appreciation for a project.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_star_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await starRepository({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_star_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const formatted = `⭐ Starred ${owner}/${repo} successfully!`
          await sseHandler.sendToolEvent('github_star_repo', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_star_repo', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Unstar a repository
    betaTool({
      name: 'github_unstar_repo',
      description:
        `Remove star from a GitHub repository for the authenticated user.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_unstar_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await unstarRepository({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_unstar_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const formatted = `Unstarred ${owner}/${repo}`
          await sseHandler.sendToolEvent('github_unstar_repo', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_unstar_repo', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Fork a repository
    betaTool({
      name: 'github_fork_repo',
      description:
        `Fork a GitHub repository to the authenticated user's account or an organization. Creates a copy of the repository.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          organization: {
            type: 'string',
            description: 'Optional organization to fork to. If not specified, forks to user account.',
          },
          name: {
            type: 'string',
            description: 'Optional custom name for the forked repository.',
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_fork_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await forkRepository({ 
            owner, 
            repo,
            organization: input.organization,
            name: input.name,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_fork_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const fork = result.data as Record<string, unknown>
          const formatted = [
            `🔀 Forked ${owner}/${repo} successfully!`,
            '',
            `**New fork:** ${fork.full_name}`,
            `**URL:** ${fork.html_url}`,
          ].join('\n')
          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_fork_repo', status: 'end', input: input as Record<string, unknown>, result: formatted, githubFork: fork } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_fork_repo', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Watch/subscribe to a repository
    betaTool({
      name: 'github_watch_repo',
      description:
        `Watch a GitHub repository to receive notifications about its activity.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          subscribed: {
            type: 'boolean',
            description: 'Whether to subscribe to notifications. Default is true.',
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_watch_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await watchRepository({ 
            owner, 
            repo,
            subscribed: input.subscribed ?? true,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_watch_repo', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const subscribed = input.subscribed ?? true
          const formatted = subscribed 
            ? `👁 Now watching ${owner}/${repo}. You'll receive notifications about activity.`
            : `Unwatched ${owner}/${repo}. You'll no longer receive notifications.`
          await sseHandler.sendToolEvent('github_watch_repo', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_watch_repo', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Get authenticated user info
    betaTool({
      name: 'github_get_me',
      description:
        'Get information about the authenticated GitHub user. Returns username, bio, public repos count, followers, and more.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const result = await getAuthenticatedUser()
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_get_me', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const user = result.data as Record<string, unknown>
          const formatted = [
            `# GitHub User: @${user.login}`,
            '',
            user.name ? `**Name:** ${user.name}` : '',
            user.bio ? `**Bio:** ${user.bio}` : '',
            `**Public Repos:** ${user.public_repos}`,
            `**Followers:** ${user.followers} | **Following:** ${user.following}`,
            `**Profile:** ${user.html_url}`,
            user.company ? `**Company:** ${user.company}` : '',
            user.location ? `**Location:** ${user.location}` : '',
          ].filter(Boolean).join('\n')
          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_get_me', status: 'end', input: input as Record<string, unknown>, result: formatted, githubUser: user } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_get_me', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // List workflow runs
    betaTool({
      name: 'github_list_workflow_runs',
      description:
        `List GitHub Actions workflow runs for a repository. Shows recent CI/CD runs with their status, conclusion, and timing.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          branch: {
            type: 'string',
            description: 'Filter by branch name.',
          },
          status: {
            type: 'string',
            enum: ['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending'],
            description: 'Filter by workflow run status.',
          },
          per_page: {
            type: 'number',
            description: 'Number of runs to return (1-100). Default is 10.',
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_workflow_runs', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listWorkflowRuns({ 
            owner, 
            repo,
            branch: input.branch,
            status: input.status as 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending' | undefined,
            per_page: input.per_page,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_list_workflow_runs', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const data = result.data as { total_count: number; workflow_runs: Record<string, unknown>[] }
          const runs = data.workflow_runs || []
          const formatted = [
            `# Workflow Runs for ${owner}/${repo} (${data.total_count} total)`,
            '',
            ...runs.slice(0, 10).map((run, i) => {
              const statusEmoji = run.conclusion === 'success' ? '✅' : run.conclusion === 'failure' ? '❌' : run.status === 'in_progress' ? '🔄' : '⏳'
              return [
                `## ${i + 1}. ${statusEmoji} ${run.name}`,
                `- **Status:** ${run.status}${run.conclusion ? ` (${run.conclusion})` : ''}`,
                `- **Branch:** ${(run.head_branch as string) || 'N/A'}`,
                `- **Triggered:** ${run.created_at}`,
                `- **URL:** ${run.html_url}`,
                '',
              ].join('\n')
            }),
          ].join('\n')
          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_list_workflow_runs', status: 'end', input: input as Record<string, unknown>, result: formatted, githubWorkflowRuns: runs } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_list_workflow_runs', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // List workflows
    betaTool({
      name: 'github_list_workflows',
      description:
        `List GitHub Actions workflows defined in a repository. Shows workflow names, IDs, and states.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
        },
        required: focusedRepo ? [] as const : ['owner', 'repo'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_workflows', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listWorkflows({ owner, repo })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_list_workflows', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const data = result.data as { total_count: number; workflows: Record<string, unknown>[] }
          const workflows = data.workflows || []
          const formatted = [
            `# Workflows for ${owner}/${repo}`,
            '',
            ...workflows.map((wf, i) => {
              const stateEmoji = wf.state === 'active' ? '✅' : '⏸'
              return `${i + 1}. ${stateEmoji} **${wf.name}** (ID: ${wf.id}) - ${wf.path}`
            }),
          ].join('\n')
          await sseHandler.sendToolEvent('github_list_workflows', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_list_workflows', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // Trigger a workflow
    betaTool({
      name: 'github_trigger_workflow',
      description:
        `Manually trigger a GitHub Actions workflow dispatch event. The workflow must have workflow_dispatch trigger configured.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          workflow_id: {
            type: 'string',
            description: 'The workflow ID or filename (e.g., "ci.yml" or "12345").',
          },
          ref: {
            type: 'string',
            description: 'The git reference (branch or tag) to run the workflow on.',
          },
          inputs: {
            type: 'object',
            description: 'Optional workflow inputs as key-value pairs.',
          },
        },
        required: focusedRepo ? ['workflow_id', 'ref'] as const : ['owner', 'repo', 'workflow_id', 'ref'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_trigger_workflow', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await triggerWorkflow({ 
            owner, 
            repo,
            workflow_id: input.workflow_id,
            ref: input.ref,
            inputs: input.inputs as Record<string, string> | undefined,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_trigger_workflow', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const formatted = `🚀 Workflow "${input.workflow_id}" triggered on ${input.ref}! Check the Actions tab for progress.`
          await sseHandler.sendToolEvent('github_trigger_workflow', 'end', input as Record<string, unknown>, formatted)
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_trigger_workflow', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // List PR files
    betaTool({
      name: 'github_list_pr_files',
      description:
        `List files changed in a pull request. Shows filenames, status (added/modified/removed), and change counts.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          pull_number: {
            type: 'number',
            description: 'The pull request number.',
          },
        },
        required: focusedRepo ? ['pull_number'] as const : ['owner', 'repo', 'pull_number'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_pr_files', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listPullRequestFiles({ 
            owner, 
            repo,
            pull_number: input.pull_number,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_list_pr_files', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const files = result.data as Record<string, unknown>[]
          const formatted = [
            `# Files Changed in PR #${input.pull_number}`,
            '',
            ...files.map((file) => {
              const statusIcon = file.status === 'added' ? '➕' : file.status === 'removed' ? '➖' : '📝'
              return `${statusIcon} **${file.filename}** (+${file.additions}/-${file.deletions})`
            }),
          ].join('\n')
          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_list_pr_files', status: 'end', input: input as Record<string, unknown>, result: formatted, githubPRFiles: files } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_list_pr_files', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // List issue comments
    betaTool({
      name: 'github_list_issue_comments',
      description:
        `List comments on a GitHub issue or pull request. Returns comment bodies, authors, and timestamps.${focusedRepo ? ` Defaults to focused repo: ${focusedRepo.fullName}` : ''}`,
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: `The repository owner.${focusedRepo ? ` Optional - defaults to "${focusedRepo.owner}"` : ''}`,
          },
          repo: {
            type: 'string',
            description: `The repository name.${focusedRepo ? ` Optional - defaults to "${focusedRepo.name}"` : ''}`,
          },
          issue_number: {
            type: 'number',
            description: 'The issue or pull request number.',
          },
          per_page: {
            type: 'number',
            description: 'Number of comments to return (1-100). Default is 30.',
          },
        },
        required: focusedRepo ? ['issue_number'] as const : ['owner', 'repo', 'issue_number'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        try {
          const { owner, repo } = resolveRepo(input)
          if (!owner || !repo) {
            const errorMsg = 'Error: owner and repo are required. No focused repository is set.'
            await sseHandler.sendToolEvent('github_list_issue_comments', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = await listIssueComments({ 
            owner, 
            repo,
            issue_number: input.issue_number,
            per_page: input.per_page,
          })
          if (!result.successful) {
            const errorMsg = `GitHub API error: ${result.error || 'Unknown error'}`
            await sseHandler.sendToolEvent('github_list_issue_comments', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const comments = result.data as Record<string, unknown>[]
          if (!comments || comments.length === 0) {
            const formatted = `No comments on #${input.issue_number}`
            await sseHandler.sendToolEvent('github_list_issue_comments', 'end', input as Record<string, unknown>, formatted)
            return formatted
          }
          const formatted = [
            `# Comments on #${input.issue_number} (${comments.length} comments)`,
            '',
            ...comments.map((comment, i) => {
              const user = comment.user as Record<string, unknown>
              const body = (comment.body as string || '').slice(0, 500)
              return [
                `## ${i + 1}. @${user?.login || 'unknown'} (${comment.created_at})`,
                body + (body.length >= 500 ? '...' : ''),
                '',
              ].join('\n')
            }),
          ].join('\n')
          await sseHandler.sendSSE({
            choices: [{ delta: { tool_use: { name: 'github_list_issue_comments', status: 'end', input: input as Record<string, unknown>, result: formatted, githubComments: comments } } }],
          })
          return formatted
        } catch (error) {
          const errorMsg = `GitHub error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('github_list_issue_comments', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),
  ]
}

