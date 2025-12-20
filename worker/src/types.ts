/**
 * Worker environment types
 */

import type { PayloadRPC } from '../../apps/admin/src/rpc'

export interface Env {
  // Bindings
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  AI: any
  LOADER: any
  OAUTH_KV: KVNamespace
  PAYLOAD: Service<PayloadRPC>

  // Cloudflare Workflows
  DEVELOP_WORKFLOW: WorkflowNamespace

  // GitHub App (webhooks only)
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  GITHUB_WEBHOOK_SECRET: string

  // WorkOS (API keys + AuthKit)
  WORKOS_API_KEY: string
  WORKOS_CLIENT_ID: string
  WORKOS_CLIENT_SECRET: string

  // oauth.do (CLI OAuth)
  OAUTH_DO_CLIENT_ID: string
  OAUTH_DO_ISSUER: string

  // Linear Integration
  LINEAR_CLIENT_ID: string
  LINEAR_CLIENT_SECRET: string
  LINEAR_WEBHOOK_SECRET?: string

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
  state: 'open' | 'closed'
  status?: 'open' | 'in_progress' | 'closed'
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
