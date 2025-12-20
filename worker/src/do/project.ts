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

  private async syncItems(request: Request): Promise<Response> {
    const body = await request.json() as {
      action: string
      item: {
        id: number
        node_id: string
        project_node_id: string
        content_node_id?: string
        content_type?: string
        creator?: { login: string }
        created_at: string
        updated_at: string
        archived_at?: string
      }
    }

    const now = new Date().toISOString()
    const item = body.item

    // Check if item already exists
    const existing = this.sql.exec(
      'SELECT * FROM project_items WHERE github_item_id = ?',
      item.node_id
    ).toArray()[0] as any

    if (body.action === 'deleted' || body.action === 'archived') {
      if (existing) {
        this.sql.exec('DELETE FROM project_items WHERE github_item_id = ?', item.node_id)

        // Log the deletion
        this.sql.exec(`
          INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, 'item', item.node_id, body.action, JSON.stringify({ id: item.id }), 'success', now)

        return Response.json({ action: 'deleted', itemId: item.node_id })
      }
      return Response.json({ action: 'ignored', reason: 'item not found' })
    }

    if (existing) {
      // Update existing item
      this.sql.exec(`
        UPDATE project_items SET
          content_type = ?,
          github_updated_at = ?,
          last_sync_at = ?,
          updated_at = ?
        WHERE github_item_id = ?
      `,
        item.content_type || existing.content_type,
        item.updated_at,
        now,
        now,
        item.node_id
      )

      // Log the update
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'item', item.node_id, 'updated', JSON.stringify({ action: body.action }), 'success', now)

      return Response.json({ action: 'updated', itemId: item.node_id })
    } else {
      // Create new item
      this.sql.exec(`
        INSERT INTO project_items (
          github_item_id, content_type, content_id, title,
          github_updated_at, last_sync_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        item.node_id,
        item.content_type || 'unknown',
        item.id,
        `Item ${item.id}`, // Title will be enriched later via GraphQL
        item.updated_at,
        now,
        now,
        now
      )

      // Log the creation
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'item', item.node_id, 'created', JSON.stringify({ action: body.action, contentType: item.content_type }), 'success', now)

      return Response.json({ action: 'created', itemId: item.node_id })
    }
  }

  private listMilestoneMappings(): Response {
    const mappings = this.sql.exec('SELECT * FROM milestone_mappings').toArray()
    return Response.json(mappings)
  }

  private async syncMilestones(request: Request): Promise<Response> {
    const body = await request.json() as {
      action: 'create' | 'update' | 'delete'
      title: string
      dueOn?: string
      repoMilestones?: Array<{
        fullName: string
        milestoneNumber: number
      }>
    }

    const now = new Date().toISOString()

    // Find existing mapping by title
    const existing = this.sql.exec(
      'SELECT * FROM milestone_mappings WHERE title = ?',
      body.title
    ).toArray()[0] as any

    if (body.action === 'delete') {
      if (existing) {
        this.sql.exec('DELETE FROM milestone_mappings WHERE title = ?', body.title)

        // Log the deletion
        this.sql.exec(`
          INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, 'milestone_mapping', body.title, 'deleted', null, 'success', now)

        return Response.json({ action: 'deleted', title: body.title })
      }
      return Response.json({ action: 'ignored', reason: 'mapping not found' })
    }

    const repoMilestonesJson = body.repoMilestones ? JSON.stringify(body.repoMilestones) : '[]'

    if (existing) {
      // Update existing mapping
      this.sql.exec(`
        UPDATE milestone_mappings SET
          repo_milestones = ?,
          due_on = ?,
          updated_at = ?
        WHERE title = ?
      `,
        repoMilestonesJson,
        body.dueOn || null,
        now,
        body.title
      )

      // Log the update
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'milestone_mapping', body.title, 'updated', JSON.stringify({ repoCount: body.repoMilestones?.length || 0 }), 'success', now)

      return Response.json({ action: 'updated', title: body.title })
    } else {
      // Create new mapping
      this.sql.exec(`
        INSERT INTO milestone_mappings (title, repo_milestones, due_on, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        body.title,
        repoMilestonesJson,
        body.dueOn || null,
        now,
        now
      )

      // Log the creation
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'milestone_mapping', body.title, 'created', JSON.stringify({ repoCount: body.repoMilestones?.length || 0 }), 'success', now)

      return Response.json({ action: 'created', title: body.title })
    }
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
