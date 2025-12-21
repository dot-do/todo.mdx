/**
 * API client for todo.mdx.do API (Payload/Worker data source)
 * Fetches issues from the worker API for compilation
 */

import type { Issue } from './types.js'
import { ApiError, ConfigurationError, getErrorMessage } from './errors.js'

/** API client configuration */
export interface ApiClientConfig {
  /** Base URL for the API (default: https://todo.mdx.do) */
  baseUrl?: string
  /** API key or OAuth token for authentication */
  apiKey?: string
  /** Repository owner/org (e.g., 'dot-do') */
  owner?: string
  /** Repository name (e.g., 'todo.mdx') */
  repo?: string
}

/** Payload API response format */
interface PayloadIssue {
  id: number
  localId: string
  title: string
  body?: string | null
  status: 'open' | 'in_progress' | 'closed'
  priority?: number | null
  labels?: string[] | null
  assignees?: string[] | null
  githubNumber?: number | null
  githubId?: number | null
  githubUrl?: string | null
  dependsOn?: Array<{ id: number; localId: string }> | null
  repo?: { id: number; fullName: string }
  milestone?: { id: number; title: string } | null
  type?: 'task' | 'bug' | 'feature' | 'epic' | null
  closedAt?: string | null
  closeReason?: string | null
  updatedAt: string
  createdAt: string
}

/** API response wrapper */
interface ApiResponse {
  issues: PayloadIssue[]
}

/** Issue filtering options */
export interface IssueFilter {
  status?: 'open' | 'in_progress' | 'closed' | 'all'
  labels?: string[]
  assignee?: string
  type?: 'task' | 'bug' | 'feature' | 'epic'
  priority?: number
}

/**
 * Map Payload issue to local Issue type
 */
function mapPayloadIssue(payloadIssue: PayloadIssue): Issue {
  // Extract blockedBy from dependsOn relationships
  const blockedBy = payloadIssue.dependsOn?.map(dep => dep.localId) || []

  return {
    id: payloadIssue.localId,
    githubId: payloadIssue.githubId || undefined,
    githubNumber: payloadIssue.githubNumber || undefined,
    title: payloadIssue.title,
    body: payloadIssue.body || undefined,
    state: payloadIssue.status,
    labels: Array.isArray(payloadIssue.labels) ? payloadIssue.labels : [],
    assignees: Array.isArray(payloadIssue.assignees) ? payloadIssue.assignees : [],
    priority: payloadIssue.priority || undefined,
    type: payloadIssue.type || 'task',
    milestone: payloadIssue.milestone?.title,
    createdAt: payloadIssue.createdAt,
    updatedAt: payloadIssue.updatedAt,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    // Note: 'blocks' would need reverse lookup from other issues
    blocks: undefined,
    epicId: undefined, // Would need to be inferred from type or relationships
  }
}

/**
 * API client for fetching issues from todo.mdx.do
 */
export class TodoApiClient {
  private baseUrl: string
  private apiKey?: string
  private owner?: string
  private repo?: string

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.TODO_MDX_API_URL || 'https://todo.mdx.do'
    this.apiKey = config.apiKey || process.env.TODO_MDX_API_KEY
    this.owner = config.owner
    this.repo = config.repo
  }

  /**
   * Fetch issues from the API
   */
  async fetchIssues(filter: IssueFilter = {}): Promise<Issue[]> {
    if (!this.owner || !this.repo) {
      throw new ConfigurationError('Repository owner and name must be configured', {
        context: {
          owner: this.owner,
          repo: this.repo,
          message: 'Set TODO_MDX_OWNER and TODO_MDX_REPO environment variables or provide via config',
        },
      })
    }

    const url = new URL(`/api/repos/${this.owner}/${this.repo}/issues`, this.baseUrl)

    // Add query parameters
    if (filter.status && filter.status !== 'all') {
      url.searchParams.set('status', filter.status)
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url.toString(), { headers })

      if (!response.ok) {
        throw new ApiError('API request failed', {
          statusCode: response.status,
          endpoint: url.toString(),
          context: {
            statusText: response.statusText,
            owner: this.owner,
            repo: this.repo,
          },
        })
      }

      const data = await response.json() as ApiResponse
      let issues = data.issues.map(mapPayloadIssue)

      // Apply client-side filters
      if (filter.labels?.length) {
        issues = issues.filter(issue =>
          filter.labels!.some(label => issue.labels?.includes(label))
        )
      }

      if (filter.assignee) {
        issues = issues.filter(issue => issue.assignees?.includes(filter.assignee!))
      }

      if (filter.type) {
        issues = issues.filter(issue => issue.type === filter.type)
      }

      if (filter.priority !== undefined) {
        issues = issues.filter(issue => issue.priority === filter.priority)
      }

      // Compute reverse 'blocks' relationships
      const blocksMap = new Map<string, string[]>()
      for (const issue of issues) {
        if (issue.blockedBy) {
          for (const blockerId of issue.blockedBy) {
            const blocks = blocksMap.get(blockerId) || []
            blocks.push(issue.id)
            blocksMap.set(blockerId, blocks)
          }
        }
      }

      // Assign blocks arrays
      for (const issue of issues) {
        issue.blocks = blocksMap.get(issue.id)
      }

      return issues
    } catch (error) {
      // Re-throw if already one of our custom errors
      if (error instanceof ApiError || error instanceof ConfigurationError) {
        throw error
      }
      // Wrap other errors
      throw new ApiError('Failed to fetch issues', {
        cause: error,
        endpoint: url.toString(),
        context: {
          owner: this.owner,
          repo: this.repo,
          filter,
        },
      })
    }
  }

  /**
   * Fetch a single issue by ID
   */
  async fetchIssue(id: string): Promise<Issue | null> {
    if (!this.owner || !this.repo) {
      throw new ConfigurationError('Repository owner and name must be configured', {
        context: {
          owner: this.owner,
          repo: this.repo,
          issueId: id,
          message: 'Set TODO_MDX_OWNER and TODO_MDX_REPO environment variables or provide via config',
        },
      })
    }

    const url = new URL(`/api/repos/${this.owner}/${this.repo}/issues/${id}`, this.baseUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url.toString(), { headers })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new ApiError('API request failed', {
          statusCode: response.status,
          endpoint: url.toString(),
          context: {
            statusText: response.statusText,
            owner: this.owner,
            repo: this.repo,
            issueId: id,
          },
        })
      }

      const data = await response.json() as { issue: PayloadIssue }
      return mapPayloadIssue(data.issue)
    } catch (error) {
      // Re-throw if already one of our custom errors
      if (error instanceof ApiError || error instanceof ConfigurationError) {
        throw error
      }
      // Wrap other errors
      throw new ApiError('Failed to fetch issue', {
        cause: error,
        endpoint: url.toString(),
        context: {
          owner: this.owner,
          repo: this.repo,
          issueId: id,
        },
      })
    }
  }
}

/**
 * Load issues from the todo.mdx.do API
 * Signature matches loadBeadsIssues() for drop-in compatibility
 */
export async function loadApiIssues(config?: ApiClientConfig): Promise<Issue[]> {
  // Use environment variables or config for repo identification
  const finalConfig: ApiClientConfig = {
    baseUrl: config?.baseUrl || process.env.TODO_MDX_API_URL,
    apiKey: config?.apiKey || process.env.TODO_MDX_API_KEY,
    owner: config?.owner || process.env.TODO_MDX_OWNER,
    repo: config?.repo || process.env.TODO_MDX_REPO,
  }

  // Skip if not configured
  if (!finalConfig.owner || !finalConfig.repo) {
    return []
  }

  try {
    const client = new TodoApiClient(finalConfig)
    return await client.fetchIssues({ status: 'all' })
  } catch (error) {
    // Log error with context instead of silently failing
    if (error instanceof ApiError || error instanceof ConfigurationError) {
      console.error(error.getFullMessage())
    } else {
      console.error('Failed to load API issues:', getErrorMessage(error))
    }
    return []
  }
}
