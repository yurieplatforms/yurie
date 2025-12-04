/**
 * Runnable Tools
 *
 * Creates tool definitions with run functions for the Anthropic SDK's tool runner.
 * Uses betaTool helper for type-safe tool definitions.
 *
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
 */

import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'

// Helper to avoid TypeScript's overly complex union type error with large tool arrays
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createToolsArray = (...tools: any[]): any[] => tools.flat()
import { evaluateMathExpression } from '@/lib/tools/handlers'
import {
  exaSearch,
  exaFindSimilar,
  exaAnswer,
  formatExaResultsForLLM,
  formatExaAnswerForLLM,
  isExaAvailable,
} from '@/lib/tools/exa'
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
  listPullRequestCommits,
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
  // Spotify tools
  isSpotifyToolsAvailable,
  setSpotifyToolContext,
  findSpotifyConnectionId,
  getPlaybackState,
  getCurrentlyPlayingTrack,
  startPlayback,
  pausePlayback,
  skipToNext,
  skipToPrevious,
  seekToPosition,
  setVolume,
  setRepeatMode,
  toggleShuffle,
  transferPlayback,
  getAvailableDevices,
  getQueue,
  addToQueue,
  search as spotifySearch,
  getTrack,
  getTrackAudioFeatures,
  getAlbum,
  getAlbumTracks,
  getNewReleases,
  getArtist,
  getArtistTopTracks,
  getArtistAlbums,
  getRelatedArtists,
  getPlaylist,
  getPlaylistTracks,
  createPlaylist,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  updatePlaylistDetails,
  updatePlaylistItems,
  getCurrentUserPlaylists,
  getUserPlaylists,
  getFeaturedPlaylists,
  getCategoryPlaylists,
  getCurrentUserProfile,
  getSavedTracks,
  saveTracks,
  removeSavedTracks,
  checkSavedTracks,
  getSavedAlbums,
  saveAlbums,
  removeSavedAlbums,
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  getRecommendations,
  getAvailableGenres,
  getBrowseCategories,
  followPlaylist,
  unfollowPlaylist,
  formatTrackForLLM,
  formatAlbumForLLM,
  formatArtistForLLM,
  formatPlaylistForLLM,
  formatPlaybackForLLM,
  formatSearchResultsForLLM,
} from '@/lib/composio'
import type { ExaSearchInput, ExaFindSimilarInput, ExaAnswerInput } from '@/lib/tools/exa'
import type { ExaSearchCategory, ExaSearchType } from '@/lib/types'
import type { SSEHandler } from './sse-handler'

/**
 * Focused repository context for GitHub tools.
 * When set, tools can use these defaults for owner/repo parameters.
 */
export type FocusedRepoContext = {
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
 * Creates runnable tools with access to SSE handlers for real-time updates.
 * Optionally sets up GitHub context for authenticated users.
 *
 * @param sseHandler - SSE handler for streaming tool events
 * @param userId - Optional user ID for GitHub tool context
 * @param focusedRepo - Optional focused repository for default context
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createRunnableTools(
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

  // Set up Spotify context if user is authenticated and Composio is available
  if (userId && isSpotifyToolsAvailable()) {
    const connectedAccountId = await findSpotifyConnectionId(userId)
    setSpotifyToolContext({
      userId,
      connectedAccountId,
    })
    if (connectedAccountId) {
      console.log(`[Spotify Tools] Context set for user ${userId} with connection ${connectedAccountId}`)
    }
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

  return createToolsArray(
    // Calculator tool for mathematical expressions
    betaTool({
      name: 'calculator',
      description:
        'Evaluates mathematical expressions and returns the numerical result. Use this tool for ANY math calculation beyond simple mental arithmetic, including percentages, unit conversions, trigonometry, and complex formulas. The tool supports basic arithmetic operators (+, -, *, /), exponentiation (**), parentheses for grouping, and common math functions (sqrt, sin, cos, tan, asin, acos, atan, log, log10, log2, exp, pow, abs, floor, ceil, round, min, max, random) as well as constants (pi, e, PI, E). Do NOT use this tool for non-numeric operations, string manipulation, or when the user is asking about math concepts rather than computing a specific value.',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate. Use standard math notation with function calls for complex operations. Examples: "2 + 2", "sqrt(16)", "sin(pi/2)", "max(1, 2, 3)", "log(100)/log(10)", "(5 + 3) * 2 ** 3"',
          },
        },
        required: ['expression'] as const,
        additionalProperties: false,
      },
      run: async (input) => {
        const expression = input.expression
        try {
          if (!expression || typeof expression !== 'string' || expression.trim().length === 0) {
            const errorMsg = 'Error: Missing or empty "expression" parameter. Please provide a mathematical expression as a string.'
            await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, errorMsg)
            return errorMsg
          }
          const result = evaluateMathExpression(expression)
          const resultStr = `${result}`
          await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, resultStr)
          return resultStr
        } catch (error) {
          const errorMsg = `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
          await sseHandler.sendToolEvent('calculator', 'end', input as Record<string, unknown>, errorMsg)
          return errorMsg
        }
      },
    }),

    // EXA semantic web search tool - POWERFUL research tool
    // Only include if EXA API key is configured
    // @see https://docs.exa.ai/reference/search
    // @see https://docs.exa.ai/reference/how-exa-search-works
    ...(isExaAvailable()
      ? [
          betaTool({
            name: 'exa_search',
            description:
              'POWERFUL semantic/neural web search using EXA API. Returns up to 100 results with fresh content via livecrawling. Use for: deep research, finding specific content types (news, research papers, companies, GitHub repos, tweets), date-filtered searches, academic/technical content. EXA understands semantic meaning, not keywords. \n\nGUIDELINES:\n- Use "type: neural" (default) for broad concepts, "how to", and research topics.\n- Use "type: keyword" for specific entity names, error codes, or exact phrases.\n- Use "livecrawl: always" for BREAKING news or real-time data.\n- COMBINE: exa_search for research → web_fetch for full content from best URLs.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description:
                    'The search query. EXA uses semantic search, so natural language queries work well. Be descriptive about what you\'re looking for.',
                },
                type: {
                  type: 'string',
                  enum: ['auto', 'neural', 'keyword', 'fast', 'deep'],
                  description:
                    'Search type: "auto" (default, best overall), "neural" (AI semantic), "keyword" (exact matching), "fast" (<425ms p50, for real-time), "deep" (comprehensive with query expansion, BEST for research).',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'tweet',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter results by content type. Use "research paper" for academic, "news" for current events, "github" for code, "tweet" for social media.',
                },
                numResults: {
                  type: 'number',
                  description:
                    'Number of results to return (1-100). Default is 10. Use higher values (20-50) for comprehensive research.',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published after this date (ISO 8601 format, e.g., "2024-01-01"). Great for recent content.',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only include results published before this date (ISO 8601 format).',
                },
                startCrawlDate: {
                  type: 'string',
                  description:
                    'Only include results discovered by EXA after this date (ISO 8601). Use for newest indexed content.',
                },
                endCrawlDate: {
                  type: 'string',
                  description:
                    'Only include results discovered by EXA before this date (ISO 8601).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only search these domains (e.g., ["arxiv.org", "github.com", "nature.com"]).',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude results from these domains.',
                },
                includeText: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Required text that MUST appear in results (up to 5 words). Filter for specific terms.',
                },
                excludeText: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Text that must NOT appear in results (up to 5 words). Filter out unwanted content.',
                },
                livecrawl: {
                  type: 'string',
                  enum: ['always', 'preferred', 'fallback', 'never'],
                  description:
                    'Content freshness mode: "always" (slowest but freshest - for real-time/breaking news), "preferred" (default - fresh with fallback), "fallback" (cache first), "never" (fastest, cached only).',
                },
                additionalQueries: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Additional query variations for deep search. Only works with type="deep". Expands search coverage.',
                },
                useHighlights: {
                  type: 'boolean',
                  description:
                    'Get key highlights/excerpts from content (default: true). Recommended for focused, relevant context.',
                },
                useSummary: {
                  type: 'boolean',
                  description:
                    'Get AI-generated summary of each result. Useful for quick understanding without reading full text.',
                },
                maxCharacters: {
                  type: 'number',
                  description:
                    'Maximum characters for text content per result (default: 3000). Increase for more context.',
                },
              },
              required: ['query'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const searchInput: ExaSearchInput = {
                query: input.query,
                type: input.type as ExaSearchType | undefined,
                category: input.category as ExaSearchCategory | undefined,
                numResults: input.numResults,
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                startCrawlDate: input.startCrawlDate,
                endCrawlDate: input.endCrawlDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                includeText: input.includeText,
                excludeText: input.excludeText,
                livecrawl: input.livecrawl as ExaSearchInput['livecrawl'],
                additionalQueries: input.additionalQueries,
                useHighlights: input.useHighlights,
                useSummary: input.useSummary,
                maxCharacters: input.maxCharacters,
              }

              try {
                if (!searchInput.query || searchInput.query.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "query" parameter. Please provide a search query.'
                  await sseHandler.sendToolEvent('exa_search', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaSearch(searchInput)
                const formattedResult = formatExaResultsForLLM(result)

                // Send SSE event with structured EXA search data
                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_search',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaSearch: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA search error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_search', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // EXA Find Similar - discover related content from URLs
          // @see https://docs.exa.ai/reference/find-similar-links
          betaTool({
            name: 'exa_find_similar',
            description:
              'Find up to 100 similar pages to a given URL. Perfect for discovering related articles, research papers, competitors, alternative sources, or expanding on a topic. Returns semantically similar pages from across the web with fresh content via livecrawling. Use after finding a great source to expand research.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description:
                    'The URL to find similar content for. Can be any webpage, article, or document.',
                },
                numResults: {
                  type: 'number',
                  description:
                    'Number of similar results to return (1-100). Default is 10. Use higher values for comprehensive research.',
                },
                excludeSourceDomain: {
                  type: 'boolean',
                  description:
                    'Exclude results from the same domain as the input URL. Default is true.',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'tweet',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter similar results by content type.',
                },
                livecrawl: {
                  type: 'string',
                  enum: ['always', 'preferred', 'fallback', 'never'],
                  description:
                    'Content freshness: "always" (freshest), "preferred" (default - fresh with fallback), "fallback" (cache first), "never" (fastest).',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only include similar content published after this date (ISO 8601).',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only include similar content published before this date (ISO 8601).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only find similar content from these domains.',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude similar content from these domains.',
                },
                useHighlights: {
                  type: 'boolean',
                  description:
                    'Get key highlights from similar content. Default is true.',
                },
                useSummary: {
                  type: 'boolean',
                  description:
                    'Get AI-generated summaries of similar content.',
                },
                maxCharacters: {
                  type: 'number',
                  description:
                    'Maximum characters for text content per result (default: 3000).',
                },
              },
              required: ['url'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const similarInput: ExaFindSimilarInput = {
                url: input.url,
                numResults: input.numResults,
                excludeSourceDomain: input.excludeSourceDomain,
                category: input.category as ExaSearchCategory | undefined,
                livecrawl: input.livecrawl as ExaFindSimilarInput['livecrawl'],
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                useHighlights: input.useHighlights,
                useSummary: input.useSummary,
                maxCharacters: input.maxCharacters,
              }

              try {
                if (!similarInput.url || similarInput.url.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "url" parameter. Please provide a URL to find similar content.'
                  await sseHandler.sendToolEvent('exa_find_similar', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaFindSimilar(similarInput)
                const formattedResult = formatExaResultsForLLM(result)

                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_find_similar',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaSearch: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA find similar error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_find_similar', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // EXA Answer - direct question answering with sources
          // @see https://docs.exa.ai/reference/answer
          betaTool({
            name: 'exa_answer',
            description:
              'Get a direct, synthesized answer to a question with cited sources. EXA searches the web, analyzes content, and provides a comprehensive answer. Best for: single factual questions ("Who is CEO of X?", "When was Y released?"), summaries of recent events, or quick explanations. NOT for deep multi-faceted research (use exa_search for that). Returns the answer plus source citations.',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description:
                    'The question to answer. Be specific and clear for best results.',
                },
                category: {
                  type: 'string',
                  enum: [
                    'company',
                    'research paper',
                    'news',
                    'pdf',
                    'github',
                    'tweet',
                    'personal site',
                    'linkedin profile',
                    'financial report',
                  ],
                  description:
                    'Filter sources by content type for more focused answers.',
                },
                startPublishedDate: {
                  type: 'string',
                  description:
                    'Only use sources published after this date (ISO 8601). Great for recent information.',
                },
                endPublishedDate: {
                  type: 'string',
                  description:
                    'Only use sources published before this date (ISO 8601).',
                },
                includeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Only use sources from these domains (e.g., ["wikipedia.org", "arxiv.org"]).',
                },
                excludeDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'Exclude sources from these domains.',
                },
                includeText: {
                  type: 'boolean',
                  description:
                    'Include full text from source citations. Default is true.',
                },
              },
              required: ['question'] as const,
              additionalProperties: false,
            },
            run: async (input) => {
              const answerInput: ExaAnswerInput = {
                question: input.question,
                category: input.category as ExaSearchCategory | undefined,
                startPublishedDate: input.startPublishedDate,
                endPublishedDate: input.endPublishedDate,
                includeDomains: input.includeDomains,
                excludeDomains: input.excludeDomains,
                includeText: input.includeText,
              }

              try {
                if (!answerInput.question || answerInput.question.trim().length === 0) {
                  const errorMsg = 'Error: Missing or empty "question" parameter. Please provide a question to answer.'
                  await sseHandler.sendToolEvent('exa_answer', 'end', input as Record<string, unknown>, errorMsg)
                  return errorMsg
                }

                const result = await exaAnswer(answerInput)
                const formattedResult = formatExaAnswerForLLM(result)

                await sseHandler.sendSSE({
                  choices: [
                    {
                      delta: {
                        tool_use: {
                          name: 'exa_answer',
                          status: 'end',
                          input: input as Record<string, unknown>,
                          result: formattedResult,
                          exaAnswer: result,
                        },
                      },
                    },
                  ],
                })

                return formattedResult
              } catch (error) {
                const errorMsg = `EXA answer error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('exa_answer', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),
        ]
      : []),

    // ========================================================================
    // GitHub Tools via Composio
    // @see https://docs.composio.dev/toolkits/github
    // ========================================================================
    ...(isGitHubToolsAvailable()
      ? [
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
          betaTool({
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
      : []),

    // Spotify tools via Composio
    ...(isSpotifyToolsAvailable()
      ? [
          // Playback State
          betaTool({
            name: 'spotify_get_playback_state',
            description: 'Get information about the user\'s current playback state, including track, artist, album, and device.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getPlaybackState()
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const formatted = formatPlaybackForLLM(result.data as Record<string, unknown>)
                await sseHandler.sendToolEvent('spotify_get_playback_state', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_playback_state', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),
          
          // Start/Resume Playback
          betaTool({
            name: 'spotify_start_playback',
            description: 'Start or resume playback. Can play a specific track, album, or playlist by URI.',
            inputSchema: {
              type: 'object',
              properties: {
                context_uri: { type: 'string', description: 'Spotify URI of the context to play (album, artist, playlist).' },
                uris: { type: 'array', items: { type: 'string' }, description: 'Array of track URIs to play.' },
                device_id: { type: 'string', description: 'The device to play on.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await startPlayback(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Playback started/resumed.'
                await sseHandler.sendToolEvent('spotify_start_playback', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_start_playback', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Pause Playback
          betaTool({
            name: 'spotify_pause_playback',
            description: 'Pause playback on the user\'s active device.',
            inputSchema: {
              type: 'object',
              properties: {
                device_id: { type: 'string', description: 'The device to pause.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await pausePlayback(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Playback paused.'
                await sseHandler.sendToolEvent('spotify_pause_playback', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_pause_playback', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Skip to Next
          betaTool({
            name: 'spotify_skip_next',
            description: 'Skip to the next track in the user\'s queue.',
            inputSchema: {
              type: 'object',
              properties: {
                device_id: { type: 'string', description: 'The device to use.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await skipToNext(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Skipped to next track.'
                await sseHandler.sendToolEvent('spotify_skip_next', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_skip_next', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Skip to Previous
          betaTool({
            name: 'spotify_skip_previous',
            description: 'Skip to the previous track in the user\'s queue.',
            inputSchema: {
              type: 'object',
              properties: {
                device_id: { type: 'string', description: 'The device to use.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await skipToPrevious(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Skipped to previous track.'
                await sseHandler.sendToolEvent('spotify_skip_previous', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_skip_previous', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Search
          betaTool({
            name: 'spotify_search',
            description: 'Search for tracks, artists, albums, playlists, etc.',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Search query.' },
                type: { 
                  type: 'array', 
                  items: { type: 'string', enum: ['album', 'artist', 'playlist', 'track', 'show', 'episode', 'audiobook'] },
                  description: 'Types of items to search for.',
                },
                limit: { type: 'number', description: 'Max number of results (default: 20).' },
              },
              required: ['q', 'type'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await spotifySearch(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const formatted = formatSearchResultsForLLM(result.data as Record<string, unknown>)
                await sseHandler.sendToolEvent('spotify_search', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_search', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Queue
          betaTool({
            name: 'spotify_get_queue',
            description: 'Get the user\'s current playback queue.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getQueue()
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const current = data.currently_playing ? `Currently Playing: ${data.currently_playing.name} - ${data.currently_playing.artists[0].name}` : 'Nothing playing'
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const next = data.queue ? data.queue.slice(0, 10).map((t: any, i: number) => `${i+1}. ${t.name} - ${t.artists[0].name}`).join('\n') : 'Empty queue'
                const formatted = `${current}\n\nNext Up:\n${next}`
                
                await sseHandler.sendToolEvent('spotify_get_queue', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_queue', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get User Playlists
          betaTool({
            name: 'spotify_get_my_playlists',
            description: 'Get the current user\'s playlists.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of playlists.' },
                offset: { type: 'number', description: 'Offset for pagination.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getCurrentUserPlaylists(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                
                if (items.length === 0) {
                  const msg = 'No playlists found on your Spotify account.'
                  await sseHandler.sendToolEvent('spotify_get_my_playlists', 'end', input as Record<string, unknown>, msg)
                  return msg
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((p: any) => `- ${p.name} (ID: ${p.id}, Tracks: ${p.tracks.total})`).join('\n')
                await sseHandler.sendToolEvent('spotify_get_my_playlists', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_my_playlists', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Saved Tracks (Liked Songs)
          betaTool({
            name: 'spotify_get_saved_tracks',
            description: 'Get the current user\'s saved tracks (Liked Songs).',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of tracks (default 20).' },
                offset: { type: 'number', description: 'Offset for pagination.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getSavedTracks(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                
                if (items.length === 0) {
                  const msg = 'No saved tracks found.'
                  await sseHandler.sendToolEvent('spotify_get_saved_tracks', 'end', input as Record<string, unknown>, msg)
                  return msg
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((item: any) => {
                  const t = item.track
                  return `- ${t.name} by ${t.artists[0].name} (Added: ${item.added_at})`
                }).join('\n')
                
                await sseHandler.sendToolEvent('spotify_get_saved_tracks', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_saved_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Available Devices
          betaTool({
            name: 'spotify_get_devices',
            description: 'Get information about active available devices.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getAvailableDevices()
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const devices = data.devices || []
                
                if (devices.length === 0) {
                  const msg = 'No active devices found. Please open Spotify on a device.'
                  await sseHandler.sendToolEvent('spotify_get_devices', 'end', input as Record<string, unknown>, msg)
                  return msg
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = devices.map((d: any) => 
                  `- ${d.name} (${d.type}): ${d.is_active ? 'Active 🟢' : 'Inactive'} (Vol: ${d.volume_percent}%)`
                ).join('\n')
                
                await sseHandler.sendToolEvent('spotify_get_devices', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_devices', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),
          
          // Get Recommendations
          betaTool({
            name: 'spotify_get_recommendations',
            description: 'Get recommendations based on seeds (artists, genres, tracks).',
            inputSchema: {
              type: 'object',
              properties: {
                seed_artists: { type: 'array', items: { type: 'string' } },
                seed_genres: { type: 'array', items: { type: 'string' } },
                seed_tracks: { type: 'array', items: { type: 'string' } },
                limit: { type: 'number' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getRecommendations(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tracks = (result.data as any).tracks || []
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = tracks.map((t: any) => `- ${t.name} by ${t.artists[0].name} (URI: ${t.uri})`).join('\n')
                await sseHandler.sendToolEvent('spotify_get_recommendations', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_recommendations', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Set Volume
          betaTool({
            name: 'spotify_set_volume',
            description: 'Set the volume for the user\'s current playback device (0-100). Requires Spotify Premium.',
            inputSchema: {
              type: 'object',
              properties: {
                volume_percent: { type: 'number', description: 'Volume percentage (0-100).' },
                device_id: { type: 'string', description: 'The device to control.' },
              },
              required: ['volume_percent'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await setVolume(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Volume set to ${(input as any).volume_percent}%.`
                await sseHandler.sendToolEvent('spotify_set_volume', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_set_volume', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Seek to Position
          betaTool({
            name: 'spotify_seek',
            description: 'Seek to a position in the currently playing track. Requires Spotify Premium.',
            inputSchema: {
              type: 'object',
              properties: {
                position_ms: { type: 'number', description: 'Position in milliseconds to seek to.' },
                device_id: { type: 'string', description: 'The device to control.' },
              },
              required: ['position_ms'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await seekToPosition(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const posMs = (input as any).position_ms
                const mins = Math.floor(posMs / 60000)
                const secs = Math.floor((posMs % 60000) / 1000)
                const msg = `Seeked to ${mins}:${secs.toString().padStart(2, '0')}.`
                await sseHandler.sendToolEvent('spotify_seek', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_seek', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Set Repeat Mode
          betaTool({
            name: 'spotify_set_repeat',
            description: 'Set the repeat mode for playback. Requires Spotify Premium.',
            inputSchema: {
              type: 'object',
              properties: {
                state: { 
                  type: 'string', 
                  enum: ['track', 'context', 'off'],
                  description: 'Repeat mode: "track" (repeat one), "context" (repeat all), or "off".' 
                },
                device_id: { type: 'string', description: 'The device to control.' },
              },
              required: ['state'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await setRepeatMode(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const state = (input as any).state
                const modeText = state === 'track' ? 'Repeat One' : state === 'context' ? 'Repeat All' : 'Off'
                const msg = `Repeat mode set to: ${modeText}.`
                await sseHandler.sendToolEvent('spotify_set_repeat', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_set_repeat', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Toggle Shuffle
          betaTool({
            name: 'spotify_toggle_shuffle',
            description: 'Toggle shuffle on or off for playback. Requires Spotify Premium.',
            inputSchema: {
              type: 'object',
              properties: {
                state: { type: 'boolean', description: 'True to enable shuffle, false to disable.' },
                device_id: { type: 'string', description: 'The device to control.' },
              },
              required: ['state'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await toggleShuffle(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Shuffle ${(input as any).state ? 'enabled' : 'disabled'}.`
                await sseHandler.sendToolEvent('spotify_toggle_shuffle', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_toggle_shuffle', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Add to Queue
          betaTool({
            name: 'spotify_add_to_queue',
            description: 'Add a track or episode to the user\'s playback queue. Requires Spotify Premium.',
            inputSchema: {
              type: 'object',
              properties: {
                uri: { type: 'string', description: 'Spotify URI of the track or episode (e.g., spotify:track:xxx).' },
                device_id: { type: 'string', description: 'The device to add to queue.' },
              },
              required: ['uri'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await addToQueue(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Added to queue successfully.'
                await sseHandler.sendToolEvent('spotify_add_to_queue', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_add_to_queue', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Track Info
          betaTool({
            name: 'spotify_get_track',
            description: 'Get detailed information about a specific track.',
            inputSchema: {
              type: 'object',
              properties: {
                track_id: { type: 'string', description: 'Spotify track ID.' },
              },
              required: ['track_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getTrack((input as any).track_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const formatted = formatTrackForLLM(result.data as Record<string, unknown>)
                await sseHandler.sendToolEvent('spotify_get_track', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_track', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Album Info
          betaTool({
            name: 'spotify_get_album',
            description: 'Get detailed information about a specific album.',
            inputSchema: {
              type: 'object',
              properties: {
                album_id: { type: 'string', description: 'Spotify album ID.' },
              },
              required: ['album_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getAlbum((input as any).album_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const formatted = formatAlbumForLLM(result.data as Record<string, unknown>)
                await sseHandler.sendToolEvent('spotify_get_album', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_album', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Artist Info
          betaTool({
            name: 'spotify_get_artist',
            description: 'Get detailed information about a specific artist.',
            inputSchema: {
              type: 'object',
              properties: {
                artist_id: { type: 'string', description: 'Spotify artist ID.' },
              },
              required: ['artist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getArtist((input as any).artist_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const formatted = formatArtistForLLM(result.data as Record<string, unknown>)
                await sseHandler.sendToolEvent('spotify_get_artist', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_artist', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Artist Top Tracks
          betaTool({
            name: 'spotify_get_artist_top_tracks',
            description: 'Get an artist\'s top tracks by country.',
            inputSchema: {
              type: 'object',
              properties: {
                artist_id: { type: 'string', description: 'Spotify artist ID.' },
                market: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g., "US").' },
              },
              required: ['artist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await getArtistTopTracks(inp.artist_id, inp.market || 'US')
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tracks = (result.data as any).tracks || []
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = tracks.map((t: any, i: number) => 
                  `${i + 1}. ${t.name} (${t.album.name}) - Popularity: ${t.popularity}`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_artist_top_tracks', 'end', input as Record<string, unknown>, formatted)
                return formatted || 'No top tracks found.'
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_artist_top_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Currently Playing Track
          betaTool({
            name: 'spotify_get_currently_playing',
            description: 'Get the track currently playing on the user\'s Spotify account.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getCurrentlyPlayingTrack()
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                if (!data || !data.item) {
                  const msg = 'Nothing is currently playing.'
                  await sseHandler.sendToolEvent('spotify_get_currently_playing', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                const track = data.item
                const artists = track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown'
                const progressMs = data.progress_ms || 0
                const durationMs = track.duration_ms || 0
                const progressMin = Math.floor(progressMs / 60000)
                const progressSec = Math.floor((progressMs % 60000) / 1000)
                const durationMin = Math.floor(durationMs / 60000)
                const durationSec = Math.floor((durationMs % 60000) / 1000)
                
                const formatted = `Now Playing: ${track.name} by ${artists}\nAlbum: ${track.album?.name || 'Unknown'}\nProgress: ${progressMin}:${progressSec.toString().padStart(2, '0')} / ${durationMin}:${durationSec.toString().padStart(2, '0')}\nURI: ${track.uri}`
                await sseHandler.sendToolEvent('spotify_get_currently_playing', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_currently_playing', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Recently Played
          betaTool({
            name: 'spotify_get_recently_played',
            description: 'Get the user\'s recently played tracks.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of tracks to return (default 20, max 50).' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getRecentlyPlayed(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No recently played tracks found.'
                  await sseHandler.sendToolEvent('spotify_get_recently_played', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((item: any, i: number) => {
                  const t = item.track
                  const playedAt = new Date(item.played_at).toLocaleString()
                  return `${i + 1}. ${t.name} by ${t.artists[0]?.name || 'Unknown'} (Played: ${playedAt})`
                }).join('\n')
                await sseHandler.sendToolEvent('spotify_get_recently_played', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_recently_played', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get User Profile
          betaTool({
            name: 'spotify_get_my_profile',
            description: 'Get the current user\'s Spotify profile information.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getCurrentUserProfile()
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const formatted = `# ${data.display_name || 'Spotify User'}\n\n**Email:** ${data.email || 'N/A'}\n**Country:** ${data.country || 'N/A'}\n**Product:** ${data.product || 'free'}\n**Followers:** ${data.followers?.total?.toLocaleString() || 0}\n**Profile URL:** ${data.external_urls?.spotify || 'N/A'}`
                await sseHandler.sendToolEvent('spotify_get_my_profile', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_my_profile', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Top Artists
          betaTool({
            name: 'spotify_get_top_artists',
            description: 'Get the current user\'s top artists based on listening history.',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: { 
                  type: 'string', 
                  enum: ['short_term', 'medium_term', 'long_term'],
                  description: 'Time range: short_term (~4 weeks), medium_term (~6 months), long_term (all time).'
                },
                limit: { type: 'number', description: 'Max number of artists (default 20).' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getTopArtists(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No top artists found.'
                  await sseHandler.sendToolEvent('spotify_get_top_artists', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((a: any, i: number) => 
                  `${i + 1}. ${a.name} (${a.genres?.slice(0, 2).join(', ') || 'N/A'}) - Popularity: ${a.popularity}`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_top_artists', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_top_artists', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Top Tracks
          betaTool({
            name: 'spotify_get_top_tracks',
            description: 'Get the current user\'s top tracks based on listening history.',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: { 
                  type: 'string', 
                  enum: ['short_term', 'medium_term', 'long_term'],
                  description: 'Time range: short_term (~4 weeks), medium_term (~6 months), long_term (all time).'
                },
                limit: { type: 'number', description: 'Max number of tracks (default 20).' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getTopTracks(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No top tracks found.'
                  await sseHandler.sendToolEvent('spotify_get_top_tracks', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((t: any, i: number) => 
                  `${i + 1}. ${t.name} by ${t.artists[0]?.name || 'Unknown'} - Popularity: ${t.popularity}`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_top_tracks', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_top_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Playlist Details
          betaTool({
            name: 'spotify_get_playlist',
            description: 'Get details of a specific playlist.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
              },
              required: ['playlist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getPlaylist((input as any).playlist_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const formatted = formatPlaylistForLLM(result.data as Record<string, unknown>)
                await sseHandler.sendToolEvent('spotify_get_playlist', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_playlist', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Create Playlist
          betaTool({
            name: 'spotify_create_playlist',
            description: 'Create a new playlist for the current user.',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name for the new playlist.' },
                description: { type: 'string', description: 'Description for the playlist.' },
                public: { type: 'boolean', description: 'Whether the playlist is public (default true).' },
              },
              required: ['name'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // First get the user's profile to get their user_id
                const profileResult = await getCurrentUserProfile()
                if (!profileResult.successful) throw new Error(profileResult.error || 'Failed to get user profile')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const userId = (profileResult.data as any).id
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await createPlaylist({
                  user_id: userId,
                  name: inp.name,
                  description: inp.description,
                  public: inp.public,
                })
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const msg = `Created playlist: "${data.name}" (ID: ${data.id})\nURL: ${data.external_urls?.spotify || 'N/A'}`
                await sseHandler.sendToolEvent('spotify_create_playlist', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_create_playlist', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Add Tracks to Playlist
          betaTool({
            name: 'spotify_add_tracks_to_playlist',
            description: 'Add tracks to a playlist.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
                uris: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track URIs to add.' },
                position: { type: 'number', description: 'Position to insert tracks (0-based).' },
              },
              required: ['playlist_id', 'uris'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await addTracksToPlaylist(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Added ${(input as any).uris.length} track(s) to playlist.`
                await sseHandler.sendToolEvent('spotify_add_tracks_to_playlist', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_add_tracks_to_playlist', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Save Tracks to Library
          betaTool({
            name: 'spotify_save_tracks',
            description: 'Save tracks to the user\'s Liked Songs.',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs to save.' },
              },
              required: ['ids'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await saveTracks(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Saved ${(input as any).ids.length} track(s) to your library.`
                await sseHandler.sendToolEvent('spotify_save_tracks', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_save_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Available Genre Seeds
          betaTool({
            name: 'spotify_get_genres',
            description: 'Get a list of available genre seeds for recommendations.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getAvailableGenres()
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const genres = (result.data as any).genres || []
                const formatted = `Available genres for recommendations:\n${genres.join(', ')}`
                await sseHandler.sendToolEvent('spotify_get_genres', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_genres', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get New Releases
          betaTool({
            name: 'spotify_get_new_releases',
            description: 'Get new album releases featured in Spotify.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of albums (default 20).' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getNewReleases(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const albums = data.albums?.items || []
                if (albums.length === 0) {
                  const msg = 'No new releases found.'
                  await sseHandler.sendToolEvent('spotify_get_new_releases', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = albums.map((a: any, i: number) => {
                  const artists = a.artists?.map((ar: { name: string }) => ar.name).join(', ') || 'Unknown'
                  return `${i + 1}. ${a.name} by ${artists} (${a.release_date})`
                }).join('\n')
                await sseHandler.sendToolEvent('spotify_get_new_releases', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_new_releases', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Transfer Playback to Device
          betaTool({
            name: 'spotify_transfer_playback',
            description: 'Transfer playback to a different device. Requires Spotify Premium.',
            inputSchema: {
              type: 'object',
              properties: {
                device_ids: { type: 'array', items: { type: 'string' }, description: 'Array containing the device ID to transfer to.' },
                play: { type: 'boolean', description: 'If true, playback will start on the new device.' },
              },
              required: ['device_ids'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await transferPlayback(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Playback transferred to new device.'
                await sseHandler.sendToolEvent('spotify_transfer_playback', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_transfer_playback', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Track Audio Features
          betaTool({
            name: 'spotify_get_track_features',
            description: 'Get audio features for a track (danceability, energy, tempo, etc.).',
            inputSchema: {
              type: 'object',
              properties: {
                track_id: { type: 'string', description: 'Spotify track ID.' },
              },
              required: ['track_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getTrackAudioFeatures((input as any).track_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const formatted = `# Audio Features\n\n**Danceability:** ${(data.danceability * 100).toFixed(0)}%\n**Energy:** ${(data.energy * 100).toFixed(0)}%\n**Valence (Happiness):** ${(data.valence * 100).toFixed(0)}%\n**Tempo:** ${data.tempo?.toFixed(0)} BPM\n**Acousticness:** ${(data.acousticness * 100).toFixed(0)}%\n**Instrumentalness:** ${(data.instrumentalness * 100).toFixed(0)}%\n**Speechiness:** ${(data.speechiness * 100).toFixed(0)}%\n**Liveness:** ${(data.liveness * 100).toFixed(0)}%\n**Key:** ${data.key}\n**Mode:** ${data.mode === 1 ? 'Major' : 'Minor'}\n**Time Signature:** ${data.time_signature}/4`
                await sseHandler.sendToolEvent('spotify_get_track_features', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_track_features', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Album Tracks
          betaTool({
            name: 'spotify_get_album_tracks',
            description: 'Get the tracks from a specific album.',
            inputSchema: {
              type: 'object',
              properties: {
                album_id: { type: 'string', description: 'Spotify album ID.' },
                limit: { type: 'number', description: 'Max number of tracks (default 20).' },
              },
              required: ['album_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await getAlbumTracks(inp.album_id, { limit: inp.limit })
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No tracks found in this album.'
                  await sseHandler.sendToolEvent('spotify_get_album_tracks', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((t: any, i: number) => {
                  const artists = t.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown'
                  const mins = Math.floor(t.duration_ms / 60000)
                  const secs = Math.floor((t.duration_ms % 60000) / 1000)
                  return `${t.track_number || i + 1}. ${t.name} - ${artists} (${mins}:${secs.toString().padStart(2, '0')})`
                }).join('\n')
                await sseHandler.sendToolEvent('spotify_get_album_tracks', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_album_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Artist Albums
          betaTool({
            name: 'spotify_get_artist_albums',
            description: 'Get an artist\'s albums.',
            inputSchema: {
              type: 'object',
              properties: {
                artist_id: { type: 'string', description: 'Spotify artist ID.' },
                include_groups: { type: 'string', description: 'Filter by album type: album, single, appears_on, compilation (comma-separated).' },
                limit: { type: 'number', description: 'Max number of albums (default 20).' },
              },
              required: ['artist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await getArtistAlbums(inp.artist_id, { 
                  include_groups: inp.include_groups, 
                  limit: inp.limit 
                })
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No albums found for this artist.'
                  await sseHandler.sendToolEvent('spotify_get_artist_albums', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((a: any, i: number) => 
                  `${i + 1}. ${a.name} (${a.album_type}) - ${a.release_date} - ${a.total_tracks} tracks`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_artist_albums', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_artist_albums', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Related Artists
          betaTool({
            name: 'spotify_get_related_artists',
            description: 'Get artists similar to a given artist.',
            inputSchema: {
              type: 'object',
              properties: {
                artist_id: { type: 'string', description: 'Spotify artist ID.' },
              },
              required: ['artist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await getRelatedArtists((input as any).artist_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const artists = data.artists || []
                if (artists.length === 0) {
                  const msg = 'No related artists found.'
                  await sseHandler.sendToolEvent('spotify_get_related_artists', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = artists.map((a: any, i: number) => 
                  `${i + 1}. ${a.name} (${a.genres?.slice(0, 2).join(', ') || 'N/A'}) - ${a.followers?.total?.toLocaleString() || 0} followers`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_related_artists', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_related_artists', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Playlist Tracks
          betaTool({
            name: 'spotify_get_playlist_tracks',
            description: 'Get the tracks from a playlist.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
                limit: { type: 'number', description: 'Max number of tracks (default 20).' },
                offset: { type: 'number', description: 'Offset for pagination.' },
              },
              required: ['playlist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await getPlaylistTracks(inp.playlist_id, { limit: inp.limit, offset: inp.offset })
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No tracks found in this playlist.'
                  await sseHandler.sendToolEvent('spotify_get_playlist_tracks', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((item: any, i: number) => {
                  const t = item.track
                  if (!t) return `${i + 1}. [Unavailable track]`
                  const artists = t.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown'
                  return `${i + 1}. ${t.name} by ${artists} (URI: ${t.uri})`
                }).join('\n')
                await sseHandler.sendToolEvent('spotify_get_playlist_tracks', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_playlist_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Remove Tracks from Playlist
          betaTool({
            name: 'spotify_remove_playlist_items',
            description: 'Remove tracks from a playlist.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
                uris: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track URIs to remove.' },
              },
              required: ['playlist_id', 'uris'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await removeTracksFromPlaylist(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Removed ${(input as any).uris.length} track(s) from playlist.`
                await sseHandler.sendToolEvent('spotify_remove_playlist_items', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_remove_playlist_items', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Update Playlist Details
          betaTool({
            name: 'spotify_update_playlist_details',
            description: 'Update playlist name, description, or public/private status.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
                name: { type: 'string', description: 'New name for the playlist.' },
                description: { type: 'string', description: 'New description for the playlist.' },
                public: { type: 'boolean', description: 'Whether the playlist should be public.' },
              },
              required: ['playlist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await updatePlaylistDetails(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Playlist updated successfully.'
                await sseHandler.sendToolEvent('spotify_update_playlist_details', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_update_playlist_details', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Reorder Playlist Items
          betaTool({
            name: 'spotify_reorder_playlist_items',
            description: 'Reorder tracks in a playlist or replace all tracks.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
                range_start: { type: 'number', description: 'Position of the first item to reorder.' },
                insert_before: { type: 'number', description: 'Position where items should be inserted.' },
                range_length: { type: 'number', description: 'Number of items to reorder (default 1).' },
                uris: { type: 'array', items: { type: 'string' }, description: 'New list of track URIs to replace all items.' },
              },
              required: ['playlist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await updatePlaylistItems(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Playlist items updated successfully.'
                await sseHandler.sendToolEvent('spotify_reorder_playlist_items', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_reorder_playlist_items', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get User Playlists
          betaTool({
            name: 'spotify_get_user_playlists',
            description: 'Get playlists owned or followed by a specific user.',
            inputSchema: {
              type: 'object',
              properties: {
                user_id: { type: 'string', description: 'Spotify user ID.' },
                limit: { type: 'number', description: 'Max number of playlists (default 20).' },
              },
              required: ['user_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await getUserPlaylists(inp.user_id, { limit: inp.limit })
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No playlists found for this user.'
                  await sseHandler.sendToolEvent('spotify_get_user_playlists', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((p: any) => `- ${p.name} (ID: ${p.id}, Tracks: ${p.tracks.total})`).join('\n')
                await sseHandler.sendToolEvent('spotify_get_user_playlists', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_user_playlists', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Featured Playlists
          betaTool({
            name: 'spotify_get_featured_playlists',
            description: 'Get Spotify\'s featured playlists.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of playlists (default 20).' },
                country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getFeaturedPlaylists(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.playlists?.items || []
                if (items.length === 0) {
                  const msg = 'No featured playlists found.'
                  await sseHandler.sendToolEvent('spotify_get_featured_playlists', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((p: any, i: number) => 
                  `${i + 1}. ${p.name} - ${p.description || 'No description'} (ID: ${p.id})`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_featured_playlists', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_featured_playlists', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Category Playlists
          betaTool({
            name: 'spotify_get_category_playlists',
            description: 'Get playlists for a specific category (e.g., party, workout, chill).',
            inputSchema: {
              type: 'object',
              properties: {
                category_id: { type: 'string', description: 'Category ID (e.g., "party", "workout", "chill").' },
                limit: { type: 'number', description: 'Max number of playlists (default 20).' },
              },
              required: ['category_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await getCategoryPlaylists(inp.category_id, { limit: inp.limit })
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.playlists?.items || []
                if (items.length === 0) {
                  const msg = 'No playlists found for this category.'
                  await sseHandler.sendToolEvent('spotify_get_category_playlists', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((p: any, i: number) => 
                  `${i + 1}. ${p.name} (ID: ${p.id})`
                ).join('\n')
                await sseHandler.sendToolEvent('spotify_get_category_playlists', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_category_playlists', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Remove Saved Tracks
          betaTool({
            name: 'spotify_remove_saved_tracks',
            description: 'Remove tracks from the user\'s Liked Songs.',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs to remove.' },
              },
              required: ['ids'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await removeSavedTracks(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Removed ${(input as any).ids.length} track(s) from your library.`
                await sseHandler.sendToolEvent('spotify_remove_saved_tracks', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_remove_saved_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Check Saved Tracks
          betaTool({
            name: 'spotify_check_saved_tracks',
            description: 'Check if tracks are in the user\'s Liked Songs.',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs to check.' },
              },
              required: ['ids'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await checkSavedTracks((input as any).ids)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ids = (input as any).ids as string[]
                const saved = result.data as boolean[]
                const formatted = ids.map((id, i) => `${id}: ${saved[i] ? '✓ Saved' : '✗ Not saved'}`).join('\n')
                await sseHandler.sendToolEvent('spotify_check_saved_tracks', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_check_saved_tracks', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Saved Albums
          betaTool({
            name: 'spotify_get_saved_albums',
            description: 'Get the current user\'s saved albums.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of albums (default 20).' },
                offset: { type: 'number', description: 'Offset for pagination.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getSavedAlbums(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.items || []
                if (items.length === 0) {
                  const msg = 'No saved albums found.'
                  await sseHandler.sendToolEvent('spotify_get_saved_albums', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((item: any, i: number) => {
                  const a = item.album
                  const artists = a.artists?.map((ar: { name: string }) => ar.name).join(', ') || 'Unknown'
                  return `${i + 1}. ${a.name} by ${artists} (Added: ${item.added_at})`
                }).join('\n')
                await sseHandler.sendToolEvent('spotify_get_saved_albums', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_saved_albums', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Save Albums
          betaTool({
            name: 'spotify_save_albums',
            description: 'Save albums to the user\'s library.',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify album IDs to save.' },
              },
              required: ['ids'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await saveAlbums(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Saved ${(input as any).ids.length} album(s) to your library.`
                await sseHandler.sendToolEvent('spotify_save_albums', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_save_albums', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Remove Saved Albums
          betaTool({
            name: 'spotify_remove_saved_albums',
            description: 'Remove albums from the user\'s library.',
            inputSchema: {
              type: 'object',
              properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify album IDs to remove.' },
              },
              required: ['ids'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await removeSavedAlbums(input as any)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = `Removed ${(input as any).ids.length} album(s) from your library.`
                await sseHandler.sendToolEvent('spotify_remove_saved_albums', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_remove_saved_albums', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Get Browse Categories
          betaTool({
            name: 'spotify_get_categories',
            description: 'Get a list of browse categories used to tag items in Spotify.',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Max number of categories (default 20).' },
                country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code.' },
              },
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                const result = await getBrowseCategories(input)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = result.data as any
                const items = data.categories?.items || []
                if (items.length === 0) {
                  const msg = 'No categories found.'
                  await sseHandler.sendToolEvent('spotify_get_categories', 'end', input as Record<string, unknown>, msg)
                  return msg
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const formatted = items.map((c: any) => `- ${c.name} (ID: ${c.id})`).join('\n')
                await sseHandler.sendToolEvent('spotify_get_categories', 'end', input as Record<string, unknown>, formatted)
                return formatted
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_get_categories', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Follow Playlist
          betaTool({
            name: 'spotify_follow_playlist',
            description: 'Follow a playlist.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
                public: { type: 'boolean', description: 'Whether to follow publicly (default true).' },
              },
              required: ['playlist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inp = input as any
                const result = await followPlaylist(inp.playlist_id, inp.public)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Now following this playlist.'
                await sseHandler.sendToolEvent('spotify_follow_playlist', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_follow_playlist', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),

          // Unfollow Playlist
          betaTool({
            name: 'spotify_unfollow_playlist',
            description: 'Unfollow a playlist.',
            inputSchema: {
              type: 'object',
              properties: {
                playlist_id: { type: 'string', description: 'Spotify playlist ID.' },
              },
              required: ['playlist_id'],
              additionalProperties: false,
            },
            run: async (input) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const result = await unfollowPlaylist((input as any).playlist_id)
                if (!result.successful) throw new Error(result.error || 'Unknown error')
                const msg = 'Unfollowed this playlist.'
                await sseHandler.sendToolEvent('spotify_unfollow_playlist', 'end', input as Record<string, unknown>, msg)
                return msg
              } catch (error) {
                const errorMsg = `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`
                await sseHandler.sendToolEvent('spotify_unfollow_playlist', 'end', input as Record<string, unknown>, errorMsg)
                return errorMsg
              }
            },
          }),
        ]
      : []),
  )
}

