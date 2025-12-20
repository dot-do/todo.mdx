/**
 * Worker environment types
 */

// PayloadRPC type - the actual implementation is in the admin app
// We use a generic interface here since we access it via RPC
export interface PayloadRPC {
  find(args: { collection: string; where?: Record<string, unknown>; limit?: number; depth?: number; sort?: string }): Promise<{ docs: any[]; totalDocs: number }>
  findByID(args: { collection: string; id: string; depth?: number }): Promise<any>
  create(args: { collection: string; data: Record<string, unknown> }): Promise<any>
  update(args: { collection: string; id: string; data: Record<string, unknown> }): Promise<any>
  delete(args: { collection: string; id: string }): Promise<any>
}

export interface Env {
  // Bindings
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  MCP_OBJECT: DurableObjectNamespace
  CLAUDE_SANDBOX: DurableObjectNamespace
  AI: Ai
  VECTORIZE: VectorizeIndex
  LOADER: any
  OAUTH_KV: KVNamespace
  // PAYLOAD is a service binding to the Payload CMS worker
  // We cast to PayloadRPC in the calling code for type safety
  PAYLOAD: PayloadRPC

  // Cloudflare Workflows
  DEVELOP_WORKFLOW: WorkflowNamespace
  EMBED_WORKFLOW: WorkflowNamespace
  BULK_EMBED_WORKFLOW: WorkflowNamespace

  // GitHub App (webhooks only)
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  GITHUB_WEBHOOK_SECRET: string

  // Linear Integration
  LINEAR_CLIENT_ID?: string
  LINEAR_CLIENT_SECRET?: string
  LINEAR_WEBHOOK_SECRET?: string

  // WorkOS AuthKit
  WORKOS_API_KEY: string
  WORKOS_CLIENT_ID: string
  WORKOS_CLIENT_SECRET: string
  COOKIE_ENCRYPTION_KEY: string

  // AI
  ANTHROPIC_API_KEY?: string
}

// Cloudflare Workflows types
export interface WorkflowNamespace {
  create<T = any>(options: { id: string; params: T }): Promise<WorkflowInstance<T>>
  get<T = any>(id: string): Promise<WorkflowInstance<T>>
}

export interface WorkflowInstance<T = any> {
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
