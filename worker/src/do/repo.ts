/**
 * Repo Durable Object
 * Manages sync state for a single repository
 */

import { DurableObject } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './repo-schema'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
}

export class RepoDO extends DurableObject {
  private db: ReturnType<typeof drizzle>
  private initialized = false

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.db = drizzle(ctx.storage.sql as unknown as D1Database, { schema })
  }

  private async ensureInitialized() {
    if (this.initialized) return

    // Create tables if they don't exist
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY,
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
        id INTEGER PRIMARY KEY,
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
        id INTEGER PRIMARY KEY,
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
    await this.ensureInitialized()

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

  private async listIssues(): Promise<Response> {
    const issues = this.db.select().from(schema.issues).all()
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
    const results = []

    for (const issue of body.issues) {
      // Find existing issue
      let existing = null
      if (issue.githubId) {
        existing = this.db.select().from(schema.issues)
          .where(({ githubId }) => githubId.eq(issue.githubId))
          .get()
      } else if (issue.beadsId) {
        existing = this.db.select().from(schema.issues)
          .where(({ beadsId }) => beadsId.eq(issue.beadsId))
          .get()
      }

      if (existing) {
        // Last-write-wins
        const existingUpdated = existing.githubUpdatedAt || existing.beadsUpdatedAt || existing.fileUpdatedAt
        if (!existingUpdated || issue.updatedAt > existingUpdated) {
          // Update
          // TODO: Implement update logic
          results.push({ action: 'updated', id: existing.id })
        } else {
          results.push({ action: 'skipped', id: existing.id })
        }
      } else {
        // Insert
        // TODO: Implement insert logic
        results.push({ action: 'created' })
      }
    }

    return Response.json({ synced: results.length, results })
  }

  private async listMilestones(): Promise<Response> {
    const milestones = this.db.select().from(schema.milestones).all()
    return Response.json(milestones)
  }

  private async syncMilestones(request: Request): Promise<Response> {
    // TODO: Implement milestone sync
    return Response.json({ status: 'not implemented' })
  }

  private async getStatus(): Promise<Response> {
    const issueCount = this.db.select().from(schema.issues).all().length
    const milestoneCount = this.db.select().from(schema.milestones).all().length
    const recentLogs = this.db.select().from(schema.syncLog).limit(10).all()

    return Response.json({
      issues: issueCount,
      milestones: milestoneCount,
      recentSyncs: recentLogs,
    })
  }
}
