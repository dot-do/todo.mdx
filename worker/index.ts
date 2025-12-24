/**
 * GitHub Sync Worker
 *
 * Cloudflare Worker that handles GitHub webhooks for bidirectional
 * sync between GitHub Issues and beads.
 *
 * Consumers can self-host by re-exporting:
 * ```ts
 * // their-worker/index.ts
 * export { default } from 'todo.mdx/worker'
 * export { DB } from 'db.td/worker'
 * ```
 * And providing their own wrangler.jsonc with:
 * ```jsonc
 * {
 *   "main": "index.ts",
 *   "durable_objects": {
 *     "bindings": [{ "name": "DB", "class_name": "DB" }]
 *   },
 *   "migrations": [{ "tag": "v1", "new_classes": ["DB"] }]
 * }
 * ```
 */

import { Hono } from 'hono'
import { db } from 'db.td/worker'
import {
  createWebhookHandler,
  type WebhookEvent,
  createSyncOrchestrator,
  createGitHubClient,
  defaultConventions,
  type BeadsIssue,
  type Installation,
  type IssueMapping,
} from './github-sync'

export interface Env {
  // Secrets
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  GITHUB_WEBHOOK_SECRET: string

  // Durable Object binding for db.td
  DB: DurableObjectNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'todo.mdx-github-sync' })
})

// GitHub webhook endpoint
app.post('/webhook', async (c) => {
  const webhookHandler = createWebhookHandler({
    secret: c.env.GITHUB_WEBHOOK_SECRET,
    onEvent: async (event: WebhookEvent) => {
      await handleWebhookEvent(event, c.env)
    },
  })

  return webhookHandler(c)
})

async function handleWebhookEvent(event: WebhookEvent, env: Env): Promise<void> {
  const { event: eventType, action, payload } = event

  // Get db instance for github-sync namespace
  const store = db({ env, namespace: 'github-sync' })

  // Handle installation events
  if (eventType === 'installation') {
    if (action === 'created') {
      await handleInstallationCreated(payload, store)
    } else if (action === 'deleted') {
      await handleInstallationDeleted(payload, store)
    }
    return
  }

  // Handle issue events
  if (eventType === 'issues') {
    await handleIssueEvent(action, payload, store)
    return
  }

  // Handle issue comment events (for syncing comments)
  if (eventType === 'issue_comment') {
    await handleCommentEvent(action, payload, store)
    return
  }

  console.log(`Unhandled event: ${eventType}.${action}`)
}

async function handleInstallationCreated(payload: any, store: ReturnType<typeof db>): Promise<void> {
  const installationId = payload.installation.id
  const account = payload.installation.account

  // Store installation in db.td
  await store.Installation.create({
    installationId,
    accountLogin: account.login,
    accountId: account.id,
    accountType: account.type,
  })

  console.log(`Installation created for ${account.login}`)
}

async function handleInstallationDeleted(payload: any, store: ReturnType<typeof db>): Promise<void> {
  const account = payload.installation.account

  // Find and delete installation
  const installations = await store.Installation.list()
  const installation = installations.find((i: any) => i.accountLogin === account.login)

  if (installation) {
    await store.Installation.delete(installation.$id)
  }

  console.log(`Installation deleted for ${account.login}`)
}

async function handleIssueEvent(action: string, payload: any, store: ReturnType<typeof db>): Promise<void> {
  const { issue, repository, installation } = payload
  const repoFullName = repository.full_name
  const [owner, repo] = repoFullName.split('/')

  console.log(`Issue ${action}: ${repoFullName}#${issue.number}`)

  // Find installation in db
  const installations = await store.Installation.list()
  const installationRecord = installations.find(
    (i: any) => i.owner === owner && i.repo === repo
  ) as Installation | undefined

  if (!installationRecord) {
    console.log(`No installation found for ${repoFullName}`)
    return
  }

  // Create GitHub client
  const githubClient = createGitHubClient({
    token: installationRecord.accessToken,
  })

  // Create beadsOps adapter
  const beadsOps = {
    async getIssue(id: string): Promise<BeadsIssue | null> {
      const issues = await store.BeadsIssue.list()
      const found = issues.find((i: any) => i.id === id)
      return found ? (found as BeadsIssue) : null
    },
    async createIssue(issue: BeadsIssue): Promise<BeadsIssue> {
      const created = await store.BeadsIssue.create(issue)
      return created as BeadsIssue
    },
    async updateIssue(id: string, issue: Partial<BeadsIssue>): Promise<BeadsIssue> {
      const updated = await store.BeadsIssue.update(id, issue)
      return updated as BeadsIssue
    },
    async listIssues(): Promise<BeadsIssue[]> {
      const issues = await store.BeadsIssue.list()
      return issues as BeadsIssue[]
    },
  }

  // Create mappingOps adapter
  const mappingOps = {
    async getMapping(beadsId: string): Promise<IssueMapping | null> {
      const mappings = await store.IssueMapping.list()
      const found = mappings.find((m: any) => m.beadsId === beadsId)
      return found ? (found as IssueMapping) : null
    },
    async getMappingByGitHub(number: number): Promise<IssueMapping | null> {
      const mappings = await store.IssueMapping.list()
      const found = mappings.find((m: any) => m.githubNumber === number)
      return found ? (found as IssueMapping) : null
    },
    async createMapping(mapping: Omit<IssueMapping, '$type' | '$id'>): Promise<IssueMapping> {
      const created = await store.IssueMapping.create(mapping)
      return created as IssueMapping
    },
    async updateMapping(id: string, data: Partial<IssueMapping>): Promise<IssueMapping> {
      const updated = await store.IssueMapping.update(id, data)
      return updated as IssueMapping
    },
  }

  // Create sync orchestrator
  const orchestrator = createSyncOrchestrator({
    installation: installationRecord,
    githubClient,
    conventions: installationRecord.conventions || defaultConventions,
    beadsOps,
    mappingOps,
  })

  // Process the webhook event
  const result = await orchestrator.processWebhookEvent({
    event: 'issues',
    action,
    deliveryId: payload.delivery_id || `${Date.now()}`,
    payload,
  })

  // Log results
  if (result.created.length > 0) {
    console.log(`Created ${result.created.length} beads issue(s)`)
  }
  if (result.updated.length > 0) {
    console.log(`Updated ${result.updated.length} beads issue(s)`)
  }
  if (result.errors.length > 0) {
    console.error(`Errors: ${result.errors.map(e => e.error).join(', ')}`)
  }
}

async function handleCommentEvent(action: string, payload: any, store: ReturnType<typeof db>): Promise<void> {
  const { issue, comment, repository } = payload
  const repoFullName = repository.full_name
  const [owner, repo] = repoFullName.split('/')

  console.log(`Comment ${action} on ${repoFullName}#${issue.number}`)

  // Find the corresponding beads issue via mapping
  const mappings = await store.IssueMapping.list()
  const mapping = mappings.find((m: any) => m.githubNumber === issue.number) as IssueMapping | undefined

  if (!mapping) {
    console.log(`No mapping found for GitHub issue #${issue.number}`)
    return
  }

  // Store comment as a separate entity for potential future use
  // Note: The current sync orchestrator focuses on issues, not comments
  // This is a placeholder for future comment sync functionality
  try {
    await store.IssueComment.create({
      issueMappingId: mapping.$id,
      beadsId: mapping.beadsId,
      githubNumber: issue.number,
      commentId: comment.id,
      commentUrl: comment.html_url,
      author: comment.user.login,
      body: comment.body,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      action,
    })

    console.log(`Stored comment ${comment.id} for beads issue ${mapping.beadsId}`)
  } catch (error) {
    console.error(`Failed to store comment: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export default app
