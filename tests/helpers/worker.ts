/**
 * Worker API Helper
 * Helpers for communicating with the todo.mdx worker API
 * Authentication via TEST_API_KEY env var (shared secret for testing).
 */

import {
  getAuthToken,
  getWorkerBaseUrl,
  generateGitHubSignature,
  hasWorkerCredentials,
} from './auth'

// Re-export for backwards compatibility
export { hasWorkerCredentials } from './auth'

function workerFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${getWorkerBaseUrl()}${path}`, {
    ...options,
    headers,
  })
}

export interface WorkerIssue {
  id: number
  github_id: number | null
  github_number: number | null
  beads_id: string | null
  title: string
  body: string | null
  state: string
  labels: string | null
  assignees: string | null
  priority: number | null
  type: string | null
}

export interface WorkerMilestone {
  id: number
  github_id: number | null
  github_number: number | null
  beads_id: string | null
  title: string
  description: string | null
  state: string
  due_on: string | null
}

export interface SyncPayload {
  source: 'github' | 'beads' | 'file' | 'mcp'
  issues: Array<{
    githubId?: number
    beadsId?: string
    title: string
    body?: string
    state: string
    labels?: string[]
    assignees?: string[]
    priority?: number
    type?: string
    filePath?: string
    updatedAt?: string
  }>
}

export interface MilestoneSyncPayload {
  source: 'github' | 'beads' | 'file' | 'mcp'
  milestones: Array<{
    githubId?: number
    githubNumber?: number
    beadsId?: string
    title: string
    description?: string
    state: string
    dueOn?: string
    filePath?: string
    updatedAt?: string
  }>
}

export interface PushSyncPayload {
  ref: string
  before: string
  after: string
  files: string[]
  installationId?: number
}

// Repo API
export const repos = {
  async listIssues(
    owner: string,
    repo: string,
    params?: { status?: string }
  ): Promise<{ issues: WorkerIssue[] }> {
    const query = params?.status ? `?status=${params.status}` : ''
    const response = await workerFetch(`/api/repos/${owner}/${repo}/issues${query}`)
    return response.json()
  },

  async getIssue(
    owner: string,
    repo: string,
    id: string
  ): Promise<{ issue: WorkerIssue }> {
    const response = await workerFetch(`/api/repos/${owner}/${repo}/issues/${id}`)
    return response.json()
  },

  async createIssue(
    owner: string,
    repo: string,
    data: {
      title: string
      body?: string
      labels?: string[]
      assignees?: string[]
      milestone?: number
      priority?: number
    }
  ): Promise<{ issue: WorkerIssue }> {
    const response = await workerFetch(`/api/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateIssue(
    owner: string,
    repo: string,
    id: string,
    data: Partial<{
      title: string
      body: string
      state: string
      labels: string[]
      assignees: string[]
      priority: number
    }>
  ): Promise<{ issue: WorkerIssue }> {
    const response = await workerFetch(`/api/repos/${owner}/${repo}/issues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteIssue(owner: string, repo: string, id: string): Promise<void> {
    await workerFetch(`/api/repos/${owner}/${repo}/issues/${id}`, {
      method: 'DELETE',
    })
  },

  async listMilestones(
    owner: string,
    repo: string,
    params?: { state?: string }
  ): Promise<{ milestones: WorkerMilestone[] }> {
    const query = params?.state ? `?state=${params.state}` : ''
    const response = await workerFetch(
      `/api/repos/${owner}/${repo}/milestones${query}`
    )
    return response.json()
  },

  async createMilestone(
    owner: string,
    repo: string,
    data: {
      title: string
      description?: string
      dueOn?: string
    }
  ): Promise<{ milestone: WorkerMilestone }> {
    const response = await workerFetch(`/api/repos/${owner}/${repo}/milestones`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },
}

// Webhook simulation
export const webhooks = {
  async simulateIssueEvent(
    owner: string,
    repo: string,
    action: 'opened' | 'edited' | 'closed' | 'reopened',
    issue: {
      number: number
      title: string
      body?: string
      state: string
      labels?: Array<{ name: string }>
      user?: { login: string }
    }
  ): Promise<Response> {
    const body = JSON.stringify({
      action,
      issue,
      repository: {
        full_name: `${owner}/${repo}`,
        owner: { login: owner },
        name: repo,
      },
    })

    const signature = await generateGitHubSignature(body)

    return workerFetch('/github/webhook', {
      method: 'POST',
      headers: {
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })
  },

  async simulatePushEvent(
    owner: string,
    repo: string,
    payload: {
      ref: string
      before: string
      after: string
      commits: Array<{
        id: string
        message: string
        added: string[]
        modified: string[]
        removed: string[]
      }>
    }
  ): Promise<Response> {
    const body = JSON.stringify({
      ...payload,
      repository: {
        full_name: `${owner}/${repo}`,
        owner: { login: owner },
        name: repo,
      },
    })

    const signature = await generateGitHubSignature(body)

    return workerFetch('/github/webhook', {
      method: 'POST',
      headers: {
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })
  },

  async simulateMilestoneEvent(
    owner: string,
    repo: string,
    action: 'created' | 'edited' | 'closed' | 'opened' | 'deleted',
    milestone: {
      number: number
      title: string
      description?: string
      state: string
      due_on?: string
    }
  ): Promise<Response> {
    const body = JSON.stringify({
      action,
      milestone,
      repository: {
        full_name: `${owner}/${repo}`,
        owner: { login: owner },
        name: repo,
      },
    })

    const signature = await generateGitHubSignature(body)

    return workerFetch('/github/webhook', {
      method: 'POST',
      headers: {
        'X-GitHub-Event': 'milestone',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })
  },

  async simulatePullRequestEvent(
    owner: string,
    repo: string,
    action: 'opened' | 'closed' | 'reopened' | 'synchronize',
    pullRequest: {
      number: number
      title: string
      body: string
      head: { ref: string }
      base: { ref: string }
      merged: boolean
    }
  ): Promise<Response> {
    const body = JSON.stringify({
      action,
      pull_request: pullRequest,
      repository: {
        full_name: `${owner}/${repo}`,
        owner: { login: owner },
        name: repo,
      },
    })

    const signature = await generateGitHubSignature(body)

    return workerFetch('/github/webhook', {
      method: 'POST',
      headers: {
        'X-GitHub-Event': 'pull_request',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })
  },

  async simulatePullRequestReviewEvent(
    owner: string,
    repo: string,
    action: 'submitted' | 'edited' | 'dismissed',
    review: {
      state: 'approved' | 'changes_requested' | 'commented'
      user: { login: string }
    },
    pullRequest: {
      number: number
      title: string
      body: string
      head: { ref: string }
    }
  ): Promise<Response> {
    const body = JSON.stringify({
      action,
      review,
      pull_request: pullRequest,
      repository: {
        full_name: `${owner}/${repo}`,
        owner: { login: owner },
        name: repo,
      },
    })

    const signature = await generateGitHubSignature(body)

    return workerFetch('/github/webhook', {
      method: 'POST',
      headers: {
        'X-GitHub-Event': 'pull_request_review',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })
  },

  async simulateInstallationEvent(
    action: 'created' | 'deleted' | 'suspend' | 'unsuspend',
    installation: {
      id: number
      account: {
        login: string
        id: number
        type: 'User' | 'Organization'
        avatar_url?: string
      }
      permissions?: Record<string, string>
      events?: string[]
      repository_selection?: 'all' | 'selected'
    },
    repositories?: Array<{
      id: number
      name: string
      full_name: string
      private: boolean
    }>
  ): Promise<Response> {
    const body = JSON.stringify({
      action,
      installation,
      repositories: repositories || [],
      sender: {
        login: installation.account.login,
        id: installation.account.id,
      },
    })

    const signature = await generateGitHubSignature(body)

    return workerFetch('/github/webhook', {
      method: 'POST',
      headers: {
        'X-GitHub-Event': 'installation',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })
  },
}

// Workflow API
export const workflows = {
  async triggerIssueReady(
    issue: { id: string; title: string; description?: string },
    repo: { owner: string; name: string; fullName?: string },
    installationId: number
  ): Promise<Response> {
    return workerFetch('/api/workflows/issue/ready', {
      method: 'POST',
      body: JSON.stringify({ issue, repo, installationId }),
    })
  },

  async getWorkflowStatus(workflowId: string): Promise<{
    id: string
    status: string
    output?: any
    error?: string
  }> {
    const response = await workerFetch(`/api/workflows/${workflowId}`)
    return response.json()
  },

  async createPR(options: {
    repo: { owner: string; name: string }
    branch: string
    title: string
    body: string
    installationId: number
  }): Promise<{ number: number; url: string; state: string }> {
    const response = await workerFetch('/api/workflows/pr/create', {
      method: 'POST',
      body: JSON.stringify(options),
    })
    return response.json()
  },

  async submitReview(options: {
    repo: { owner: string; name: string }
    prNumber: number
    action: 'approve' | 'request_changes' | 'comment'
    body: string
    installationId: number
  }): Promise<{ id: number; state: string }> {
    const response = await workerFetch('/api/workflows/pr/review', {
      method: 'POST',
      body: JSON.stringify(options),
    })
    return response.json()
  },

  async mergePR(options: {
    repo: { owner: string; name: string }
    prNumber: number
    mergeMethod?: 'merge' | 'squash' | 'rebase'
    installationId: number
  }): Promise<{ merged: boolean; sha: string; message?: string }> {
    const response = await workerFetch('/api/workflows/pr/merge', {
      method: 'POST',
      body: JSON.stringify(options),
    })
    return response.json()
  },
}

// Sandbox API
export interface SandboxExecuteOptions {
  repo: string
  task: string
  branch?: string
  push?: boolean
  installationId?: number
  timeout?: number
}

export interface SandboxResult {
  diff: string
  summary: string
  filesChanged: string[]
  exitCode: number
  branch?: string
  commitSha?: string
  pushed?: boolean
}

export const sandbox = {
  async execute(options: SandboxExecuteOptions): Promise<SandboxResult> {
    const response = await workerFetch('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      const error = await response.json() as { error: string }
      throw new Error(`Sandbox execution failed: ${error.error}`)
    }

    return response.json()
  },

  async executeStream(options: SandboxExecuteOptions): Promise<Response> {
    return workerFetch('/api/sandbox/execute/stream', {
      method: 'POST',
      body: JSON.stringify(options),
    })
  },

  async createSession(options: SandboxExecuteOptions): Promise<{ sessionId: string }> {
    const response = await workerFetch('/api/sandbox/sessions', {
      method: 'POST',
      body: JSON.stringify(options),
    })
    return response.json()
  },

  async getSession(sessionId: string): Promise<any> {
    const response = await workerFetch(`/api/sandbox/sessions/${sessionId}`)
    return response.json()
  },

  async abortSession(sessionId: string): Promise<void> {
    await workerFetch(`/api/sandbox/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  },
}

// Durable Object sync
export const sync = {
  async syncIssues(
    owner: string,
    repo: string,
    payload: SyncPayload
  ): Promise<{
    queued: boolean
    syncState: string
    pendingEvents: number
  }> {
    const response = await workerFetch(
      `/api/repos/${owner}/${repo}/do/issues/sync`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
    return response.json()
  },

  async syncMilestones(
    owner: string,
    repo: string,
    payload: MilestoneSyncPayload
  ): Promise<{
    synced: Array<{ action: string; id?: number }>
  }> {
    const response = await workerFetch(
      `/api/repos/${owner}/${repo}/do/milestones/sync`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
    return response.json()
  },

  async syncPush(
    owner: string,
    repo: string,
    payload: PushSyncPayload
  ): Promise<{
    queued: boolean
    files: { beads: number; todo: number; roadmap: number }
    syncState: string
    pendingEvents: number
  }> {
    const response = await workerFetch(
      `/api/repos/${owner}/${repo}/do/sync/push`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    )
    return response.json()
  },

  async getStatus(
    owner: string,
    repo: string
  ): Promise<{
    issues: number
    milestones: number
    recentSyncs: any[]
    syncStatus: {
      state: string
      pendingEvents: number
      currentEvent: any
      lastSyncAt: string | null
      errorCount: number
      lastError: string | null
    } | null
  }> {
    const response = await workerFetch(`/api/repos/${owner}/${repo}/do/status`)
    return response.json()
  },

  async resetSyncState(owner: string, repo: string): Promise<void> {
    await workerFetch(`/api/repos/${owner}/${repo}/do/sync/reset`, {
      method: 'POST',
    })
  },
}

// MCP API
export const mcp = {
  async getInfo(): Promise<{
    name: string
    version: string
    capabilities: { tools: any; resources: any }
  }> {
    const response = await workerFetch('/mcp/info')
    return response.json()
  },

  async getTools(): Promise<{
    tools: Array<{
      name: string
      description: string
      inputSchema: any
    }>
  }> {
    const response = await workerFetch('/mcp/tools')
    return response.json()
  },

  async getResources(): Promise<{
    resources: Array<{
      uri: string
      name: string
      description?: string
    }>
  }> {
    const response = await workerFetch('/mcp/resources')
    return response.json()
  },

  async callTool(
    name: string,
    args: Record<string, any>
  ): Promise<{
    content: Array<{ type: string; text: string }>
    isError?: boolean
  }> {
    const response = await workerFetch('/mcp/tools/call', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    })
    return response.json()
  },
}
