/**
 * Sandboxed Worker Loader
 *
 * Loads dynamic worker code with CapnWeb-based capability security.
 * All network access from the sandbox is routed through CapnWeb RPC.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import type { Env } from '../types'
import { handleSandboxRpc } from './server'
import { getGitHubToken } from '../auth/vault'

/**
 * Configuration for loading a sandboxed worker
 */
export interface SandboxConfig {
  /** Unique ID for this sandbox instance */
  id: string
  /** Repository full name (owner/repo) for scoping access */
  repoFullName: string
  /** GitHub installation ID for API access */
  installationId: number
  /** The workflow code to execute */
  code: string
  /** Optional additional modules */
  modules?: Record<string, string>
}

/**
 * Workflow trigger types
 */
export interface WorkflowTrigger {
  type: 'webhook' | 'schedule' | 'issue_event' | 'milestone_event'
  filter?: string
}

/**
 * Workflow module metadata
 */
export interface WorkflowModule {
  name: string
  code: string
  triggers: WorkflowTrigger[]
  loadedAt: Date
}

/**
 * Cache entry for workflow modules
 */
interface WorkflowCacheEntry {
  workflows: Map<string, WorkflowModule>
  loadedAt: Date
  expiresAt: Date
}

/**
 * Workflow registry manages loaded workflows per repo
 */
export class WorkflowRegistry {
  private cache = new Map<string, WorkflowCacheEntry>()
  private readonly cacheTTLMs = 5 * 60 * 1000 // 5 minutes

  /**
   * Get workflows for a repo (cached)
   */
  async getWorkflows(
    env: Env,
    repoFullName: string,
    installationId: number
  ): Promise<Map<string, WorkflowModule>> {
    const cached = this.cache.get(repoFullName)

    // Return cached if valid
    if (cached && cached.expiresAt > new Date()) {
      return cached.workflows
    }

    // Load fresh workflows from GitHub
    const workflows = await loadWorkflowsFromRepo(env, repoFullName, installationId)

    // Cache the results
    const now = new Date()
    this.cache.set(repoFullName, {
      workflows,
      loadedAt: now,
      expiresAt: new Date(now.getTime() + this.cacheTTLMs),
    })

    return workflows
  }

  /**
   * Invalidate cache for a repo (e.g., when workflows are updated)
   */
  invalidate(repoFullName: string): void {
    this.cache.delete(repoFullName)
  }

  /**
   * Clear all cached workflows
   */
  clearAll(): void {
    this.cache.clear()
  }

  /**
   * Get workflow by name from cache
   */
  getWorkflow(repoFullName: string, workflowName: string): WorkflowModule | null {
    const cached = this.cache.get(repoFullName)
    if (!cached || cached.expiresAt <= new Date()) {
      return null
    }
    return cached.workflows.get(workflowName) || null
  }
}

/**
 * Global workflow registry instance
 */
const workflowRegistry = new WorkflowRegistry()

/**
 * Outbound proxy that intercepts all fetch requests from the sandbox
 * and routes RPC calls to the CapnWeb server
 */
export class SandboxOutboundProxy extends WorkerEntrypoint<Env> {
  private repoFullName: string
  private installationId: number

  constructor(ctx: ExecutionContext, env: Env, props: { repoFullName: string; installationId: number }) {
    super(ctx, env)
    this.repoFullName = props.repoFullName
    this.installationId = props.installationId
  }

  /**
   * All fetch requests from the sandbox come through here
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Route CapnWeb RPC requests to our server
    if (url.hostname === 'rpc.sandbox' || url.pathname.startsWith('/rpc')) {
      return handleSandboxRpc(
        request,
        this.env,
        this.repoFullName,
        this.installationId
      )
    }

    // Block all other network access
    return new Response('Network access denied from sandbox', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

/**
 * Load workflows from a repo's .workflows/ directory
 *
 * Fetches compiled workflow JavaScript files from GitHub.
 * Each .js file in .workflows/ is loaded as a separate workflow module.
 */
async function loadWorkflowsFromRepo(
  env: Env,
  repoFullName: string,
  installationId: number
): Promise<Map<string, WorkflowModule>> {
  const workflows = new Map<string, WorkflowModule>()

  try {
    // Get installation token
    const token = await getGitHubToken(env, installationId.toString(), 'installation')
    if (!token) {
      console.warn(`[Workflows] No GitHub token for installation ${installationId}`)
      return workflows
    }

    // Fetch .workflows/ directory contents
    const [owner, repo] = repoFullName.split('/')
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/.workflows`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'todo.mdx-worker',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        // No .workflows/ directory, that's ok
        console.log(`[Workflows] No .workflows/ directory in ${repoFullName}`)
        return workflows
      }
      throw new Error(`GitHub API error: ${response.status} ${await response.text()}`)
    }

    const files = await response.json() as Array<{
      name: string
      type: string
      download_url: string
    }>

    // Load each .js file as a workflow
    for (const file of files) {
      if (!file.name.endsWith('.js') || file.type !== 'file') {
        continue
      }

      try {
        // Fetch the workflow file content
        const fileResponse = await fetch(file.download_url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'todo.mdx-worker',
          },
        })

        if (!fileResponse.ok) {
          console.warn(`[Workflows] Failed to fetch ${file.name}: ${fileResponse.status}`)
          continue
        }

        const code = await fileResponse.text()
        const workflowName = file.name.replace(/\.js$/, '')

        // Parse triggers from code comments or exports
        // For now, default to webhook triggers
        const triggers: WorkflowTrigger[] = [
          { type: 'webhook' },
        ]

        workflows.set(workflowName, {
          name: workflowName,
          code,
          triggers,
          loadedAt: new Date(),
        })

        console.log(`[Workflows] Loaded workflow: ${workflowName} from ${repoFullName}`)
      } catch (err) {
        console.error(`[Workflows] Error loading ${file.name}:`, err)
      }
    }
  } catch (err) {
    console.error(`[Workflows] Error loading workflows from ${repoFullName}:`, err)
  }

  return workflows
}

/**
 * Client code injected into the sandbox
 * This sets up the CapnWeb client with fetch routed through the proxy
 */
const SANDBOX_CLIENT_CODE = `
import { newWebSocketRpcSession } from 'capnweb';

// Create RPC session that uses fetch (which is proxied to host)
// The host intercepts and routes to CapnWeb server
const api = newWebSocketRpcSession('ws://rpc.sandbox/');

// Export the API for workflow code to use
export { api };

// Re-export common utilities
export const log = (level, message) => api.log(level, message);

export const issues = {
  get: (id) => api.getIssue(id),
  list: (options) => api.listIssues(options),
  update: (id, data) => api.updateIssue(id, data),
  close: (id, reason) => api.closeIssue(id, reason),
};

export const milestones = {
  get: (id) => api.getMilestone(id),
  list: (options) => api.listMilestones(options),
  update: (id, data) => api.updateMilestone(id, data),
  close: (id) => api.closeMilestone(id),
};

export const github = {
  createComment: (issueNumber, body) => api.githubCreateComment(issueNumber, body),
  updateIssue: (issueNumber, data) => api.githubUpdateIssue(issueNumber, data),
  createLabel: (name, color, description) => api.githubCreateLabel(name, color, description),
  addLabels: (issueNumber, labels) => api.githubAddLabels(issueNumber, labels),
};

export const schedule = {
  delay: (ms, callback) => api.scheduleDelay(ms, callback),
  cron: (pattern, callback) => api.scheduleCron(pattern, callback),
};

export const todo = {
  render: () => api.renderTodo(),
};
`

/**
 * Load a sandboxed worker with CapnWeb-based capability security
 */
export async function loadSandboxedWorker(
  env: Env,
  ctx: ExecutionContext,
  config: SandboxConfig
) {
  const { id, repoFullName, installationId, code, modules = {} } = config

  // Get worker stub from loader
  const worker = env.LOADER.get(id, async () => {
    return {
      compatibilityDate: '2025-06-01',
      compatibilityFlags: ['nodejs_compat'],
      mainModule: 'workflow.js',
      modules: {
        // Inject CapnWeb client wrapper
        'sandbox-client.js': SANDBOX_CLIENT_CODE,
        // The workflow code that will use the client
        'workflow.js': code,
        // Additional modules
        ...modules,
      },
      env: {
        // No direct bindings - everything goes through RPC
      },
      // Route all outbound through our proxy
      globalOutbound: new SandboxOutboundProxy(ctx, env, {
        repoFullName,
        installationId,
      }),
    }
  })

  return worker.getEntrypoint()
}

/**
 * Execute workflow code in a sandbox
 */
export async function executeSandboxedWorkflow(
  env: Env,
  ctx: ExecutionContext,
  config: SandboxConfig & {
    /** Entry function to call */
    entrypoint?: string
    /** Arguments to pass to the entry function */
    args?: any[]
  }
): Promise<any> {
  const { entrypoint = 'run', args = [] } = config

  const worker = await loadSandboxedWorker(env, ctx, config)

  // Call the workflow's entry function
  const response = await worker.fetch(new Request('http://sandbox/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entrypoint,
      args,
    }),
  }))

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Sandbox execution failed: ${error}`)
  }

  return response.json()
}

/**
 * Execute a workflow trigger for a specific repo
 *
 * Loads the workflow from the repo and executes it in a sandbox
 */
export async function executeWorkflowTrigger(
  env: Env,
  ctx: ExecutionContext,
  repoFullName: string,
  installationId: number,
  workflowName: string,
  trigger: WorkflowTrigger,
  payload: any
): Promise<any> {
  console.log(`[Workflows] Executing ${workflowName} for ${repoFullName}`)

  // Get workflows for this repo
  const workflows = await workflowRegistry.getWorkflows(env, repoFullName, installationId)
  const workflow = workflows.get(workflowName)

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowName} in ${repoFullName}`)
  }

  // Check if workflow supports this trigger
  const supportsTrigger = workflow.triggers.some(t => {
    if (t.type !== trigger.type) return false
    if (t.filter && trigger.filter && t.filter !== trigger.filter) return false
    return true
  })

  if (!supportsTrigger) {
    console.warn(`[Workflows] ${workflowName} does not support trigger type: ${trigger.type}`)
    return null
  }

  // Execute the workflow in a sandbox
  return executeSandboxedWorkflow(env, ctx, {
    id: `${repoFullName}/${workflowName}/${Date.now()}`,
    repoFullName,
    installationId,
    code: workflow.code,
    entrypoint: 'run',
    args: [trigger, payload],
  })
}

/**
 * Export the global workflow registry
 */
export { workflowRegistry }
