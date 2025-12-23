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
  const { issue, repository } = payload
  const repoFullName = repository.full_name

  console.log(`Issue ${action}: ${repoFullName}#${issue.number}`)

  // TODO: Integrate with sync orchestrator
  // This requires beads access which may need additional bindings
}

async function handleCommentEvent(action: string, payload: any, store: ReturnType<typeof db>): Promise<void> {
  const { issue, comment, repository } = payload
  const repoFullName = repository.full_name

  console.log(`Comment ${action} on ${repoFullName}#${issue.number}`)

  // TODO: Sync comments to beads
}

export default app
