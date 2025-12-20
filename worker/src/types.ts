/**
 * Worker environment types
 */

export interface Env {
  // Bindings
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  AI: any
  LOADER: any
  OAUTH_KV: KVNamespace

  // GitHub App (webhooks only)
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  GITHUB_WEBHOOK_SECRET: string

  // WorkOS (API keys + AuthKit)
  WORKOS_API_KEY: string
  WORKOS_CLIENT_ID: string

  // oauth.do (CLI OAuth)
  OAUTH_DO_CLIENT_ID: string
  OAUTH_DO_ISSUER: string

  // AI
  ANTHROPIC_API_KEY?: string
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
