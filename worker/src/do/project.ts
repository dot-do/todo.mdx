/**
 * Project Durable Object
 * Manages sync state for a GitHub Project (cross-repo roadmap)
 */

import { DurableObject } from 'cloudflare:workers'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
}

export class ProjectDO extends DurableObject {
  private sql: SqlStorage
  private initialized = false

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
  }

  private ensureInitialized() {
    if (this.initialized) return

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS linked_repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        added_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_item_id TEXT NOT NULL UNIQUE,
        content_type TEXT NOT NULL,
        content_id INTEGER,
        repo_id INTEGER,
        title TEXT NOT NULL,
        status TEXT,
        priority TEXT,
        iteration TEXT,
        milestone_title TEXT,
        github_updated_at TEXT,
        last_sync_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_field_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        data_type TEXT NOT NULL,
        options TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS milestone_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        repo_milestones TEXT NOT NULL,
        due_on TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
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
      if (path === '/repos' && request.method === 'GET') {
        return this.listLinkedRepos()
      }

      if (path === '/repos' && request.method === 'POST') {
        return this.linkRepo(request)
      }

      if (path === '/items' && request.method === 'GET') {
        return this.listItems()
      }

      if (path === '/items/sync' && request.method === 'POST') {
        return this.syncItems(request)
      }

      if (path === '/milestones' && request.method === 'GET') {
        return this.listMilestoneMappings()
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

  private listLinkedRepos(): Response {
    const repos = this.sql.exec('SELECT * FROM linked_repos').toArray()
    return Response.json(repos)
  }

  private async linkRepo(request: Request): Promise<Response> {
    const body = await request.json() as {
      repoId: number
      owner: string
      name: string
      fullName: string
    }

    const now = new Date().toISOString()

    this.sql.exec(`
      INSERT OR REPLACE INTO linked_repos (repo_id, owner, name, full_name, added_at)
      VALUES (?, ?, ?, ?, ?)
    `, body.repoId, body.owner, body.name, body.fullName, now)

    return Response.json({ success: true })
  }

  private listItems(): Response {
    const items = this.sql.exec('SELECT * FROM project_items').toArray()
    return Response.json(items)
  }

  private async syncItems(_request: Request): Promise<Response> {
    // TODO: Implement project items sync from GitHub Projects API
    return Response.json({ status: 'not implemented' })
  }

  private listMilestoneMappings(): Response {
    const mappings = this.sql.exec('SELECT * FROM milestone_mappings').toArray()
    return Response.json(mappings)
  }

  private async syncMilestones(_request: Request): Promise<Response> {
    // TODO: Sync milestones across linked repos
    return Response.json({ status: 'not implemented' })
  }

  private getStatus(): Response {
    const repoCount = this.sql.exec('SELECT COUNT(*) as count FROM linked_repos').toArray()[0] as { count: number }
    const itemCount = this.sql.exec('SELECT COUNT(*) as count FROM project_items').toArray()[0] as { count: number }
    const milestoneCount = this.sql.exec('SELECT COUNT(*) as count FROM milestone_mappings').toArray()[0] as { count: number }

    return Response.json({
      linkedRepos: repoCount.count,
      items: itemCount.count,
      milestoneMappings: milestoneCount.count,
    })
  }
}
