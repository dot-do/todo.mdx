/**
 * Project Durable Object
 * Manages sync state for a GitHub Project (cross-repo roadmap)
 * Uses XState for cross-repo sync coordination
 */

import { DurableObject } from 'cloudflare:workers'
import { createActor, setup, assign } from 'xstate'
import { getInstallationToken } from '../utils/github-auth'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

// Sync event types
type SyncEventType = 'item_changed' | 'milestone_changed' | 'field_updated' | 'repo_linked'

interface ProjectSyncEvent {
  id: string
  type: SyncEventType
  timestamp: string
  payload: any
  affectedRepos: string[]
}

interface ProjectSyncContext {
  pendingEvents: ProjectSyncEvent[]
  currentEvent: ProjectSyncEvent | null
  lastSyncAt: string | null
  errorCount: number
  lastError: string | null
  projectNodeId: string | null
}

// State machine for cross-repo sync coordination
const projectSyncMachine = setup({
  types: {
    context: {} as ProjectSyncContext,
    events: {} as
      | { type: 'ENQUEUE'; event: ProjectSyncEvent }
      | { type: 'PROCESS_NEXT' }
      | { type: 'SYNC_COMPLETE' }
      | { type: 'SYNC_ERROR'; error: string }
      | { type: 'RESET' }
      | { type: 'SET_PROJECT_ID'; projectId: string },
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
    setProjectId: assign({
      projectNodeId: ({ event }) => (event.type === 'SET_PROJECT_ID' ? event.projectId : null),
    }),
  },
  guards: {
    hasMoreEvents: ({ context }) => context.pendingEvents.length > 0,
    noMoreEvents: ({ context }) => context.pendingEvents.length === 0,
    tooManyErrors: ({ context }) => context.errorCount >= 5,
  },
}).createMachine({
  id: 'projectSync',
  initial: 'idle',
  context: {
    pendingEvents: [],
    currentEvent: null,
    lastSyncAt: null,
    errorCount: 0,
    lastError: null,
    projectNodeId: null,
  },
  states: {
    idle: {
      on: {
        ENQUEUE: {
          actions: ['enqueueEvent', 'dequeueEvent'],
          target: 'syncing',
        },
        SET_PROJECT_ID: {
          actions: 'setProjectId',
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
        2000: [
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

// GitHub GraphQL types
interface GraphQLProjectItem {
  id: string
  fieldValues: {
    nodes: Array<{
      field: { name: string }
      name?: string
      text?: string
      date?: string
      number?: number
    }>
  }
  content: {
    id: string
    number?: number
    title?: string
    repository?: {
      nameWithOwner: string
    }
  }
}

interface GraphQLProjectField {
  id: string
  name: string
  dataType: string
  options?: Array<{ id: string; name: string }>
}

export class ProjectDO extends DurableObject<Env> {
  private sql: SqlStorage
  private initialized = false
  private syncActor: ReturnType<typeof createActor<typeof projectSyncMachine>> | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
  }

  /**
   * Initialize the XState sync actor
   */
  private async initSyncActor() {
    if (this.syncActor) return

    // Restore persisted state if available
    const persistedState = await this.ctx.storage.get<any>('syncState')

    this.syncActor = createActor(projectSyncMachine, {
      snapshot: persistedState || undefined,
    })

    // Persist state on every change
    this.syncActor.subscribe((state) => {
      this.ctx.storage.put('syncState', state.toJSON())
    })

    this.syncActor.start()
  }

  /**
   * Enqueue a sync event through the state machine
   */
  private async enqueueSyncEvent(
    type: SyncEventType,
    payload: any,
    affectedRepos: string[]
  ): Promise<void> {
    await this.initSyncActor()
    if (!this.syncActor) return

    const event: ProjectSyncEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      payload,
      affectedRepos,
    }

    this.syncActor.send({ type: 'ENQUEUE', event })

    // If we just transitioned to syncing, process the event
    const state = this.syncActor.getSnapshot()
    if (state.value === 'syncing' && state.context.currentEvent?.id === event.id) {
      await this.processSyncEvent(event)
    }
  }

  /**
   * Process a sync event from the queue
   */
  private async processSyncEvent(event: ProjectSyncEvent): Promise<void> {
    if (!this.syncActor) return

    try {
      // Process based on event type
      switch (event.type) {
        case 'item_changed':
          await this.processItemChange(event.payload, event.affectedRepos)
          break
        case 'milestone_changed':
          await this.processMilestoneChange(event.payload, event.affectedRepos)
          break
        case 'field_updated':
          await this.processFieldUpdate(event.payload)
          break
        case 'repo_linked':
          await this.processRepoLinked(event.payload)
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

  /**
   * Execute GitHub GraphQL query
   */
  private async executeGraphQL<T = any>(
    query: string,
    variables: Record<string, any>,
    installationId: number
  ): Promise<T> {
    const token = await getInstallationToken(installationId, this.env)

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'todo.mdx',
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${await response.text()}`)
    }

    const result = await response.json() as { data: T; errors?: any[] }

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
    }

    return result.data
  }

  /**
   * Fetch project items with full details from GitHub GraphQL
   */
  private async fetchProjectItems(
    projectNodeId: string,
    installationId: number
  ): Promise<GraphQLProjectItem[]> {
    const query = `
      query GetProjectItems($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { name }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field { name }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { name }
                    }
                    ... on ProjectV2ItemFieldNumberValue {
                      number
                      field { name }
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                    title
                    repository {
                      nameWithOwner
                    }
                  }
                  ... on PullRequest {
                    id
                    number
                    title
                    repository {
                      nameWithOwner
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const data = await this.executeGraphQL<{
      node: {
        items: {
          nodes: GraphQLProjectItem[]
        }
      }
    }>(query, { projectId: projectNodeId }, installationId)

    return data.node.items.nodes
  }

  /**
   * Fetch project fields from GitHub GraphQL
   */
  private async fetchProjectFields(
    projectNodeId: string,
    installationId: number
  ): Promise<GraphQLProjectField[]> {
    const query = `
      query GetProjectFields($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `

    const data = await this.executeGraphQL<{
      node: {
        fields: {
          nodes: GraphQLProjectField[]
        }
      }
    }>(query, { projectId: projectNodeId }, installationId)

    return data.node.fields.nodes
  }

  /**
   * Notify a repo's Durable Object of a change
   */
  private async notifyRepo(fullName: string, payload: any): Promise<void> {
    const doId = this.env.REPO.idFromName(fullName)
    const stub = this.env.REPO.get(doId)

    await stub.fetch('https://internal/milestones/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /**
   * Process item change and notify affected repos
   */
  private async processItemChange(payload: any, affectedRepos: string[]): Promise<void> {
    const now = new Date().toISOString()

    // Log the change
    this.sql.exec(`
      INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, 'item', payload.itemId, 'changed', JSON.stringify({ affectedRepos }), 'success', now)

    // Notify each affected repo
    for (const repo of affectedRepos) {
      try {
        await this.notifyRepo(repo, {
          source: 'github',
          type: 'project_item_changed',
          item: payload,
        })
      } catch (error) {
        // Log error but continue notifying other repos
        this.sql.exec(`
          INSERT INTO sync_log (entity_type, entity_id, action, details, status, error, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, 'repo_notification', repo, 'notify', JSON.stringify({ itemId: payload.itemId }), 'error', String(error), now)
      }
    }
  }

  /**
   * Process milestone change and propagate to linked repos
   */
  private async processMilestoneChange(payload: any, affectedRepos: string[]): Promise<void> {
    const now = new Date().toISOString()

    // Get the milestone mapping
    const mapping = this.sql.exec(
      'SELECT * FROM milestone_mappings WHERE title = ?',
      payload.title
    ).toArray()[0] as any

    if (!mapping) {
      throw new Error(`Milestone mapping not found: ${payload.title}`)
    }

    const repoMilestones = JSON.parse(mapping.repo_milestones) as Array<{
      fullName: string
      milestoneNumber: number
    }>

    // Notify each repo about the milestone change
    for (const repoMilestone of repoMilestones) {
      try {
        await this.notifyRepo(repoMilestone.fullName, {
          source: 'github',
          type: 'milestone_updated',
          milestone: {
            number: repoMilestone.milestoneNumber,
            title: payload.title,
            dueOn: payload.dueOn,
            state: payload.state,
          },
        })
      } catch (error) {
        this.sql.exec(`
          INSERT INTO sync_log (entity_type, entity_id, action, details, status, error, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, 'repo_notification', repoMilestone.fullName, 'notify_milestone', JSON.stringify({ title: payload.title }), 'error', String(error), now)
      }
    }

    // Log the propagation
    this.sql.exec(`
      INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, 'milestone', payload.title, 'propagated', JSON.stringify({ repoCount: repoMilestones.length }), 'success', now)
  }

  /**
   * Process field update
   */
  private async processFieldUpdate(payload: any): Promise<void> {
    const now = new Date().toISOString()

    // Update or insert field
    const existing = this.sql.exec(
      'SELECT * FROM project_fields WHERE github_field_id = ?',
      payload.fieldId
    ).toArray()[0]

    if (existing) {
      this.sql.exec(`
        UPDATE project_fields SET
          name = ?,
          data_type = ?,
          options = ?,
          updated_at = ?
        WHERE github_field_id = ?
      `,
        payload.name,
        payload.dataType,
        payload.options ? JSON.stringify(payload.options) : null,
        now,
        payload.fieldId
      )
    } else {
      this.sql.exec(`
        INSERT INTO project_fields (github_field_id, name, data_type, options, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        payload.fieldId,
        payload.name,
        payload.dataType,
        payload.options ? JSON.stringify(payload.options) : null,
        now,
        now
      )
    }
  }

  /**
   * Process newly linked repo
   */
  private async processRepoLinked(payload: any): Promise<void> {
    const now = new Date().toISOString()

    this.sql.exec(`
      INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, 'repo', payload.fullName, 'linked', JSON.stringify({ repoId: payload.repoId }), 'success', now)
  }

  private ensureInitialized() {
    if (this.initialized) return

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS project_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        github_node_id TEXT NOT NULL,
        number INTEGER,
        title TEXT,
        short_description TEXT,
        owner TEXT,
        public INTEGER,
        closed INTEGER,
        github_created_at TEXT,
        github_updated_at TEXT,
        last_sync_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

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
        github_content_id TEXT,
        content_type TEXT NOT NULL,
        content_id INTEGER,
        repo_full_name TEXT,
        title TEXT NOT NULL,
        status TEXT,
        priority TEXT,
        iteration TEXT,
        milestone_title TEXT,
        is_archived INTEGER DEFAULT 0,
        github_created_at TEXT,
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
    await this.initSyncActor()

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Project metadata endpoints
      if (path === '/project' && request.method === 'GET') {
        return this.getProject()
      }

      if (path === '/project/sync' && request.method === 'POST') {
        return this.syncProject(request)
      }

      // Repo management
      if (path === '/repos' && request.method === 'GET') {
        return this.listLinkedRepos()
      }

      if (path === '/repos' && request.method === 'POST') {
        return this.linkRepo(request)
      }

      // Item management
      if (path === '/items' && request.method === 'GET') {
        return this.listItems()
      }

      if (path === '/items/sync' && request.method === 'POST') {
        return this.syncItems(request)
      }

      // Field management
      if (path === '/fields' && request.method === 'GET') {
        return this.listFields()
      }

      if (path === '/fields/sync' && request.method === 'POST') {
        return this.syncFields(request)
      }

      // Milestone mappings
      if (path === '/milestones' && request.method === 'GET') {
        return this.listMilestoneMappings()
      }

      if (path === '/milestones/sync' && request.method === 'POST') {
        return this.syncMilestones(request)
      }

      // Full sync
      if (path === '/sync' && request.method === 'POST') {
        return this.triggerFullSync(request)
      }

      // Status
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

    // Queue repo_linked event
    await this.enqueueSyncEvent('repo_linked', {
      fullName: body.fullName,
      repoId: body.repoId,
    }, [body.fullName])

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
        nodeId: string
        id: number
        contentNodeId?: string
        contentType?: string
        creator?: string
        createdAt: string
        updatedAt: string
        archivedAt?: string
        isArchived?: boolean
      }
      fieldValues?: Record<string, any>
      changes?: any
    }

    const now = new Date().toISOString()
    const item = body.item

    // Check if item already exists
    const existing = this.sql.exec(
      'SELECT * FROM project_items WHERE github_item_id = ?',
      item.nodeId
    ).toArray()[0] as any

    if (body.action === 'deleted') {
      if (existing) {
        this.sql.exec('DELETE FROM project_items WHERE github_item_id = ?', item.nodeId)

        // Log the deletion
        this.sql.exec(`
          INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, 'item', item.nodeId, body.action, JSON.stringify({ id: item.id }), 'success', now)

        return Response.json({ action: 'deleted', itemId: item.nodeId })
      }
      return Response.json({ action: 'ignored', reason: 'item not found' })
    }

    // Extract field values for status, priority, iteration, milestone
    let status = existing?.status || null
    let priority = existing?.priority || null
    let iteration = existing?.iteration || null
    let milestoneTitle = existing?.milestone_title || null

    if (body.fieldValues) {
      if (body.fieldValues.Status) {
        status = body.fieldValues.Status.to || body.fieldValues.Status
      }
      if (body.fieldValues.Priority) {
        priority = body.fieldValues.Priority.to || body.fieldValues.Priority
      }
      if (body.fieldValues.Iteration) {
        iteration = body.fieldValues.Iteration.to || body.fieldValues.Iteration
      }
      if (body.fieldValues.Milestone) {
        milestoneTitle = body.fieldValues.Milestone.to || body.fieldValues.Milestone
      }
    }

    if (existing) {
      // Update existing item
      this.sql.exec(`
        UPDATE project_items SET
          content_type = ?,
          github_content_id = ?,
          status = ?,
          priority = ?,
          iteration = ?,
          milestone_title = ?,
          is_archived = ?,
          github_updated_at = ?,
          last_sync_at = ?,
          updated_at = ?
        WHERE github_item_id = ?
      `,
        item.contentType || existing.content_type,
        item.contentNodeId || existing.github_content_id,
        status,
        priority,
        iteration,
        milestoneTitle,
        item.isArchived ? 1 : 0,
        item.updatedAt,
        now,
        now,
        item.nodeId
      )

      // Log the update
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'item', item.nodeId, 'updated', JSON.stringify({
        action: body.action,
        fieldChanges: body.fieldValues
      }), 'success', now)

      return Response.json({ action: 'updated', itemId: item.nodeId })
    } else {
      // Create new item
      this.sql.exec(`
        INSERT INTO project_items (
          github_item_id, github_content_id, content_type, content_id, title,
          status, priority, iteration, milestone_title, is_archived,
          github_created_at, github_updated_at, last_sync_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        item.nodeId,
        item.contentNodeId || null,
        item.contentType || 'unknown',
        item.id,
        `Item ${item.id}`, // Title will be enriched later via GraphQL
        status,
        priority,
        iteration,
        milestoneTitle,
        item.isArchived ? 1 : 0,
        item.createdAt,
        item.updatedAt,
        now,
        now,
        now
      )

      // Log the creation
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'item', item.nodeId, 'created', JSON.stringify({
        action: body.action,
        contentType: item.contentType,
        fieldValues: body.fieldValues
      }), 'success', now)

      return Response.json({ action: 'created', itemId: item.nodeId })
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
      state?: string
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
    const affectedRepos = body.repoMilestones?.map(rm => rm.fullName) || []

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

      // Queue milestone_changed event to propagate to repos
      await this.enqueueSyncEvent('milestone_changed', {
        title: body.title,
        dueOn: body.dueOn,
        state: body.state || 'open',
      }, affectedRepos)

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

      // Queue milestone_changed event to propagate to repos
      await this.enqueueSyncEvent('milestone_changed', {
        title: body.title,
        dueOn: body.dueOn,
        state: body.state || 'open',
      }, affectedRepos)

      return Response.json({ action: 'created', title: body.title })
    }
  }

  private getStatus(): Response {
    const projectMeta = this.sql.exec('SELECT * FROM project_metadata WHERE id = 1').toArray()[0] as any
    const repoCount = this.sql.exec('SELECT COUNT(*) as count FROM linked_repos').toArray()[0] as { count: number }
    const itemCount = this.sql.exec('SELECT COUNT(*) as count FROM project_items').toArray()[0] as { count: number }
    const fieldCount = this.sql.exec('SELECT COUNT(*) as count FROM project_fields').toArray()[0] as { count: number }
    const milestoneCount = this.sql.exec('SELECT COUNT(*) as count FROM milestone_mappings').toArray()[0] as { count: number }

    // Get sync state machine status
    const state = this.syncActor?.getSnapshot()
    const syncStatus = state ? {
      state: state.value,
      pendingEvents: state.context.pendingEvents.length,
      currentEvent: state.context.currentEvent,
      lastSyncAt: state.context.lastSyncAt,
      errorCount: state.context.errorCount,
      lastError: state.context.lastError,
      projectNodeId: state.context.projectNodeId,
    } : null

    return Response.json({
      project: projectMeta || null,
      linkedRepos: repoCount.count,
      items: itemCount.count,
      fields: fieldCount.count,
      milestoneMappings: milestoneCount.count,
      syncStatus,
    })
  }

  private getProject(): Response {
    const projectMeta = this.sql.exec('SELECT * FROM project_metadata WHERE id = 1').toArray()[0] as any
    if (!projectMeta) {
      return new Response('Not Found', { status: 404 })
    }
    return Response.json(projectMeta)
  }

  private async syncProject(request: Request): Promise<Response> {
    const body = await request.json() as {
      action: string
      project: {
        nodeId: string
        number: number
        title: string
        shortDescription?: string
        owner: string
        public?: boolean
        closed?: boolean
        createdAt: string
        updatedAt: string
      }
    }

    const now = new Date().toISOString()
    const project = body.project

    // Check if project metadata exists
    const existing = this.sql.exec('SELECT * FROM project_metadata WHERE id = 1').toArray()[0] as any

    if (body.action === 'deleted') {
      if (existing) {
        this.sql.exec('DELETE FROM project_metadata WHERE id = 1')

        // Log the deletion
        this.sql.exec(`
          INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, 'project', project.nodeId, body.action, null, 'success', now)

        return Response.json({ action: 'deleted' })
      }
      return Response.json({ action: 'ignored', reason: 'project not found' })
    }

    if (existing) {
      // Update existing project metadata
      this.sql.exec(`
        UPDATE project_metadata SET
          number = ?,
          title = ?,
          short_description = ?,
          owner = ?,
          public = ?,
          closed = ?,
          github_updated_at = ?,
          last_sync_at = ?,
          updated_at = ?
        WHERE id = 1
      `,
        project.number,
        project.title,
        project.shortDescription || null,
        project.owner,
        project.public ? 1 : 0,
        project.closed ? 1 : 0,
        project.updatedAt,
        now,
        now
      )

      // Log the update
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'project', project.nodeId, 'updated', JSON.stringify({ action: body.action }), 'success', now)

      return Response.json({ action: 'updated' })
    } else {
      // Create new project metadata
      this.sql.exec(`
        INSERT INTO project_metadata (
          id, github_node_id, number, title, short_description, owner,
          public, closed, github_created_at, github_updated_at,
          last_sync_at, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        project.nodeId,
        project.number,
        project.title,
        project.shortDescription || null,
        project.owner,
        project.public ? 1 : 0,
        project.closed ? 1 : 0,
        project.createdAt,
        project.updatedAt,
        now,
        now,
        now
      )

      // Log the creation
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'project', project.nodeId, 'created', JSON.stringify({ action: body.action }), 'success', now)

      return Response.json({ action: 'created' })
    }
  }

  private listFields(): Response {
    const fields = this.sql.exec('SELECT * FROM project_fields').toArray()
    return Response.json(fields)
  }

  private async syncFields(request: Request): Promise<Response> {
    const body = await request.json() as {
      fields: Array<{
        githubFieldId: string
        name: string
        dataType: string
        options?: Array<{ id: string; name: string }>
      }>
    }

    const now = new Date().toISOString()
    const results: Array<{ action: string; fieldId: string }> = []

    for (const field of body.fields) {
      const existing = this.sql.exec(
        'SELECT * FROM project_fields WHERE github_field_id = ?',
        field.githubFieldId
      ).toArray()[0] as any

      const optionsJson = field.options ? JSON.stringify(field.options) : null

      if (existing) {
        // Update existing field
        this.sql.exec(`
          UPDATE project_fields SET
            name = ?,
            data_type = ?,
            options = ?,
            updated_at = ?
          WHERE github_field_id = ?
        `,
          field.name,
          field.dataType,
          optionsJson,
          now,
          field.githubFieldId
        )

        results.push({ action: 'updated', fieldId: field.githubFieldId })
      } else {
        // Create new field
        this.sql.exec(`
          INSERT INTO project_fields (github_field_id, name, data_type, options, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          field.githubFieldId,
          field.name,
          field.dataType,
          optionsJson,
          now,
          now
        )

        results.push({ action: 'created', fieldId: field.githubFieldId })
      }
    }

    // Log the sync
    this.sql.exec(`
      INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, 'fields', 'bulk', 'sync', JSON.stringify({ count: results.length }), 'success', now)

    return Response.json({ synced: results })
  }

  private async triggerFullSync(request: Request): Promise<Response> {
    const body = await request.json() as {
      projectNodeId: string
      installationId: number
    }

    const now = new Date().toISOString()

    try {
      // Set the project node ID in the state machine
      if (this.syncActor) {
        this.syncActor.send({ type: 'SET_PROJECT_ID', projectId: body.projectNodeId })
      }

      // Fetch fields first
      const fields = await this.fetchProjectFields(body.projectNodeId, body.installationId)

      // Sync fields to database
      for (const field of fields) {
        const existing = this.sql.exec(
          'SELECT * FROM project_fields WHERE github_field_id = ?',
          field.id
        ).toArray()[0]

        const optionsJson = field.options ? JSON.stringify(field.options) : null

        if (existing) {
          this.sql.exec(`
            UPDATE project_fields SET
              name = ?,
              data_type = ?,
              options = ?,
              updated_at = ?
            WHERE github_field_id = ?
          `,
            field.name,
            field.dataType,
            optionsJson,
            now,
            field.id
          )
        } else {
          this.sql.exec(`
            INSERT INTO project_fields (github_field_id, name, data_type, options, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
            field.id,
            field.name,
            field.dataType,
            optionsJson,
            now,
            now
          )
        }
      }

      // Fetch project items with full details
      const items = await this.fetchProjectItems(body.projectNodeId, body.installationId)

      // Sync items to database
      for (const item of items) {
        const existing = this.sql.exec(
          'SELECT * FROM project_items WHERE github_item_id = ?',
          item.id
        ).toArray()[0]

        // Extract field values
        const fieldValues: Record<string, any> = {}
        for (const fv of item.fieldValues.nodes) {
          const fieldName = fv.field.name
          if (fv.name) fieldValues[fieldName] = fv.name
          if (fv.text) fieldValues[fieldName] = fv.text
          if (fv.date) fieldValues[fieldName] = fv.date
          if (fv.number !== undefined) fieldValues[fieldName] = fv.number
        }

        const repoFullName = item.content.repository?.nameWithOwner || null
        const title = item.content.title || `Item ${item.id}`

        if (existing) {
          this.sql.exec(`
            UPDATE project_items SET
              github_content_id = ?,
              repo_full_name = ?,
              title = ?,
              status = ?,
              priority = ?,
              iteration = ?,
              milestone_title = ?,
              github_updated_at = ?,
              last_sync_at = ?,
              updated_at = ?
            WHERE github_item_id = ?
          `,
            item.content.id,
            repoFullName,
            title,
            fieldValues.Status || null,
            fieldValues.Priority || null,
            fieldValues.Iteration || null,
            fieldValues.Milestone || null,
            now,
            now,
            now,
            item.id
          )
        } else {
          this.sql.exec(`
            INSERT INTO project_items (
              github_item_id, github_content_id, content_type, content_id, repo_full_name,
              title, status, priority, iteration, milestone_title, is_archived,
              github_created_at, github_updated_at, last_sync_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            item.id,
            item.content.id,
            'Issue',
            item.content.number || 0,
            repoFullName,
            title,
            fieldValues.Status || null,
            fieldValues.Priority || null,
            fieldValues.Iteration || null,
            fieldValues.Milestone || null,
            0,
            now,
            now,
            now,
            now,
            now
          )
        }
      }

      // Log the sync
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, 'project', body.projectNodeId, 'full_sync', JSON.stringify({
        fields: fields.length,
        items: items.length,
      }), 'success', now)

      return Response.json({
        status: 'complete',
        synced: {
          fields: fields.length,
          items: items.length,
        },
      })
    } catch (error) {
      // Log the error
      this.sql.exec(`
        INSERT INTO sync_log (entity_type, entity_id, action, details, status, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, 'project', body.projectNodeId, 'full_sync', null, 'error', String(error), now)

      throw error
    }
  }
}
