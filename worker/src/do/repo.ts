/**
 * Repo Durable Object
 * Manages sync state for a single repository
 */

import { DurableObject } from 'cloudflare:workers'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
}

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

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
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

    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === '/issues' && request.method === 'GET') {
        return this.listIssues()
      }

      if (path === '/issues/sync' && request.method === 'POST') {
        return this.syncIssues(request)
      }

      if (path === '/milestones' && request.method === 'GET') {
        return this.listMilestones()
      }

      if (path === '/milestones/sync' && request.method === 'POST') {
        return this.syncMilestones(request)
      }

      if (path === '/status' && request.method === 'GET') {
        return this.getStatus()
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  private listIssues(): Response {
    const issues = this.sql.exec('SELECT * FROM issues').toArray()
    return Response.json(issues)
  }

  private async syncIssues(request: Request): Promise<Response> {
    const body = await request.json() as {
      source: 'github' | 'beads' | 'file'
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
        updatedAt: string
      }>
    }

    const now = new Date().toISOString()
    const results: Array<{ action: string; id?: number }> = []

    for (const issue of body.issues) {
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
        if (!existingUpdated || issue.updatedAt > existingUpdated) {
          // Update
          const updateField = body.source === 'github' ? 'github_updated_at' :
                             body.source === 'beads' ? 'beads_updated_at' : 'file_updated_at'

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
            issue.updatedAt,
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
        // Insert
        const updateField = body.source === 'github' ? 'github_updated_at' :
                           body.source === 'beads' ? 'beads_updated_at' : 'file_updated_at'

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
          issue.updatedAt,
          now,
          body.source,
          now,
          now
        )
        results.push({ action: 'created' })
      }
    }

    return Response.json({ synced: results.length, results })
  }

  private listMilestones(): Response {
    const milestones = this.sql.exec('SELECT * FROM milestones').toArray()
    return Response.json(milestones)
  }

  private async syncMilestones(_request: Request): Promise<Response> {
    // TODO: Implement milestone sync (similar pattern to syncIssues)
    return Response.json({ status: 'not implemented' })
  }

  private getStatus(): Response {
    const issueCount = this.sql.exec('SELECT COUNT(*) as count FROM issues').toArray()[0] as { count: number }
    const milestoneCount = this.sql.exec('SELECT COUNT(*) as count FROM milestones').toArray()[0] as { count: number }
    const recentLogs = this.sql.exec('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 10').toArray()

    return Response.json({
      issues: issueCount.count,
      milestones: milestoneCount.count,
      recentSyncs: recentLogs,
    })
  }
}
