/**
 * Cloud Transport - Worker-based implementation for cloud execution
 *
 * Routes API calls to cloud services via Workers RPC:
 * - claude.* -> Cloudflare Sandbox / Claude API
 * - git.* -> Sandbox with cloned repo
 * - issues.*, epics.* -> Payload CMS via Workers RPC
 * - pr.* -> GitHub API via installation tokens
 * - todo.* -> todo.mdx API
 *
 * This transport is used when workflows run in Cloudflare Workers
 * via the dynamic worker loader.
 */

import type { Transport, Repo } from './types'

// ============================================================================
// Cloud Transport Config
// ============================================================================

export interface CloudTransportConfig {
  repo: Repo
  /**
   * Service binding to the Payload worker
   */
  payloadBinding?: unknown // Service<Payload>
  /**
   * Service binding to the Claude sandbox worker
   */
  claudeBinding?: unknown // Service<ClaudeSandbox>
  /**
   * GitHub installation ID for API access
   */
  installationId?: number
  /**
   * Base URL for the todo.mdx API
   */
  apiBaseUrl?: string
  /**
   * GitHub App credentials for API access
   */
  githubEnv?: {
    GITHUB_APP_ID: string
    GITHUB_PRIVATE_KEY: string
  }
}

// ============================================================================
// Cloud Transport Factory
// ============================================================================

/**
 * Create a cloud transport that routes to Workers RPC and APIs
 *
 * This is a stub implementation - full implementation requires:
 * - Cloudflare Workers environment
 * - Service bindings to Payload and Claude sandbox workers
 * - GitHub App installation tokens
 */
export function cloudTransport(config: CloudTransportConfig): Transport {
  const { repo, payloadBinding, claudeBinding, installationId, apiBaseUrl = 'https://todo.mdx.do/api', githubEnv } = config

  return {
    async call(method: string, args: unknown[]): Promise<unknown> {
      const [namespace, ...rest] = method.split('.')
      const action = rest.join('.')

      switch (namespace) {
        case 'claude':
          return callClaude(claudeBinding, action, args)

        case 'git':
          // Git operations happen inside Claude sandbox
          return callClaude(claudeBinding, `git.${action}`, args)

        case 'issues':
        case 'epics':
          return callPayload(payloadBinding, apiBaseUrl, method, args)

        case 'pr':
          return callGitHub(installationId, repo, action, args, githubEnv)

        case 'todo':
          return callTodoApi(apiBaseUrl, action, args)

        default:
          throw new Error(`Unknown namespace: ${namespace}`)
      }
    },
  }
}

// ============================================================================
// Service Handlers (Stubs)
// ============================================================================

async function callClaude(
  binding: unknown,
  action: string,
  args: unknown[]
): Promise<unknown> {
  if (!binding) {
    throw new Error('Claude sandbox binding not configured')
  }

  // In real implementation, this would be:
  // return binding.rpc(action, ...args)

  throw new Error(`Claude cloud transport not implemented: ${action}`)
}

async function callPayload(
  binding: unknown,
  apiBaseUrl: string,
  method: string,
  args: unknown[]
): Promise<unknown> {
  // If we have a service binding, use RPC
  if (binding) {
    // return binding.rpc(method, ...args)
  }

  // Otherwise, fall back to HTTP API
  const response = await fetch(`${apiBaseUrl}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function callGitHub(
  installationId: number | undefined,
  repo: Repo,
  action: string,
  args: unknown[],
  env?: { GITHUB_APP_ID: string; GITHUB_PRIVATE_KEY: string }
): Promise<unknown> {
  if (!installationId) {
    throw new Error('GitHub installation ID not configured')
  }

  if (!env?.GITHUB_APP_ID || !env?.GITHUB_PRIVATE_KEY) {
    throw new Error('GitHub App credentials not configured (GITHUB_APP_ID, GITHUB_PRIVATE_KEY)')
  }

  // Dynamic import to avoid bundling issues
  const { Octokit } = await import('@octokit/rest')
  const { createAppAuth } = await import('@octokit/auth-app')

  // Get installation access token
  const auth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_PRIVATE_KEY,
    installationId,
  })

  const { token } = await auth({ type: 'installation' })
  const octokit = new Octokit({ auth: token })

  const [owner, name] = [repo.owner, repo.name]

  // Route to appropriate GitHub API
  switch (action) {
    case 'create': {
      const [opts] = args as [{ branch: string; title: string; body: string }]
      const { data } = await octokit.pulls.create({
        owner,
        repo: name,
        title: opts.title,
        head: opts.branch,
        base: repo.defaultBranch,
        body: opts.body,
      })
      return {
        number: data.number,
        title: data.title,
        body: data.body || '',
        branch: data.head.ref,
        url: data.html_url,
        state: data.state,
      }
    }

    case 'merge': {
      const [pr] = args as [{ number: number }]
      await octokit.pulls.merge({
        owner,
        repo: name,
        pull_number: pr.number,
        merge_method: 'squash',
      })
      return undefined
    }

    case 'comment': {
      const [pr, message] = args as [{ number: number }, string]
      await octokit.issues.createComment({
        owner,
        repo: name,
        issue_number: pr.number,
        body: message,
      })
      return undefined
    }

    case 'list': {
      const [filter] = args as [{ state?: 'open' | 'closed' | 'all' } | undefined]
      const { data } = await octokit.pulls.list({
        owner,
        repo: name,
        state: filter?.state || 'open',
      })
      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        branch: pr.head.ref,
        url: pr.html_url,
        state: pr.merged_at ? 'merged' : pr.state,
      }))
    }

    default:
      throw new Error(`Unknown GitHub action: ${action}`)
  }
}

async function callTodoApi(
  apiBaseUrl: string,
  action: string,
  args: unknown[]
): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}/todo/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
