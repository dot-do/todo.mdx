/**
 * Repo Durable Object
 * Manages sync state for a single repository
 * Uses XState for sync coordination
 */

import { DurableObject } from 'cloudflare:workers'
import { createActor, setup, assign } from 'xstate'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
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
    const issues = payload.issues || []
    await this.syncIssuesInternal('github', issues)
  }

  private async processBeadsSync(payload: any): Promise<void> {
    // Beads sync payload processing
    const issues = payload.issues || []
    await this.syncIssuesInternal('beads', issues)
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
