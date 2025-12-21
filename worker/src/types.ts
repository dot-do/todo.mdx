/**
 * Worker environment types
 */

// Payload API helper - wraps HTTP calls to Payload's REST API
export class PayloadAPI {
  constructor(private service: Fetcher) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    sort?: string
    overrideAccess?: boolean
  }): Promise<{ docs: any[]; totalDocs: number }> {
    const params = new URLSearchParams()
    if (args.where) params.set('where', JSON.stringify(args.where))
    if (args.limit) params.set('limit', String(args.limit))
    if (args.depth) params.set('depth', String(args.depth))
    if (args.sort) params.set('sort', args.sort)

    const response = await this.service.fetch(
      `http://internal/api/${args.collection}?${params}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(args.overrideAccess ? { 'X-Payload-Override-Access': 'true' } : {}),
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Payload find failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async findByID(args: {
    collection: string
    id: string | number
    depth?: number
    overrideAccess?: boolean
  }): Promise<any> {
    const params = new URLSearchParams()
    if (args.depth) params.set('depth', String(args.depth))

    const response = await this.service.fetch(
      `http://internal/api/${args.collection}/${args.id}?${params}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(args.overrideAccess ? { 'X-Payload-Override-Access': 'true' } : {}),
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Payload findByID failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async create(args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess?: boolean
  }): Promise<any> {
    const response = await this.service.fetch(
      `http://internal/api/${args.collection}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(args.overrideAccess ? { 'X-Payload-Override-Access': 'true' } : {}),
        },
        body: JSON.stringify(args.data),
      }
    )

    if (!response.ok) {
      throw new Error(`Payload create failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async update(args: {
    collection: string
    id: string | number
    data: Record<string, unknown>
    overrideAccess?: boolean
  }): Promise<any> {
    const response = await this.service.fetch(
      `http://internal/api/${args.collection}/${args.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(args.overrideAccess ? { 'X-Payload-Override-Access': 'true' } : {}),
        },
        body: JSON.stringify(args.data),
      }
    )

    if (!response.ok) {
      throw new Error(`Payload update failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }

  async delete(args: {
    collection: string
    id: string | number
    overrideAccess?: boolean
  }): Promise<any> {
    const response = await this.service.fetch(
      `http://internal/api/${args.collection}/${args.id}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(args.overrideAccess ? { 'X-Payload-Override-Access': 'true' } : {}),
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Payload delete failed: ${response.status} ${await response.text()}`)
    }

    return response.json()
  }
}

export interface Env {
  // Bindings
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  SESSION: DurableObjectNamespace
  MCP_OBJECT: DurableObjectNamespace
  CLAUDE_SANDBOX: DurableObjectNamespace
  AI: Ai
  VECTORIZE: VectorizeIndex
  LOADER: any
  OAUTH_KV: KVNamespace
  // PAYLOAD_SERVICE is a service binding to the Payload CMS worker (HTTP, not RPC)
  PAYLOAD_SERVICE: Fetcher

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
  CLAUDE_CODE_OAUTH_TOKEN?: string

  // Testing
  TEST_API_KEY?: string
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
