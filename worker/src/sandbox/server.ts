/**
 * CapnWeb Server for Sandboxed Workflow Execution
 *
 * This RPC server exposes safe APIs to sandboxed workflow code.
 * All calls from the sandbox are routed through this server.
 */

import { RpcTarget, newWorkersRpcResponse } from 'capnweb'
import type { Env } from '../types'
import { getPayloadClient } from '../payload'

/**
 * Safe APIs exposed to sandboxed workflow code
 *
 * Only methods defined here are accessible from the sandbox.
 * This provides capability-based security.
 */
export class SandboxedWorkflowAPI extends RpcTarget {
  private env: Env
  private repoFullName: string
  private installationId: number

  constructor(env: Env, repoFullName: string, installationId: number) {
    super()
    this.env = env
    this.repoFullName = repoFullName
    this.installationId = installationId
  }

  // ============================================
  // Issue Operations (via Payload RPC)
  // ============================================

  async getIssue(issueId: string) {
    const payload = await getPayloadClient(this.env)
    const result = await payload.find({
      collection: 'issues',
      where: { localId: { equals: issueId } },
      limit: 1,
      overrideAccess: true,
    })
    return result.docs?.[0] || null
  }

  async listIssues(options?: { status?: string; limit?: number }) {
    const payload = await getPayloadClient(this.env)
    const where: any = {
      'repo.fullName': { equals: this.repoFullName },
    }
    if (options?.status) {
      where.status = { equals: options.status }
    }

    const result = await payload.find({
      collection: 'issues',
      where,
      limit: options?.limit || 50,
      overrideAccess: true,
    })
    return result.docs || []
  }

  async updateIssue(issueId: string, data: {
    status?: 'open' | 'in_progress' | 'closed'
    title?: string
    body?: string
  }) {
    const payload = await getPayloadClient(this.env)
    // Find the issue first
    const existing = await payload.find({
      collection: 'issues',
      where: { localId: { equals: issueId } },
      limit: 1,
      overrideAccess: true,
    })

    if (!existing.docs?.length) {
      throw new Error(`Issue not found: ${issueId}`)
    }

    return payload.update({
      collection: 'issues',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
  }

  async closeIssue(issueId: string, reason?: string) {
    return this.updateIssue(issueId, {
      status: 'closed',
    })
  }

  // ============================================
  // Repository Durable Object Operations
  // ============================================

  async syncToRepo(type: 'issues' | 'milestones', data: any[]) {
    const doId = this.env.REPO.idFromName(this.repoFullName)
    const stub = this.env.REPO.get(doId)

    const response = await stub.fetch(new Request(`http://do/${type}/sync`, {
      method: 'POST',
      body: JSON.stringify({ source: 'workflow', [type]: data }),
      headers: { 'Content-Type': 'application/json' },
    }))

    return response.json()
  }

  // ============================================
  // Milestone Operations (via Payload RPC)
  // ============================================

  async getMilestone(milestoneId: string) {
    const payload = await getPayloadClient(this.env)
    const result = await payload.find({
      collection: 'milestones',
      where: { localId: { equals: milestoneId } },
      limit: 1,
      overrideAccess: true,
    })
    return result.docs?.[0] || null
  }

  async listMilestones(options?: { state?: string; limit?: number }) {
    const payload = await getPayloadClient(this.env)
    const where: any = {
      'repo.fullName': { equals: this.repoFullName },
    }
    if (options?.state) {
      where.state = { equals: options.state }
    }

    const result = await payload.find({
      collection: 'milestones',
      where,
      limit: options?.limit || 50,
      overrideAccess: true,
    })
    return result.docs || []
  }

  async updateMilestone(milestoneId: string, data: {
    state?: 'open' | 'closed'
    title?: string
    description?: string
    dueOn?: string
  }) {
    const payload = await getPayloadClient(this.env)
    const existing = await payload.find({
      collection: 'milestones',
      where: { localId: { equals: milestoneId } },
      limit: 1,
      overrideAccess: true,
    })

    if (!existing.docs?.length) {
      throw new Error(`Milestone not found: ${milestoneId}`)
    }

    return payload.update({
      collection: 'milestones',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
  }

  async closeMilestone(milestoneId: string) {
    return this.updateMilestone(milestoneId, { state: 'closed' })
  }

  // ============================================
  // GitHub API Operations (via GitHub REST API)
  // ============================================

  async githubCreateComment(issueNumber: number, body: string) {
    const token = await this.getGitHubToken()
    const [owner, repo] = this.repoFullName.split('/')

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'todo.mdx-worker',
        },
        body: JSON.stringify({ body }),
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async githubUpdateIssue(issueNumber: number, data: {
    title?: string
    body?: string
    state?: 'open' | 'closed'
    labels?: string[]
    assignees?: string[]
    milestone?: number | null
  }) {
    const token = await this.getGitHubToken()
    const [owner, repo] = this.repoFullName.split('/')

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'todo.mdx-worker',
        },
        body: JSON.stringify(data),
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async githubCreateLabel(name: string, color: string, description?: string) {
    const token = await this.getGitHubToken()
    const [owner, repo] = this.repoFullName.split('/')

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/labels`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'todo.mdx-worker',
        },
        body: JSON.stringify({ name, color, description }),
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async githubAddLabels(issueNumber: number, labels: string[]) {
    const token = await this.getGitHubToken()
    const [owner, repo] = this.repoFullName.split('/')

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'todo.mdx-worker',
        },
        body: JSON.stringify({ labels }),
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  // ============================================
  // Schedule Operations (via Durable Object Alarms)
  // ============================================

  async scheduleDelay(ms: number, callback: string) {
    // Store the callback function name/id for later execution
    // Use Durable Object alarms for delayed execution
    const doId = this.env.REPO.idFromName(this.repoFullName)
    const stub = this.env.REPO.get(doId)

    const response = await stub.fetch(new Request('http://do/schedule/delay', {
      method: 'POST',
      body: JSON.stringify({
        delayMs: ms,
        callback,
        source: 'workflow',
      }),
      headers: { 'Content-Type': 'application/json' },
    }))

    return response.json()
  }

  async scheduleCron(pattern: string, callback: string) {
    // Register a cron-style scheduled execution
    // This would typically use Cloudflare Cron Triggers
    // For now, return a placeholder
    return {
      success: true,
      message: 'Cron scheduling not yet implemented',
      pattern,
      callback,
    }
  }

  // ============================================
  // TODO.mdx Rendering
  // ============================================

  async renderTodo(): Promise<string> {
    const issues = await this.listIssues({ status: 'open' })

    // Simple markdown rendering
    const lines = [
      '# TODO',
      '',
      `${issues.length} open issues`,
      '',
    ]

    for (const issue of issues) {
      const checkbox = issue.status === 'closed' ? '[x]' : '[ ]'
      const priority = issue.priority ? `[P${issue.priority}]` : ''
      lines.push(`- ${checkbox} **${issue.localId}** ${priority}: ${issue.title}`)
    }

    return lines.join('\n')
  }

  // ============================================
  // Logging (safe, no secrets exposed)
  // ============================================

  log(level: 'info' | 'warn' | 'error', message: string) {
    const prefix = `[Sandbox:${this.repoFullName}]`
    switch (level) {
      case 'info':
        console.log(prefix, message)
        break
      case 'warn':
        console.warn(prefix, message)
        break
      case 'error':
        console.error(prefix, message)
        break
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async getGitHubToken(): Promise<string> {
    const { getGitHubToken } = await import('../auth/vault')
    const token = await getGitHubToken(this.env, this.installationId.toString(), 'installation')
    if (!token) {
      throw new Error(`No GitHub token for installation ${this.installationId}`)
    }
    return token
  }
}

/**
 * Handle CapnWeb RPC requests from sandboxed workers
 */
export function handleSandboxRpc(
  request: Request,
  env: Env,
  repoFullName: string,
  installationId: number
): Response | Promise<Response> {
  const api = new SandboxedWorkflowAPI(env, repoFullName, installationId)
  return newWorkersRpcResponse(request, api)
}
