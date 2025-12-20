/**
 * Repo Durable Object
 *
 * Source of truth for issue sync between GitHub Issues and beads.
 * Schema matches beads exactly for seamless JSONL import/export.
 */

import { DurableObject } from 'cloudflare:workers'
import { SignJWT, importPKCS8 } from 'jose'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
}

// =============================================================================
// Types matching beads schema
// =============================================================================

export interface Issue {
  id: string
  title: string
  description: string
  design: string
  acceptance_criteria: string
  notes: string
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  priority: number
  issue_type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  assignee: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  close_reason: string
  external_ref: string | null
  // Sync metadata (extensions to beads schema)
  github_number: number | null
  github_id: number | null
  last_sync_at: string | null
}

export interface Dependency {
  issue_id: string
  depends_on_id: string
  type: 'blocks' | 'related' | 'parent-child' | 'discovered-from'
  created_at: string
  created_by: string
}

export interface Label {
  issue_id: string
  label: string
}

export interface Comment {
  id: number
  issue_id: string
  author: string
  text: string
  created_at: string
}

// Beads JSONL format (what we parse from .beads/issues.jsonl)
interface BeadsIssue {
  id: string
  title: string
  description?: string
  design?: string
  acceptance_criteria?: string
  notes?: string
  status: string
  priority?: number
  issue_type?: string
  assignee?: string
  created_at: string
  updated_at: string
  closed_at?: string
  close_reason?: string
  external_ref?: string
  labels?: string[]
  dependencies?: Array<{
    issue_id: string
    depends_on_id: string
    type: string
    created_at: string
    created_by: string
  }>
}

// =============================================================================
// RepoDO Class
// =============================================================================

export class RepoDO extends DurableObject {
  private sql: SqlStorage
  private initialized = false
  private repoFullName: string | null = null
  private installationId: number | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
  }

  // ===========================================================================
  // Schema initialization (matches beads)
  // ===========================================================================

  private ensureInitialized() {
    if (this.initialized) return

    this.sql.exec(`
      -- Issues table (matches beads schema)
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        design TEXT NOT NULL DEFAULT '',
        acceptance_criteria TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        priority INTEGER NOT NULL DEFAULT 2 CHECK(priority >= 0 AND priority <= 4),
        issue_type TEXT NOT NULL DEFAULT 'task',
        assignee TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT,
        close_reason TEXT DEFAULT '',
        external_ref TEXT,
        -- Sync metadata (extensions)
        github_number INTEGER,
        github_id INTEGER UNIQUE,
        last_sync_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
      CREATE INDEX IF NOT EXISTS idx_issues_github_number ON issues(github_number);

      -- Dependencies table (matches beads schema)
      CREATE TABLE IF NOT EXISTS dependencies (
        issue_id TEXT NOT NULL,
        depends_on_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'blocks',
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        PRIMARY KEY (issue_id, depends_on_id),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on_id) REFERENCES issues(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_deps_issue ON dependencies(issue_id);
      CREATE INDEX IF NOT EXISTS idx_deps_depends_on ON dependencies(depends_on_id);

      -- Labels table (matches beads schema)
      CREATE TABLE IF NOT EXISTS labels (
        issue_id TEXT NOT NULL,
        label TEXT NOT NULL,
        PRIMARY KEY (issue_id, label),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_labels_label ON labels(label);

      -- Comments table (matches beads schema)
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id TEXT NOT NULL,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);

      -- Sync log for debugging
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
    `)

    this.initialized = true
  }

  // ===========================================================================
  // Repo context management
  // ===========================================================================

  private async initRepoContext(): Promise<void> {
    if (this.repoFullName && this.installationId) return

    const stored = await this.ctx.storage.get<{
      repoFullName: string
      installationId: number
    }>('repoContext')

    if (stored) {
      this.repoFullName = stored.repoFullName
      this.installationId = stored.installationId
    }
  }

  private async setRepoContext(repoFullName: string, installationId: number): Promise<void> {
    this.repoFullName = repoFullName
    this.installationId = installationId
    await this.ctx.storage.put('repoContext', { repoFullName, installationId })
  }

  // ===========================================================================
  // GitHub API helpers
  // ===========================================================================

  private async generateGitHubAppJWT(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const privateKeyPEM = (this.env as Env).GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n')
    const key = await importPKCS8(privateKeyPEM, 'RS256')

    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setIssuer((this.env as Env).GITHUB_APP_ID)
      .sign(key)
  }

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

    const data = (await response.json()) as { token: string }
    return data.token
  }

  private async fetchGitHubFile(path: string, ref?: string): Promise<string> {
    await this.initRepoContext()
    if (!this.repoFullName || !this.installationId) {
      throw new Error('Repo context not initialized')
    }

    const token = await this.getInstallationToken(this.installationId)
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

    const data = (await response.json()) as { content: string; encoding: string; sha: string }
    if (data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''))
    }
    return data.content
  }

  private async commitFile(path: string, content: string, message: string): Promise<void> {
    await this.initRepoContext()
    if (!this.repoFullName || !this.installationId) {
      throw new Error('Repo context not initialized')
    }

    const token = await this.getInstallationToken(this.installationId)
    const url = `https://api.github.com/repos/${this.repoFullName}/contents/${path}`

    // Get current file SHA if it exists
    let sha: string | undefined
    try {
      const getResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (getResponse.ok) {
        const data = (await getResponse.json()) as { sha: string }
        sha = data.sha
      }
    } catch {
      // File doesn't exist, that's fine
    }

    // Commit the file
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message,
        content: btoa(content),
        sha,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to commit file ${path}: ${response.status} ${error}`)
    }
  }

  // ===========================================================================
  // Issue CRUD operations
  // ===========================================================================

  private upsertIssue(issue: BeadsIssue): void {
    const now = new Date().toISOString()

    // Check if issue exists
    const existing = this.sql
      .exec('SELECT id FROM issues WHERE id = ?', issue.id)
      .toArray()

    if (existing.length > 0) {
      // Update
      this.sql.exec(
        `UPDATE issues SET
          title = ?,
          description = ?,
          design = ?,
          acceptance_criteria = ?,
          notes = ?,
          status = ?,
          priority = ?,
          issue_type = ?,
          assignee = ?,
          updated_at = ?,
          closed_at = ?,
          close_reason = ?,
          external_ref = ?,
          last_sync_at = ?
        WHERE id = ?`,
        issue.title,
        issue.description || '',
        issue.design || '',
        issue.acceptance_criteria || '',
        issue.notes || '',
        issue.status,
        issue.priority ?? 2,
        issue.issue_type || 'task',
        issue.assignee || null,
        issue.updated_at,
        issue.closed_at || null,
        issue.close_reason || '',
        issue.external_ref || null,
        now,
        issue.id
      )
    } else {
      // Insert
      this.sql.exec(
        `INSERT INTO issues (
          id, title, description, design, acceptance_criteria, notes,
          status, priority, issue_type, assignee,
          created_at, updated_at, closed_at, close_reason, external_ref,
          last_sync_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        issue.id,
        issue.title,
        issue.description || '',
        issue.design || '',
        issue.acceptance_criteria || '',
        issue.notes || '',
        issue.status,
        issue.priority ?? 2,
        issue.issue_type || 'task',
        issue.assignee || null,
        issue.created_at,
        issue.updated_at,
        issue.closed_at || null,
        issue.close_reason || '',
        issue.external_ref || null,
        now
      )
    }

    // Sync labels
    this.sql.exec('DELETE FROM labels WHERE issue_id = ?', issue.id)
    for (const label of issue.labels || []) {
      this.sql.exec(
        'INSERT INTO labels (issue_id, label) VALUES (?, ?)',
        issue.id,
        label
      )
    }

    // Sync dependencies
    this.sql.exec('DELETE FROM dependencies WHERE issue_id = ?', issue.id)
    for (const dep of issue.dependencies || []) {
      this.sql.exec(
        `INSERT INTO dependencies (issue_id, depends_on_id, type, created_at, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        dep.issue_id,
        dep.depends_on_id,
        dep.type,
        dep.created_at,
        dep.created_by
      )
    }
  }

  private getIssue(id: string): Issue | null {
    const rows = this.sql.exec('SELECT * FROM issues WHERE id = ?', id).toArray()
    return (rows[0] as Issue) || null
  }

  private getIssueByGitHubNumber(number: number): Issue | null {
    const rows = this.sql
      .exec('SELECT * FROM issues WHERE github_number = ?', number)
      .toArray()
    return (rows[0] as Issue) || null
  }

  // ===========================================================================
  // Sync: beads JSONL → DO
  // ===========================================================================

  async importFromJsonl(jsonl: string): Promise<{ created: number; updated: number }> {
    const lines = jsonl.trim().split('\n').filter((line) => line.trim())
    const issues: BeadsIssue[] = lines.map((line) => JSON.parse(line))

    let created = 0
    let updated = 0

    // Get current issue IDs to track deletions
    const currentIds = new Set(
      this.sql
        .exec('SELECT id FROM issues')
        .toArray()
        .map((row: any) => row.id as string)
    )

    for (const issue of issues) {
      const existing = this.getIssue(issue.id)
      this.upsertIssue(issue)
      if (existing) {
        updated++
      } else {
        created++
      }
      currentIds.delete(issue.id)
    }

    // Delete issues that are no longer in JSONL
    for (const id of currentIds) {
      this.sql.exec('DELETE FROM issues WHERE id = ?', id)
    }

    this.logSync('beads', 'import', { created, updated, deleted: currentIds.size })

    return { created, updated }
  }

  // ===========================================================================
  // Sync: DO → beads JSONL
  // ===========================================================================

  exportToJsonl(): string {
    const issues = this.sql.exec('SELECT * FROM issues ORDER BY id').toArray() as Issue[]
    const deps = this.sql.exec('SELECT * FROM dependencies').toArray() as Dependency[]
    const labels = this.sql.exec('SELECT * FROM labels').toArray() as Label[]

    const lines: string[] = []

    for (const issue of issues) {
      const issueLabels = labels
        .filter((l) => l.issue_id === issue.id)
        .map((l) => l.label)
      const issueDeps = deps.filter((d) => d.issue_id === issue.id)

      const beadsIssue: BeadsIssue = {
        id: issue.id,
        title: issue.title,
        description: issue.description || undefined,
        design: issue.design || undefined,
        acceptance_criteria: issue.acceptance_criteria || undefined,
        notes: issue.notes || undefined,
        status: issue.status,
        priority: issue.priority,
        issue_type: issue.issue_type,
        assignee: issue.assignee || undefined,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at || undefined,
        close_reason: issue.close_reason || undefined,
        external_ref: issue.external_ref || undefined,
        labels: issueLabels.length > 0 ? issueLabels : undefined,
        dependencies: issueDeps.length > 0 ? issueDeps : undefined,
      }

      // Remove undefined fields for cleaner output
      const cleaned = JSON.parse(JSON.stringify(beadsIssue))
      lines.push(JSON.stringify(cleaned))
    }

    return lines.join('\n')
  }

  async commitBeadsJsonl(): Promise<void> {
    const jsonl = this.exportToJsonl()
    await this.commitFile(
      '.beads/issues.jsonl',
      jsonl,
      'sync: update issues.jsonl from RepoDO'
    )
    this.logSync('beads', 'export', { issueCount: jsonl.split('\n').length })
  }

  // ===========================================================================
  // Sync: GitHub Issue → DO
  // ===========================================================================

  async onGitHubIssue(payload: {
    action: string
    issue: {
      id: number
      number: number
      title: string
      body: string | null
      state: 'open' | 'closed'
      labels: Array<{ name: string }>
      assignee: { login: string } | null
      created_at: string
      updated_at: string
      closed_at: string | null
    }
  }): Promise<void> {
    const { action, issue: ghIssue } = payload
    const now = new Date().toISOString()

    // Find existing issue by GitHub number
    let existing = this.getIssueByGitHubNumber(ghIssue.number)

    // Generate beads-style ID if new
    const id = existing?.id || `gh-${ghIssue.number}`

    const issue: BeadsIssue = {
      id,
      title: ghIssue.title,
      description: ghIssue.body || '',
      status: ghIssue.state === 'closed' ? 'closed' : 'open',
      priority: 2, // Default priority
      issue_type: 'task', // Default type
      assignee: ghIssue.assignee?.login,
      created_at: ghIssue.created_at,
      updated_at: ghIssue.updated_at,
      closed_at: ghIssue.closed_at || undefined,
      labels: ghIssue.labels.map((l) => l.name),
    }

    this.upsertIssue(issue)

    // Store GitHub metadata
    this.sql.exec(
      'UPDATE issues SET github_number = ?, github_id = ?, last_sync_at = ? WHERE id = ?',
      ghIssue.number,
      ghIssue.id,
      now,
      id
    )

    this.logSync('github', action, { issueId: id, githubNumber: ghIssue.number })

    // Commit back to beads
    await this.commitBeadsJsonl()
  }

  // ===========================================================================
  // Sync: DO → GitHub Issue
  // ===========================================================================

  async createGitHubIssue(issueId: string): Promise<number> {
    await this.initRepoContext()
    if (!this.repoFullName || !this.installationId) {
      throw new Error('Repo context not initialized')
    }

    const issue = this.getIssue(issueId)
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`)
    }

    const token = await this.getInstallationToken(this.installationId)

    const labels = this.sql
      .exec('SELECT label FROM labels WHERE issue_id = ?', issueId)
      .toArray()
      .map((row: any) => row.label as string)

    const response = await fetch(
      `https://api.github.com/repos/${this.repoFullName}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title: issue.title,
          body: issue.description || '',
          labels,
          assignees: issue.assignee ? [issue.assignee] : [],
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create GitHub issue: ${response.status} ${error}`)
    }

    const ghIssue = (await response.json()) as { id: number; number: number }

    // Update local issue with GitHub metadata
    this.sql.exec(
      'UPDATE issues SET github_number = ?, github_id = ?, last_sync_at = ? WHERE id = ?',
      ghIssue.number,
      ghIssue.id,
      new Date().toISOString(),
      issueId
    )

    this.logSync('github', 'create', { issueId, githubNumber: ghIssue.number })

    return ghIssue.number
  }

  async updateGitHubIssue(issueId: string): Promise<void> {
    await this.initRepoContext()
    if (!this.repoFullName || !this.installationId) {
      throw new Error('Repo context not initialized')
    }

    const issue = this.getIssue(issueId)
    if (!issue || !issue.github_number) {
      throw new Error(`Issue not found or no GitHub number: ${issueId}`)
    }

    const token = await this.getInstallationToken(this.installationId)

    const labels = this.sql
      .exec('SELECT label FROM labels WHERE issue_id = ?', issueId)
      .toArray()
      .map((row: any) => row.label as string)

    const response = await fetch(
      `https://api.github.com/repos/${this.repoFullName}/issues/${issue.github_number}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title: issue.title,
          body: issue.description || '',
          state: issue.status === 'closed' ? 'closed' : 'open',
          labels,
          assignees: issue.assignee ? [issue.assignee] : [],
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to update GitHub issue: ${response.status} ${error}`)
    }

    this.sql.exec(
      'UPDATE issues SET last_sync_at = ? WHERE id = ?',
      new Date().toISOString(),
      issueId
    )

    this.logSync('github', 'update', { issueId, githubNumber: issue.github_number })
  }

  // ===========================================================================
  // Sync: beads push webhook handler
  // ===========================================================================

  async onBeadsPush(payload: {
    commit: string
    files: string[]
    repoFullName: string
    installationId: number
  }): Promise<void> {
    const { commit, files, repoFullName, installationId } = payload

    // Set context if not already set
    await this.setRepoContext(repoFullName, installationId)

    // Only process if issues.jsonl changed
    if (!files.some((f) => f.includes('issues.jsonl'))) {
      return
    }

    // Fetch and import JSONL
    const jsonl = await this.fetchGitHubFile('.beads/issues.jsonl', commit)
    const result = await this.importFromJsonl(jsonl)

    console.log('[RepoDO] Imported beads JSONL', result)

    // Sync new issues to GitHub
    const issues = this.sql
      .exec('SELECT id, github_number FROM issues WHERE github_number IS NULL')
      .toArray() as Array<{ id: string; github_number: number | null }>

    for (const issue of issues) {
      try {
        await this.createGitHubIssue(issue.id)
      } catch (error) {
        console.error(`[RepoDO] Failed to create GitHub issue for ${issue.id}:`, error)
      }
    }
  }

  // ===========================================================================
  // Query endpoints for MCP tools
  // ===========================================================================

  listIssues(filters?: {
    status?: string
    priority?: number
    issue_type?: string
    assignee?: string
  }): Issue[] {
    let query = 'SELECT * FROM issues WHERE 1=1'
    const params: any[] = []

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.priority !== undefined) {
      query += ' AND priority = ?'
      params.push(filters.priority)
    }
    if (filters?.issue_type) {
      query += ' AND issue_type = ?'
      params.push(filters.issue_type)
    }
    if (filters?.assignee) {
      query += ' AND assignee = ?'
      params.push(filters.assignee)
    }

    query += ' ORDER BY priority ASC, updated_at DESC'

    return this.sql.exec(query, ...params).toArray() as Issue[]
  }

  listReady(): Issue[] {
    // Issues that are open and have no blocking dependencies
    return this.sql
      .exec(
        `SELECT i.* FROM issues i
         WHERE i.status = 'open'
         AND i.id NOT IN (
           SELECT d.issue_id FROM dependencies d
           JOIN issues blocker ON d.depends_on_id = blocker.id
           WHERE d.type = 'blocks' AND blocker.status != 'closed'
         )
         ORDER BY i.priority ASC, i.updated_at DESC`
      )
      .toArray() as Issue[]
  }

  listBlocked(): Array<Issue & { blockers: string[] }> {
    const blocked = this.sql
      .exec(
        `SELECT i.*, GROUP_CONCAT(d.depends_on_id) as blocker_ids
         FROM issues i
         JOIN dependencies d ON i.id = d.issue_id
         JOIN issues blocker ON d.depends_on_id = blocker.id
         WHERE d.type = 'blocks' AND blocker.status != 'closed'
         GROUP BY i.id`
      )
      .toArray() as Array<Issue & { blocker_ids: string }>

    return blocked.map((issue) => ({
      ...issue,
      blockers: issue.blocker_ids.split(','),
    }))
  }

  search(query: string): Issue[] {
    const pattern = `%${query}%`
    return this.sql
      .exec(
        `SELECT * FROM issues
         WHERE title LIKE ? OR description LIKE ?
         ORDER BY updated_at DESC
         LIMIT 50`,
        pattern,
        pattern
      )
      .toArray() as Issue[]
  }

  // ===========================================================================
  // Logging
  // ===========================================================================

  private logSync(source: string, action: string, details: any): void {
    this.sql.exec(
      'INSERT INTO sync_log (source, action, details, created_at) VALUES (?, ?, ?, ?)',
      source,
      action,
      JSON.stringify(details),
      new Date().toISOString()
    )
  }

  // ===========================================================================
  // HTTP API
  // ===========================================================================

  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized()

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Issue list
      if (path === '/issues' && request.method === 'GET') {
        const status = url.searchParams.get('status') || undefined
        const priority = url.searchParams.get('priority')
        const issueType = url.searchParams.get('type') || undefined
        const assignee = url.searchParams.get('assignee') || undefined

        const issues = this.listIssues({
          status,
          priority: priority ? parseInt(priority, 10) : undefined,
          issue_type: issueType,
          assignee,
        })
        return Response.json(issues)
      }

      // Ready issues
      if (path === '/issues/ready' && request.method === 'GET') {
        return Response.json(this.listReady())
      }

      // Blocked issues
      if (path === '/issues/blocked' && request.method === 'GET') {
        return Response.json(this.listBlocked())
      }

      // Search
      if (path === '/issues/search' && request.method === 'GET') {
        const q = url.searchParams.get('q') || ''
        return Response.json(this.search(q))
      }

      // Single issue
      if (path.startsWith('/issues/') && request.method === 'GET') {
        const id = path.slice('/issues/'.length)
        const issue = this.getIssue(id)
        if (!issue) {
          return new Response('Not Found', { status: 404 })
        }

        // Include labels and dependencies
        const labels = this.sql
          .exec('SELECT label FROM labels WHERE issue_id = ?', id)
          .toArray()
          .map((r: any) => r.label)
        const deps = this.sql
          .exec('SELECT * FROM dependencies WHERE issue_id = ?', id)
          .toArray()
        const dependents = this.sql
          .exec('SELECT * FROM dependencies WHERE depends_on_id = ?', id)
          .toArray()

        return Response.json({ ...issue, labels, dependencies: deps, dependents })
      }

      // GitHub webhook handler
      if (path === '/webhook/github' && request.method === 'POST') {
        const payload = await request.json()
        await this.onGitHubIssue(payload)
        return Response.json({ ok: true })
      }

      // Beads push webhook handler
      if (path === '/webhook/beads' && request.method === 'POST') {
        const payload = (await request.json()) as {
          commit: string
          files: string[]
          repoFullName: string
          installationId: number
        }
        await this.onBeadsPush(payload)
        return Response.json({ ok: true })
      }

      // Export JSONL
      if (path === '/export' && request.method === 'GET') {
        const jsonl = this.exportToJsonl()
        return new Response(jsonl, {
          headers: { 'Content-Type': 'application/x-ndjson' },
        })
      }

      // Import JSONL
      if (path === '/import' && request.method === 'POST') {
        const jsonl = await request.text()
        const result = await this.importFromJsonl(jsonl)
        return Response.json(result)
      }

      // Status
      if (path === '/status' && request.method === 'GET') {
        await this.initRepoContext()
        const issueCount = this.sql
          .exec('SELECT COUNT(*) as count FROM issues')
          .toArray()[0] as { count: number }
        const recentLogs = this.sql
          .exec('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 10')
          .toArray()

        return Response.json({
          repoFullName: this.repoFullName,
          installationId: this.installationId,
          issueCount: issueCount.count,
          recentSyncs: recentLogs,
        })
      }

      // Set context
      if (path === '/context' && request.method === 'POST') {
        const { repoFullName, installationId } = (await request.json()) as {
          repoFullName: string
          installationId: number
        }
        await this.setRepoContext(repoFullName, installationId)
        return Response.json({ ok: true })
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('[RepoDO] Error:', error)
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
