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

