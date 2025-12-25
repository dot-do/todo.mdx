import { Octokit } from '@octokit/rest'

export interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: Array<{ name: string }>
  assignee: { login: string } | null
  created_at: string
  updated_at: string
  closed_at: string | null
  html_url: string
}

export interface GitHubIssuePayload {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
  state?: 'open' | 'closed'
}

export interface GitHubClient {
  createIssue(owner: string, repo: string, issue: GitHubIssuePayload): Promise<GitHubIssue>
  updateIssue(owner: string, repo: string, number: number, issue: Partial<GitHubIssuePayload>): Promise<GitHubIssue>
  getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue>
  listIssues(owner: string, repo: string, options?: { state?: 'open' | 'closed' | 'all', per_page?: number }): Promise<GitHubIssue[]>
  addLabels(owner: string, repo: string, number: number, labels: string[]): Promise<void>
  removeLabel(owner: string, repo: string, number: number, label: string): Promise<void>
}

export interface GitHubClientOptions {
  token: string
  installationId?: number
  // For testing: allow injecting a mock Octokit instance
  octokit?: Octokit
}

/**
 * Helper to filter undefined values from objects
 */
function filterUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>
}

export function createGitHubClient(options: GitHubClientOptions): GitHubClient {
  // Use injected octokit for testing, otherwise create a real one
  const octokit = options.octokit || new Octokit({
    auth: options.token,
  })

  return {
    async createIssue(owner: string, repo: string, issue: GitHubIssuePayload): Promise<GitHubIssue> {
      const response = await octokit.rest.issues.create({
        owner,
        repo,
        title: issue.title,
        ...filterUndefined({
          body: issue.body,
          labels: issue.labels,
          assignees: issue.assignees,
          state: issue.state,
        }),
      })
      return response.data as GitHubIssue
    },

    async updateIssue(owner: string, repo: string, number: number, issue: Partial<GitHubIssuePayload>): Promise<GitHubIssue> {
      const response = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: number,
        ...filterUndefined(issue),
      })
      return response.data as GitHubIssue
    },

    async getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
      const response = await octokit.rest.issues.get({
        owner,
        repo,
        issue_number: number,
      })
      return response.data as GitHubIssue
    },

    async listIssues(owner: string, repo: string, options?: { state?: 'open' | 'closed' | 'all', per_page?: number }): Promise<GitHubIssue[]> {
      return await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner,
        repo,
        per_page: 100,
        ...filterUndefined(options || {}),
      }) as GitHubIssue[]
    },

    async addLabels(owner: string, repo: string, number: number, labels: string[]): Promise<void> {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: number,
        labels,
      })
    },

    async removeLabel(owner: string, repo: string, number: number, label: string): Promise<void> {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: number,
        name: label,
      })
    },
  }
}
