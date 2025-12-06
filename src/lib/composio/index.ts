// Core client
export {
  getComposioClient,
  getComposioXAIClient,
  isComposioAvailable,
  COMPOSIO_DEFAULT_USER_ID,
} from './client'

// GitHub tools
export {
  // Availability check
  isGitHubToolsAvailable,

  // Context management
  setGitHubToolContext,
  getGitHubToolContext,
  findGitHubConnectionId,

  // Repository operations
  getRepository,
  getReadme,
  getFileContent,
  listBranches,
  listReleases,
  getLatestRelease,
  listContributors,
  getLanguages,
  getRepoTree,

  // Issues
  listIssues,
  getIssue,
  createIssue,
  updateIssue,
  createIssueComment,
  listIssueComments,
  addLabels,

  // Pull requests
  listPullRequests,
  getPullRequest,
  createPullRequest,
  mergePullRequest,
  createPRReview,
  listPullRequestFiles,
  listPullRequestCommits,
  getPullRequestDiff,

  // Commits
  listCommits,
  getCommit,

  // Search
  searchRepositories,
  searchIssues,
  searchCode,

  // Users
  getUser,
  listUserRepos,
  getAuthenticatedUser,

  // Repository Actions
  starRepository,
  unstarRepository,
  forkRepository,
  watchRepository,

  // Workflows / CI
  listWorkflows,
  listWorkflowRuns,
  triggerWorkflow,

  // xAI integration
  getGitHubToolsForXAI,
  handleGitHubToolCallsXAI,

  // Formatters
  formatRepoForLLM,
  formatIssuesForLLM,
  formatPRsForLLM,
  formatCommitsForLLM,
} from './github'

// Types
export type {
  GitHubRepoInfo,
  GitHubIssueParams,
  GitHubPRParams,
  GitHubCommitParams,
  GitHubSearchParams,
  GitHubFileParams,
  GitHubToolContext,
  CreateIssueParams,
  CreateIssueCommentParams,
  CreatePullRequestParams,
  UpdateIssueParams,
  MergePullRequestParams,
  AddLabelsParams,
  CreatePRReviewParams,
} from './github'
