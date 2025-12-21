/**
 * Cloudflare Worker environment bindings
 */

export interface Env {
  // D1 Database
  DB: D1Database

  // Durable Object Namespaces
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  PRDO: DurableObjectNamespace
  SESSION: DurableObjectNamespace
  MCP_OBJECT: DurableObjectNamespace
  CLAUDE_SANDBOX: DurableObjectNamespace

  // AI & Vector
  AI: Ai
  VECTORIZE: VectorizeIndex

  // KV & Storage
  OAUTH_KV: KVNamespace
  ASSETS: Fetcher

  // Cloudflare Loader (for module loading)
  LOADER: Fetcher

  // Cloudflare Workflows
  DEVELOP_WORKFLOW: WorkflowNamespace
  EMBED_WORKFLOW: WorkflowNamespace
  BULK_EMBED_WORKFLOW: WorkflowNamespace
  BEADS_SYNC_WORKFLOW: WorkflowNamespace

  // GitHub App secrets
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  GITHUB_WEBHOOK_SECRET: string

  // WorkOS AuthKit secrets
  WORKOS_API_KEY: string
  WORKOS_CLIENT_ID: string
  WORKOS_CLIENT_SECRET: string
  COOKIE_ENCRYPTION_KEY: string

  // AI API keys
  ANTHROPIC_API_KEY?: string
  CLAUDE_CODE_OAUTH_TOKEN?: string

  // Testing
  TEST_API_KEY?: string

  // Payload CMS
  PAYLOAD_SECRET: string
}

// Cloudflare Workflows types
export interface WorkflowNamespace {
  create<T = unknown>(options: { id: string; params: T }): Promise<WorkflowInstance<T>>
  get<T = unknown>(id: string): Promise<WorkflowInstance<T>>
}

export interface WorkflowInstance<T = unknown> {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
  params: T
  pause(): Promise<void>
  resume(): Promise<void>
  terminate(): Promise<void>
}

export interface Issue {
  id: string
  title: string
  body?: string
  status: 'open' | 'in_progress' | 'closed'
  labels?: string[]
  assignees?: string[]
  milestoneId?: string
  githubNumber?: number
  priority?: number
  dependsOn?: string[]
  created: string
  updated: string
}

export interface Milestone {
  id: string
  title: string
  description?: string
  state: 'open' | 'closed'
  dueOn?: string
  githubNumber?: number
  created: string
  updated: string
}

export interface SyncStatus {
  state: string
  lastSyncAt?: string
  error?: string
  pendingEvents: number
}
