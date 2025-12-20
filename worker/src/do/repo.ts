/**
 * Repo Durable Object
 * Manages sync state for a single repository
 * Uses XState for sync coordination
 */

import { DurableObject } from 'cloudflare:workers'
import { createActor, setup, assign } from 'xstate'
import { SignJWT, importPKCS8 } from 'jose'
import type { PayloadRPC } from '../types'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  PAYLOAD: PayloadRPC
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

// Sync event types
type SyncSource = 'github' | 'beads' | 'file' | 'mcp'

interface SyncEvent {
  id: string
  source: SyncSource
  timestamp: string
  payload: any
}

interface SyncContext {
  pendingEvents: SyncEvent[]
  currentEvent: SyncEvent | null
  lastSyncAt: string | null
  errorCount: number
  lastError: string | null
}

// State machine for sync coordination
const syncMachine = setup({
  types: {
    context: {} as SyncContext,
    events: {} as
      | { type: 'ENQUEUE'; event: SyncEvent }
      | { type: 'PROCESS_NEXT' }
      | { type: 'SYNC_COMPLETE' }
      | { type: 'SYNC_ERROR'; error: string }
      | { type: 'RESET' },
  },
  actions: {
    enqueueEvent: assign({
      pendingEvents: ({ context, event }) => {
        if (event.type !== 'ENQUEUE') return context.pendingEvents
        return [...context.pendingEvents, event.event]
      },
    }),
    dequeueEvent: assign({
      currentEvent: ({ context }) => context.pendingEvents[0] || null,
      pendingEvents: ({ context }) => context.pendingEvents.slice(1),
    }),
    clearCurrentEvent: assign({
      currentEvent: () => null,
      lastSyncAt: () => new Date().toISOString(),
    }),
    recordError: assign({
      lastError: ({ event }) => (event.type === 'SYNC_ERROR' ? event.error : null),
      errorCount: ({ context }) => context.errorCount + 1,
    }),
    resetErrors: assign({
      errorCount: () => 0,
      lastError: () => null,
    }),
  },
  guards: {
    hasMoreEvents: ({ context }) => context.pendingEvents.length > 0,
    noMoreEvents: ({ context }) => context.pendingEvents.length === 0,
    tooManyErrors: ({ context }) => context.errorCount >= 5,
  },
}).createMachine({
  id: 'repoSync',
  initial: 'idle',
  context: {
    pendingEvents: [],
    currentEvent: null,
    lastSyncAt: null,
    errorCount: 0,
    lastError: null,
  },
  states: {
    idle: {
      on: {
        ENQUEUE: {
          actions: ['enqueueEvent', 'dequeueEvent'],
          target: 'syncing',
        },
      },
    },
    syncing: {
      on: {
        ENQUEUE: {
          actions: 'enqueueEvent',
        },
        SYNC_COMPLETE: [
          {
            guard: 'hasMoreEvents',
            actions: ['clearCurrentEvent', 'resetErrors', 'dequeueEvent'],
            target: 'syncing',
          },
          {
            guard: 'noMoreEvents',
            actions: ['clearCurrentEvent', 'resetErrors'],
            target: 'idle',
          },
        ],
        SYNC_ERROR: [
          {
            guard: 'tooManyErrors',
            actions: ['recordError', 'clearCurrentEvent'],
            target: 'error',
          },
          {
            actions: ['recordError', 'clearCurrentEvent'],
            target: 'retrying',
          },
        ],
      },
    },
    retrying: {
      after: {
        1000: [
          {
            guard: 'hasMoreEvents',
            actions: 'dequeueEvent',
            target: 'syncing',
          },
          {
            target: 'idle',
          },
        ],
      },
      on: {
        ENQUEUE: {
          actions: 'enqueueEvent',
        },
      },
    },
    error: {
      on: {
        RESET: {
          actions: 'resetErrors',
          target: 'idle',
        },
        ENQUEUE: {
          actions: ['enqueueEvent', 'resetErrors', 'dequeueEvent'],
          target: 'syncing',
        },
      },
    },
  },
})

interface Issue {
  id: number
  github_id: number | null
  github_number: number | null
  beads_id: string | null
  title: string
  body: string | null
  state: string
  labels: string | null
  assignees: string | null
  priority: number | null
  type: string | null
  file_path: string | null
  file_hash: string | null
  github_updated_at: string | null
  beads_updated_at: string | null
  file_updated_at: string | null
  last_sync_at: string | null
  sync_source: string | null
  created_at: string
  updated_at: string
}

export class RepoDO extends DurableObject {
  private sql: SqlStorage
  private initialized = false
  private syncActor: ReturnType<typeof createActor<typeof syncMachine>> | null = null
  private repoFullName: string | null = null
  private installationId: number | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
  }

  /**
   * Initialize repo context from storage
   */
  private async initRepoContext(): Promise<void> {
    if (this.repoFullName && this.installationId) return

    const stored = await this.ctx.storage.get<{ repoFullName: string; installationId: number }>('repoContext')
    if (stored) {
      this.repoFullName = stored.repoFullName
      this.installationId = stored.installationId
    }
  }

  /**
   * Set repo context (called on first use)
   */
  private async setRepoContext(repoFullName: string, installationId: number): Promise<void> {
    this.repoFullName = repoFullName
    this.installationId = installationId
    await this.ctx.storage.put('repoContext', { repoFullName, installationId })
  }

  /**
   * Generate GitHub App JWT for authentication
   */
  private async generateGitHubAppJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)

    // Convert PEM private key to crypto key using jose library
    const privateKeyPEM = (this.env as Env).GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n')

    // Import the private key using jose (handles both PKCS1 and PKCS8 formats)
    const key = await importPKCS8(privateKeyPEM, 'RS256')

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 600) // 10 minutes
      .setIssuer((this.env as Env).GITHUB_APP_ID)
      .sign(key)

    return jwt
  }

  /**
   * Get installation access token from GitHub
   */
  private async getInstallationToken(installationId: number): Promise<string> {
    const jwt = await this.generateGitHubAppJWT()

    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to get installation token: ${response.status} ${error}`)
    }

    const data = await response.json() as { token: string }
    return data.token
  }

  /**
   * Fetch file contents from GitHub repository
   */
  private async fetchGitHubFile(path: string, installationId: number, ref?: string): Promise<string> {
    await this.initRepoContext()
    if (!this.repoFullName) {
      throw new Error('Repo context not initialized')
    }

    const token = await this.getInstallationToken(installationId)
    const url = `https://api.github.com/repos/${this.repoFullName}/contents/${path}${ref ? `?ref=${ref}` : ''}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to fetch file ${path}: ${response.status} ${error}`)
    }

    const data = await response.json() as { content: string; encoding: string }
    if (data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''))
    }
    return data.content
  }

  /**
   * Parse beads issues from JSONL format
   */
  private parseBeadsIssues(jsonl: string): Array<{
    id: string
    title: string
    description?: string
    status: string
    priority?: number
    issue_type?: string
    created_at: string
    updated_at: string
    closed_at?: string
    close_reason?: string
    assignee?: string
    labels?: string[]
    dependencies?: Array<{ issue_id: string; depends_on_id: string; type: string }>
  }> {
    const lines = jsonl.trim().split('\n').filter(line => line.trim())
    return lines.map(line => JSON.parse(line))
  }

  private async initSyncActor() {
    if (this.syncActor) return

    // Restore persisted state if available
    const persistedState = await this.ctx.storage.get<any>('syncState')

    this.syncActor = createActor(syncMachine, {
      snapshot: persistedState || undefined,
    })

    // Persist state on every change
    this.syncActor.subscribe((state) => {
      this.ctx.storage.put('syncState', state.toJSON())
    })

    this.syncActor.start()
  }

  private async enqueueSyncEvent(source: SyncSource, payload: any): Promise<void> {
    await this.initSyncActor()
    if (!this.syncActor) return

    const event: SyncEvent = {
      id: crypto.randomUUID(),
      source,
      timestamp: new Date().toISOString(),
      payload,
    }

    this.syncActor.send({ type: 'ENQUEUE', event })

    // If we just transitioned to syncing, process the event
    const state = this.syncActor.getSnapshot()
    if (state.value === 'syncing' && state.context.currentEvent?.id === event.id) {
      await this.processSyncEvent(event)
    }
  }

  private async processSyncEvent(event: SyncEvent): Promise<void> {
    if (!this.syncActor) return

    try {
      // Process based on source
      switch (event.source) {
        case 'github':
          await this.processGithubSync(event.payload)
          break
        case 'beads':
          await this.processBeadsSync(event.payload)
          break
        case 'file':
          await this.processFileSync(event.payload)
          break
        case 'mcp':
          await this.processMcpSync(event.payload)
          break
      }

      this.syncActor.send({ type: 'SYNC_COMPLETE' })

      // Process next event if any
      const state = this.syncActor.getSnapshot()
      if (state.value === 'syncing' && state.context.currentEvent) {
        await this.processSyncEvent(state.context.currentEvent)
      }
    } catch (error) {
      this.syncActor.send({ type: 'SYNC_ERROR', error: String(error) })
    }
  }

  private async processGithubSync(payload: any): Promise<void> {
    // GitHub webhook payload processing
    console.log('[RepoDO] Processing GitHub sync', { payload })

    // Extract GitHub issue data from webhook
    const githubIssue = payload.issue
    if (!githubIssue) {
      console.log('[RepoDO] No issue in GitHub payload')
      return
    }

    // Map GitHub issue to our format
    const issue = {
      githubId: githubIssue.id,
      githubNumber: githubIssue.number,
      title: githubIssue.title,
      body: githubIssue.body || '',
      state: githubIssue.state, // 'open' or 'closed'
      status: githubIssue.state === 'closed' ? 'closed' : 'open',
      labels: githubIssue.labels?.map((l: any) => l.name) || [],
      assignees: githubIssue.assignees?.map((a: any) => a.login) || [],
      updatedAt: githubIssue.updated_at,
    }

    // Sync to internal storage
    await this.syncIssuesInternal('github', [issue])

    // Sync to Payload CMS
    await this.syncToPayload([issue], 'github')
  }

  private async processBeadsSync(payload: any): Promise<void> {
    // Beads sync payload processing from push webhook
    console.log('[RepoDO] Processing beads sync', { payload })

    const { files, commit, installationId } = payload

    // Check if .beads/issues.jsonl was changed
    if (!files.includes('.beads/issues.jsonl')) {
      console.log('[RepoDO] No .beads/issues.jsonl in changed files')
      return
    }

    try {
      // Fetch the file from GitHub
      const jsonl = await this.fetchGitHubFile('.beads/issues.jsonl', installationId, commit)

      // Parse the JSONL
      const beadsIssues = this.parseBeadsIssues(jsonl)
      console.log('[RepoDO] Parsed beads issues', { count: beadsIssues.length })

      // Map beads issues to our format
      const issues = beadsIssues.map(beadsIssue => ({
        beadsId: beadsIssue.id,
        title: beadsIssue.title,
        body: beadsIssue.description || '',
        state: beadsIssue.status === 'closed' ? 'closed' : 'open',
        status: beadsIssue.status,
        priority: beadsIssue.priority ?? 2,
        type: beadsIssue.issue_type || 'task',
        labels: beadsIssue.labels || [],
        assignees: beadsIssue.assignee ? [beadsIssue.assignee] : [],
        updatedAt: beadsIssue.updated_at,
      }))

      // Sync to internal storage
      await this.syncIssuesInternal('beads', issues)

      // Sync to Payload CMS
      await this.syncToPayload(issues, 'beads')
    } catch (error) {
      console.error('[RepoDO] Failed to process beads sync:', error)
      throw error
    }
  }

  private async processFileSync(payload: any): Promise<void> {
    // File change payload processing
    const issues = payload.issues || []
    await this.syncIssuesInternal('file', issues)
  }

  private async processMcpSync(payload: any): Promise<void> {
    // MCP sync payload processing
    const issues = payload.issues || []
    await this.syncIssuesInternal('mcp', issues)
  }

  /**
   * Sync issues to Payload CMS via RPC
   */
  private async syncToPayload(issues: Array<{
    githubId?: number
    githubNumber?: number
    beadsId?: string
    title: string
    body?: string
    state: string
    status?: string
    labels?: string[]
    assignees?: string[]
    priority?: number
    type?: string
    updatedAt?: string
  }>, source: SyncSource): Promise<void> {
    await this.initRepoContext()
    if (!this.repoFullName) {
      console.log('[RepoDO] Cannot sync to Payload: repo context not initialized')
      return
    }

    const env = this.env as Env
    console.log('[RepoDO] Syncing to Payload', { count: issues.length, source })

    // First, find the repo in Payload to get its ID
    const repoResult = await env.PAYLOAD.find({
      collection: 'repos',
      where: {
        fullName: { equals: this.repoFullName },
      },
      limit: 1,
    })

    if (!repoResult.docs || repoResult.docs.length === 0) {
      console.log('[RepoDO] Repo not found in Payload', { repoFullName: this.repoFullName })
      return
    }

    const repo = repoResult.docs[0]
    console.log('[RepoDO] Found repo in Payload', { repoId: repo.id })

    // Sync each issue
    for (const issue of issues) {
      try {
        // Find existing issue in Payload
        const where: any = {
          repo: { equals: repo.id },
        }

        if (issue.githubId) {
          where.githubId = { equals: issue.githubId }
        } else if (issue.beadsId) {
          where.localId = { equals: issue.beadsId }
        } else {
          // Skip issues without identifiers
          continue
        }

        const existingResult = await env.PAYLOAD.find({
          collection: 'issues',
          where,
          limit: 1,
        })

        const issueData = {
          repo: repo.id,
          localId: issue.beadsId || issue.githubId?.toString() || 'unknown',
          title: issue.title,
          body: issue.body || '',
          state: issue.state,
          status: issue.status || issue.state,
          priority: issue.priority ?? 2,
          type: issue.type || 'task',
          labels: issue.labels || [],
          assignees: issue.assignees || [],
          githubNumber: issue.githubNumber,
          githubId: issue.githubId,
        }

        if (existingResult.docs && existingResult.docs.length > 0) {
          // Update existing issue
          const existing = existingResult.docs[0]
          console.log('[RepoDO] Updating issue in Payload', { id: existing.id, title: issue.title })

          await env.PAYLOAD.update({
            collection: 'issues',
            id: existing.id,
            data: issueData,
          })
        } else {
          // Create new issue
          console.log('[RepoDO] Creating issue in Payload', { title: issue.title })

          await env.PAYLOAD.create({
            collection: 'issues',
            data: issueData,
          })
        }
      } catch (error) {
        console.error('[RepoDO] Failed to sync issue to Payload:', error, { issue })
      }
    }

    console.log('[RepoDO] Payload sync complete')
  }

  private ensureInitialized() {
    if (this.initialized) return

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_id INTEGER UNIQUE,
        github_number INTEGER,
        beads_id TEXT UNIQUE,
        title TEXT NOT NULL,
        body TEXT,
        state TEXT NOT NULL,
        labels TEXT,
        assignees TEXT,
        priority INTEGER,
        type TEXT,
        file_path TEXT,
        file_hash TEXT,
        github_updated_at TEXT,
        beads_updated_at TEXT,
        file_updated_at TEXT,
        last_sync_at TEXT,
        sync_source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_id INTEGER UNIQUE,
        github_number INTEGER,
        beads_id TEXT UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        state TEXT NOT NULL,
        due_on TEXT,
        file_path TEXT,
        file_hash TEXT,
        github_updated_at TEXT,
        beads_updated_at TEXT,
        file_updated_at TEXT,
        last_sync_at TEXT,
        sync_source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        changes TEXT,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      );
    `)

    this.initialized = true
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized()
    await this.initSyncActor()

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Issue endpoints
      if (path === '/issues' && request.method === 'GET') {
        return this.listIssues()
      }

      if (path.match(/^\/issues\/\d+$/) && request.method === 'GET') {
        const id = path.split('/')[2]
        return this.getIssue(id)
      }

      if (path === '/issues/sync' && request.method === 'POST') {
        return this.syncIssues(request)
      }

      // Milestone endpoints
      if (path === '/milestones' && request.method === 'GET') {
        return this.listMilestones()
      }

      if (path.match(/^\/milestones\/\d+$/) && request.method === 'GET') {
        const id = path.split('/')[2]
        return this.getMilestone(id)
      }

      if (path === '/milestones/sync' && request.method === 'POST') {
        return this.syncMilestones(request)
      }

      // Push sync (file changes from GitHub)
      if (path === '/sync/push' && request.method === 'POST') {
        return this.syncPush(request)
      }

      // Status and sync state
      if (path === '/status' && request.method === 'GET') {
        return this.getStatus()
      }

      if (path === '/sync/reset' && request.method === 'POST') {
        return this.resetSyncState()
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  private getIssue(id: string): Response {
    const issues = this.sql.exec('SELECT * FROM issues WHERE id = ? OR github_number = ?', id, id).toArray()
    if (issues.length === 0) {
      return new Response('Not Found', { status: 404 })
    }
    return Response.json(issues[0])
  }

  private getMilestone(id: string): Response {
    const milestones = this.sql.exec('SELECT * FROM milestones WHERE id = ? OR github_number = ?', id, id).toArray()
    if (milestones.length === 0) {
      return new Response('Not Found', { status: 404 })
    }
    return Response.json(milestones[0])
  }

  private resetSyncState(): Response {
    if (this.syncActor) {
      this.syncActor.send({ type: 'RESET' })
    }
    return Response.json({ status: 'reset' })
  }

  private listIssues(): Response {
    const issues = this.sql.exec('SELECT * FROM issues').toArray()
    return Response.json(issues)
  }

  private async syncIssuesInternal(source: SyncSource, issues: Array<{
    githubId?: number
    beadsId?: string
    title: string
    body?: string
    state: string
    labels?: string[]
    assignees?: string[]
    priority?: number
    type?: string
    filePath?: string
    updatedAt?: string
  }>): Promise<Array<{ action: string; id?: number }>> {
    const now = new Date().toISOString()
    const results: Array<{ action: string; id?: number }> = []

    for (const issue of issues) {
      const updatedAt = issue.updatedAt || now

      // Find existing issue
      let existing: Issue | null = null

      if (issue.githubId) {
        const rows = this.sql.exec(
          'SELECT * FROM issues WHERE github_id = ?',
          issue.githubId
        ).toArray() as unknown as Issue[]
        existing = rows[0] || null
      } else if (issue.beadsId) {
        const rows = this.sql.exec(
          'SELECT * FROM issues WHERE beads_id = ?',
          issue.beadsId
        ).toArray() as unknown as Issue[]
        existing = rows[0] || null
      }

      if (existing) {
        // Last-write-wins
        const existingUpdated = existing.github_updated_at || existing.beads_updated_at || existing.file_updated_at
        if (!existingUpdated || updatedAt > existingUpdated) {
          const updateField = source === 'github' ? 'github_updated_at' :
                             source === 'beads' ? 'beads_updated_at' : 'file_updated_at'

          this.sql.exec(`
            UPDATE issues SET
              title = ?,
              body = ?,
              state = ?,
              labels = ?,
              assignees = ?,
              priority = ?,
              type = ?,
              ${updateField} = ?,
              last_sync_at = ?,
              sync_source = ?,
              updated_at = ?
            WHERE id = ?
          `,
            issue.title,
            issue.body || null,
            issue.state,
            issue.labels ? JSON.stringify(issue.labels) : null,
            issue.assignees ? JSON.stringify(issue.assignees) : null,
            issue.priority ?? null,
            issue.type || null,
            updatedAt,
            now,
            source,
            now,
            existing.id
          )
          results.push({ action: 'updated', id: existing.id })
        } else {
          results.push({ action: 'skipped', id: existing.id })
        }
      } else {
        const updateField = source === 'github' ? 'github_updated_at' :
                           source === 'beads' ? 'beads_updated_at' : 'file_updated_at'

        this.sql.exec(`
          INSERT INTO issues (
            github_id, beads_id, title, body, state, labels, assignees,
            priority, type, file_path, ${updateField}, last_sync_at, sync_source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          issue.githubId ?? null,
          issue.beadsId ?? null,
          issue.title,
          issue.body || null,
          issue.state,
          issue.labels ? JSON.stringify(issue.labels) : null,
          issue.assignees ? JSON.stringify(issue.assignees) : null,
          issue.priority ?? null,
          issue.type || null,
          issue.filePath || null,
          updatedAt,
          now,
          source,
          now,
          now
        )
        results.push({ action: 'created' })
      }
    }

    return results
  }

  private async syncIssues(request: Request): Promise<Response> {
    const body = await request.json() as {
      source: 'github' | 'beads' | 'file' | 'mcp'
      issues: Array<{
        githubId?: number
        beadsId?: string
        title: string
        body?: string
        state: string
        labels?: string[]
        assignees?: string[]
        priority?: number
        type?: string
        filePath?: string
        updatedAt?: string
      }>
    }

    // Queue the sync event through the state machine
    await this.enqueueSyncEvent(body.source, { issues: body.issues })

    // Get current state
    const state = this.syncActor?.getSnapshot()

    return Response.json({
      queued: true,
      syncState: state?.value || 'unknown',
      pendingEvents: state?.context.pendingEvents.length || 0,
    })
  }

  private listMilestones(): Response {
    const milestones = this.sql.exec('SELECT * FROM milestones').toArray()
    return Response.json(milestones)
  }

  private async syncMilestones(request: Request): Promise<Response> {
    const body = await request.json() as {
      source: 'github' | 'beads' | 'file' | 'mcp'
      milestones: Array<{
        githubId?: number
        githubNumber?: number
        beadsId?: string
        title: string
        description?: string
        state: string
        dueOn?: string
        filePath?: string
        updatedAt?: string
      }>
    }

    const now = new Date().toISOString()
    const results: Array<{ action: string; id?: number }> = []

    for (const milestone of body.milestones) {
      const updatedAt = milestone.updatedAt || now

      // Find existing milestone
      let existing: any = null

      if (milestone.githubId) {
        const rows = this.sql.exec(
          'SELECT * FROM milestones WHERE github_id = ?',
          milestone.githubId
        ).toArray()
        existing = rows[0] || null
      } else if (milestone.beadsId) {
        const rows = this.sql.exec(
          'SELECT * FROM milestones WHERE beads_id = ?',
          milestone.beadsId
        ).toArray()
        existing = rows[0] || null
      }

      if (existing) {
        // Last-write-wins
        const existingUpdated = existing.github_updated_at || existing.beads_updated_at || existing.file_updated_at
        if (!existingUpdated || updatedAt > existingUpdated) {
          const updateField = body.source === 'github' ? 'github_updated_at' :
                             body.source === 'beads' ? 'beads_updated_at' : 'file_updated_at'

          this.sql.exec(`
            UPDATE milestones SET
              title = ?,
              description = ?,
              state = ?,
              due_on = ?,
              ${updateField} = ?,
              last_sync_at = ?,
              sync_source = ?,
              updated_at = ?
            WHERE id = ?
          `,
            milestone.title,
            milestone.description || null,
            milestone.state,
            milestone.dueOn || null,
            updatedAt,
            now,
            body.source,
            now,
            existing.id
          )
          results.push({ action: 'updated', id: existing.id })
        } else {
          results.push({ action: 'skipped', id: existing.id })
        }
      } else {
        const updateField = body.source === 'github' ? 'github_updated_at' :
                           body.source === 'beads' ? 'beads_updated_at' : 'file_updated_at'

        this.sql.exec(`
          INSERT INTO milestones (
            github_id, github_number, beads_id, title, description, state, due_on,
            file_path, ${updateField}, last_sync_at, sync_source, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          milestone.githubId ?? null,
          milestone.githubNumber ?? null,
          milestone.beadsId ?? null,
          milestone.title,
          milestone.description || null,
          milestone.state,
          milestone.dueOn || null,
          milestone.filePath || null,
          updatedAt,
          now,
          body.source,
          now,
          now
        )
        results.push({ action: 'created' })
      }
    }

    // Log the sync
    this.sql.exec(`
      INSERT INTO sync_log (entity_type, entity_id, action, source, target, changes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, 'milestone', 0, 'sync', body.source, 'local', JSON.stringify({ count: results.length }), 'success', now)

    return Response.json({ synced: results })
  }

  private async syncPush(request: Request): Promise<Response> {
    const body = await request.json() as {
      ref: string
      before: string
      after: string
      files: string[]
      installationId?: number
      repoFullName?: string
    }

    // Initialize repo context if provided
    if (body.repoFullName && body.installationId) {
      await this.setRepoContext(body.repoFullName, body.installationId)
    }

    const now = new Date().toISOString()

    // Log the push event
    this.sql.exec(`
      INSERT INTO sync_log (entity_type, entity_id, action, source, target, changes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, 'push', body.after, 'push', 'github', 'local', JSON.stringify({
      ref: body.ref,
      files: body.files,
      before: body.before,
      after: body.after,
    }), 'pending', now)

    // Categorize files for processing
    const beadsFiles = body.files.filter(f => f.startsWith('.beads/'))
    const todoFiles = body.files.filter(f => f.startsWith('.todo/') || f === 'TODO.md' || f === 'TODO.mdx')
    const roadmapFiles = body.files.filter(f => f.startsWith('.roadmap/') || f === 'ROADMAP.md' || f === 'ROADMAP.mdx')

    // Queue sync events for each category
    if (beadsFiles.length > 0) {
      await this.enqueueSyncEvent('beads', {
        files: beadsFiles,
        commit: body.after,
        installationId: body.installationId,
      })
    }

    if (todoFiles.length > 0) {
      await this.enqueueSyncEvent('file', {
        type: 'todo',
        files: todoFiles,
        commit: body.after,
        installationId: body.installationId,
      })
    }

    if (roadmapFiles.length > 0) {
      await this.enqueueSyncEvent('file', {
        type: 'roadmap',
        files: roadmapFiles,
        commit: body.after,
        installationId: body.installationId,
      })
    }

    // Get current sync state
    const state = this.syncActor?.getSnapshot()

    return Response.json({
      queued: true,
      files: {
        beads: beadsFiles.length,
        todo: todoFiles.length,
        roadmap: roadmapFiles.length,
      },
      syncState: state?.value || 'unknown',
      pendingEvents: state?.context.pendingEvents.length || 0,
    })
  }

  private getStatus(): Response {
    const issueCount = this.sql.exec('SELECT COUNT(*) as count FROM issues').toArray()[0] as { count: number }
    const milestoneCount = this.sql.exec('SELECT COUNT(*) as count FROM milestones').toArray()[0] as { count: number }
    const recentLogs = this.sql.exec('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 10').toArray()

    // Get sync state machine status
    const state = this.syncActor?.getSnapshot()
    const syncStatus = state ? {
      state: state.value,
      pendingEvents: state.context.pendingEvents.length,
      currentEvent: state.context.currentEvent,
      lastSyncAt: state.context.lastSyncAt,
      errorCount: state.context.errorCount,
      lastError: state.context.lastError,
    } : null

    return Response.json({
      issues: issueCount.count,
      milestones: milestoneCount.count,
      recentSyncs: recentLogs,
      syncStatus,
    })
  }
}
