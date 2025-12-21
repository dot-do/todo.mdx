/**
 * Repo Durable Object
 *
 * Source of truth for issue sync between GitHub Issues and beads.
 * Schema matches beads exactly for seamless JSONL import/export.
 */

import { DurableObject } from 'cloudflare:workers'
import { SignJWT, importPKCS8 } from 'jose'

// Workflow types for triggering autonomous development
interface WorkflowNamespace {
  create<T = unknown>(options: { id: string; params: T }): Promise<WorkflowInstance<T>>
  get<T = unknown>(id: string): Promise<WorkflowInstance<T>>
}

interface WorkflowInstance<T = unknown> {
  id: string
  status: 'running' | 'complete' | 'failed' | 'paused'
}

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  // Workflow binding for auto-triggering development
  DEVELOP_WORKFLOW?: WorkflowNamespace
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
// Label Schema Helpers
// =============================================================================

// Priority labels: P0 (critical) to P4 (backlog)
const PRIORITY_LABELS = ['P0', 'P1', 'P2', 'P3', 'P4'] as const
// Status labels for in_progress and blocked (open/closed use GitHub state)
const STATUS_LABELS = ['in-progress', 'blocked'] as const
// Type labels
const TYPE_LABELS = ['bug', 'feature', 'task', 'epic', 'chore'] as const

function priorityToLabel(priority: number): string {
  return PRIORITY_LABELS[Math.min(Math.max(priority, 0), 4)]
}

function labelToPriority(labels: string[]): number {
  for (const label of labels) {
    const idx = PRIORITY_LABELS.indexOf(label as any)
    if (idx !== -1) return idx
  }
  return 2 // Default to P2
}

function statusToLabel(status: string): string | null {
  if (status === 'in_progress') return 'in-progress'
  if (status === 'blocked') return 'blocked'
  return null // open/closed use GitHub state, not labels
}

function labelToStatus(labels: string[], ghState: 'open' | 'closed'): string {
  if (ghState === 'closed') return 'closed'
  if (labels.includes('in-progress')) return 'in_progress'
  if (labels.includes('blocked')) return 'blocked'
  return 'open'
}

function typeToLabel(type: string): string | null {
  if (TYPE_LABELS.includes(type as any)) return type
  return null
}

function labelToType(labels: string[]): string {
  for (const label of labels) {
    if (TYPE_LABELS.includes(label as any)) return label
  }
  return 'task' // Default
}

/**
 * Convert PKCS#1 (RSA PRIVATE KEY) to PKCS#8 (PRIVATE KEY) format.
 * GitHub App keys are in PKCS#1 but jose's importPKCS8 requires PKCS#8.
 */
function convertPkcs1ToPkcs8(pkcs1Pem: string): string {
  // Check if already PKCS#8
  if (pkcs1Pem.includes('-----BEGIN PRIVATE KEY-----')) {
    return pkcs1Pem
  }

  // Remove PEM headers and decode
  const pkcs1Base64 = pkcs1Pem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/[\s\n\r]/g, '')

  const pkcs1Binary = Uint8Array.from(atob(pkcs1Base64), (c) => c.charCodeAt(0))

  // RSA AlgorithmIdentifier: SEQUENCE { OID 1.2.840.113549.1.1.1, NULL }
  const rsaAlgorithmId = new Uint8Array([
    0x30, 0x0d, // SEQUENCE (13 bytes)
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // OID rsaEncryption
    0x05, 0x00, // NULL
  ])

  // version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00])

  // Wrap PKCS#1 key in OCTET STRING
  const pkcs1Len = pkcs1Binary.length
  let octetStringHeader: Uint8Array
  if (pkcs1Len < 128) {
    octetStringHeader = new Uint8Array([0x04, pkcs1Len])
  } else if (pkcs1Len < 256) {
    octetStringHeader = new Uint8Array([0x04, 0x81, pkcs1Len])
  } else {
    octetStringHeader = new Uint8Array([0x04, 0x82, (pkcs1Len >> 8) & 0xff, pkcs1Len & 0xff])
  }

  // Build inner content: version + algorithmId + octetString(pkcs1Key)
  const innerLen = version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1Binary.length
  let sequenceHeader: Uint8Array
  if (innerLen < 128) {
    sequenceHeader = new Uint8Array([0x30, innerLen])
  } else if (innerLen < 256) {
    sequenceHeader = new Uint8Array([0x30, 0x81, innerLen])
  } else {
    sequenceHeader = new Uint8Array([0x30, 0x82, (innerLen >> 8) & 0xff, innerLen & 0xff])
  }

  // Combine all parts
  const pkcs8Binary = new Uint8Array(
    sequenceHeader.length + version.length + rsaAlgorithmId.length + octetStringHeader.length + pkcs1Binary.length
  )
  let offset = 0
  pkcs8Binary.set(sequenceHeader, offset)
  offset += sequenceHeader.length
  pkcs8Binary.set(version, offset)
  offset += version.length
  pkcs8Binary.set(rsaAlgorithmId, offset)
  offset += rsaAlgorithmId.length
  pkcs8Binary.set(octetStringHeader, offset)
  offset += octetStringHeader.length
  pkcs8Binary.set(pkcs1Binary, offset)

  // Encode as base64 with 64-char line breaks
  const base64 = btoa(String.fromCharCode(...pkcs8Binary))
  const lines = base64.match(/.{1,64}/g) || []

  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
}

/** Build the complete label array for GitHub from issue data */
function buildGitHubLabels(
  existingLabels: string[],
  priority: number,
  status: string,
  issueType: string
): string[] {
  // Start with user labels (filter out system labels)
  const userLabels = existingLabels.filter(
    (l) =>
      !PRIORITY_LABELS.includes(l as any) &&
      !STATUS_LABELS.includes(l as any) &&
      !TYPE_LABELS.includes(l as any)
  )

  // Add system labels
  const labels = [...userLabels, priorityToLabel(priority)]

  const statusLabel = statusToLabel(status)
  if (statusLabel) labels.push(statusLabel)

  const typeLabel = typeToLabel(issueType)
  if (typeLabel) labels.push(typeLabel)

  return labels
}

// =============================================================================
// RepoDO Class
// =============================================================================

export class RepoDO extends DurableObject<Env> {
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
    let privateKeyPEM = (this.env as Env).GITHUB_PRIVATE_KEY

    // Handle different key formats:
    // 1. Base64 encoded PEM
    // 2. PEM with escaped newlines (\\n)
    // 3. Raw PEM
    if (!privateKeyPEM.includes('-----BEGIN')) {
      // Assume base64 encoded
      try {
        privateKeyPEM = atob(privateKeyPEM)
      } catch {
        // Not valid base64, try as-is
      }
    }
    // Convert escaped newlines to actual newlines
    privateKeyPEM = privateKeyPEM.replace(/\\n/g, '\n')

    // GitHub App keys are PKCS#1 (RSA PRIVATE KEY), but jose requires PKCS#8
    privateKeyPEM = convertPkcs1ToPkcs8(privateKeyPEM)

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
          'User-Agent': 'todo.mdx-worker',
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
        'User-Agent': 'todo.mdx-worker',
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

    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Get current file SHA (fresh on each attempt to handle 409 conflicts)
      let sha: string | undefined
      try {
        const getResponse = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'todo.mdx-worker',
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
          'User-Agent': 'todo.mdx-worker',
        },
        body: JSON.stringify({
          message,
          content: btoa(content),
          sha,
        }),
      })

      if (response.ok) {
        return // Success!
      }

      const errorText = await response.text()

      // 409 = SHA conflict, retry with fresh SHA
      if (response.status === 409 && attempt < maxRetries - 1) {
        console.log(`[RepoDO] Commit conflict (attempt ${attempt + 1}), retrying...`)
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt))) // Exponential backoff
        continue
      }

      lastError = new Error(`Failed to commit file ${path}: ${response.status} ${errorText}`)
    }

    throw lastError || new Error(`Failed to commit file ${path} after ${maxRetries} attempts`)
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

  async importFromJsonl(jsonl: string): Promise<{
    created: string[]
    updated: string[]
    deleted: Array<{ id: string; github_number: number | null }>
  }> {
    const lines = jsonl.trim().split('\n').filter((line) => line.trim())
    const issues: BeadsIssue[] = lines.map((line) => JSON.parse(line))

    const created: string[] = []
    const updated: string[] = []

    // Get current issues to track deletions (need github_number before deleting)
    // Also get last_sync_at to protect recently-synced issues from concurrent commit deletion
    const currentIssues = new Map(
      (
        this.sql
          .exec('SELECT id, github_number, last_sync_at FROM issues')
          .toArray() as Array<{ id: string; github_number: number | null; last_sync_at: string | null }>
      ).map((row) => [row.id, { github_number: row.github_number, last_sync_at: row.last_sync_at }])
    )

    for (const issue of issues) {
      const existing = this.getIssue(issue.id)
      this.upsertIssue(issue)
      if (existing) {
        updated.push(issue.id)
      } else {
        created.push(issue.id)
      }
      currentIssues.delete(issue.id)
    }

    // Track deleted issues with their github_numbers before removing them
    // Protect issues that were synced very recently (within 60s) to prevent
    // concurrent commit race conditions from deleting newly-created issues
    const deleted: Array<{ id: string; github_number: number | null }> = []
    const PROTECTION_WINDOW_MS = 60_000 // 60 seconds
    const now = Date.now()

    for (const [id, data] of currentIssues) {
      // Skip deleting issues that were synced very recently
      if (data.last_sync_at) {
        const syncTime = new Date(data.last_sync_at).getTime()
        if (now - syncTime < PROTECTION_WINDOW_MS) {
          console.log(`[RepoDO] Protecting recently-synced issue from deletion: ${id} (synced ${now - syncTime}ms ago)`)
          continue
        }
      }
      deleted.push({ id, github_number: data.github_number })
      this.sql.exec('DELETE FROM issues WHERE id = ?', id)
    }

    this.logSync('beads', 'import', {
      created: created.length,
      updated: updated.length,
      deleted: deleted.length,
    })

    return { created, updated, deleted }
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

    // Race condition fix: If not found by github_number, also search by title.
    // This handles the case where createGitHubIssue was just called but the
    // github_number hasn't been set yet (the webhook arrives before SQL update).
    if (!existing) {
      const byTitle = this.sql
        .exec('SELECT * FROM issues WHERE title = ? AND github_number IS NULL LIMIT 1', ghIssue.title)
        .toArray() as Issue[]
      if (byTitle.length > 0) {
        existing = byTitle[0]
        console.log(`[RepoDO] Found issue by title match (race condition): ${existing.id}`)
      }
    }

    // Generate beads-style ID if new
    const id = existing?.id || `gh-${ghIssue.number}`

    // Extract labels
    const labelNames = ghIssue.labels.map((l) => l.name)

    // Parse priority, status, and type from GitHub labels
    const priority = labelToPriority(labelNames)
    const status = labelToStatus(labelNames, ghIssue.state)
    const issueType = labelToType(labelNames)

    // Filter out system labels (P0-P4, in-progress, blocked, type labels) for storage
    const userLabels = labelNames.filter(
      (l) =>
        !PRIORITY_LABELS.includes(l as any) &&
        !STATUS_LABELS.includes(l as any) &&
        !TYPE_LABELS.includes(l as any)
    )

    const issue: BeadsIssue = {
      id,
      title: ghIssue.title,
      description: ghIssue.body || '',
      status,
      priority,
      issue_type: issueType,
      assignee: ghIssue.assignee?.login,
      created_at: ghIssue.created_at,
      updated_at: ghIssue.updated_at,
      closed_at: ghIssue.closed_at || undefined,
      labels: userLabels.length > 0 ? userLabels : undefined,
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

    // Commit back to repo so GitHub issues appear in beads
    // Uses retry logic to handle 409 SHA conflicts
    try {
      await this.commitBeadsJsonl()
    } catch (error) {
      // Log but don't fail - the DO has the data, local sync will catch up
      console.error('[RepoDO] Failed to commit back to repo:', error)
    }
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

    // Get user labels from DB
    const userLabels = this.sql
      .exec('SELECT label FROM labels WHERE issue_id = ?', issueId)
      .toArray()
      .map((row: any) => row.label as string)

    // Build complete label set including priority, status, and type
    const labels = buildGitHubLabels(
      userLabels,
      issue.priority,
      issue.status,
      issue.issue_type
    )

    const response = await fetch(
      `https://api.github.com/repos/${this.repoFullName}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'todo.mdx-worker',
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

    // Get user labels from DB
    const userLabels = this.sql
      .exec('SELECT label FROM labels WHERE issue_id = ?', issueId)
      .toArray()
      .map((row: any) => row.label as string)

    // Build complete label set including priority, status, and type
    const labels = buildGitHubLabels(
      userLabels,
      issue.priority,
      issue.status,
      issue.issue_type
    )

    const response = await fetch(
      `https://api.github.com/repos/${this.repoFullName}/issues/${issue.github_number}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'todo.mdx-worker',
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

    // Capture ready issues BEFORE import (to detect newly unblocked issues)
    const readyBefore = new Set(this.listReady().map((i) => i.id))

    // Fetch and import JSONL
    const jsonl = await this.fetchGitHubFile('.beads/issues.jsonl', commit)
    const result = await this.importFromJsonl(jsonl)

    console.log('[RepoDO] Imported beads JSONL', {
      created: result.created.length,
      updated: result.updated.length,
      deleted: result.deleted.length,
    })

    // 1. Create GitHub issues for new beads issues
    for (const issueId of result.created) {
      try {
        await this.createGitHubIssue(issueId)
      } catch (error) {
        console.error(`[RepoDO] Failed to create GitHub issue for ${issueId}:`, error)
      }
    }

    // 2. Update GitHub issues for modified beads issues
    // Skip issues that were recently synced from GitHub to prevent loops
    const now = Date.now()
    const SYNC_DEBOUNCE_MS = 30_000 // 30 seconds

    for (const issueId of result.updated) {
      const issue = this.getIssue(issueId)
      if (issue?.github_number) {
        // Skip if this issue was synced from GitHub very recently
        const lastSync = issue.last_sync_at ? new Date(issue.last_sync_at).getTime() : 0
        if (now - lastSync < SYNC_DEBOUNCE_MS) {
          console.log(`[RepoDO] Skipping GitHub update for ${issueId} (synced ${now - lastSync}ms ago)`)
          continue
        }

        try {
          await this.updateGitHubIssue(issueId)
        } catch (error) {
          console.error(`[RepoDO] Failed to update GitHub issue for ${issueId}:`, error)
        }
      }
    }

    // 3. Close GitHub issues for deleted beads issues
    for (const { id, github_number } of result.deleted) {
      if (github_number) {
        try {
          await this.closeGitHubIssue(github_number)
          console.log(`[RepoDO] Closed GitHub issue #${github_number} (was ${id})`)
        } catch (error) {
          console.error(`[RepoDO] Failed to close GitHub issue #${github_number}:`, error)
        }
      }
    }

    // 4. Auto-trigger DevelopWorkflow for newly ready issues
    // Issues that weren't ready before but are ready now (their blockers were closed)
    await this.triggerWorkflowsForReadyIssues(readyBefore, repoFullName, installationId)
  }

  /**
   * Trigger DevelopWorkflow for issues that just became ready (no blockers)
   */
  private async triggerWorkflowsForReadyIssues(
    readyBefore: Set<string>,
    repoFullName: string,
    installationId: number
  ): Promise<void> {
    if (!this.env.DEVELOP_WORKFLOW) {
      console.log('[RepoDO] DEVELOP_WORKFLOW not bound, skipping auto-trigger')
      return
    }

    const readyNow = this.listReady()
    const newlyReady = readyNow.filter((issue) => !readyBefore.has(issue.id))

    if (newlyReady.length === 0) {
      return
    }

    console.log(`[RepoDO] Found ${newlyReady.length} newly ready issues to trigger`)

    const [owner, name] = repoFullName.split('/')

    for (const issue of newlyReady) {
      const workflowId = `develop-${issue.id}`

      try {
        // Check if workflow already exists
        try {
          const existing = await this.env.DEVELOP_WORKFLOW.get(workflowId)
          if (existing.status === 'running' || existing.status === 'paused') {
            console.log(`[RepoDO] Workflow already active: ${workflowId}`)
            continue
          }
        } catch {
          // Workflow doesn't exist, continue to create
        }

        // Create new workflow instance
        const instance = await this.env.DEVELOP_WORKFLOW.create({
          id: workflowId,
          params: {
            repo: { owner, name },
            issue: {
              id: issue.id,
              title: issue.title,
              description: issue.description,
              status: issue.status,
              priority: issue.priority,
              issue_type: issue.issue_type,
            },
            installationId,
          },
        })

        console.log(`[RepoDO] Triggered DevelopWorkflow for ${issue.id}: ${instance.id}`)
      } catch (error) {
        console.error(`[RepoDO] Failed to trigger workflow for ${issue.id}:`, error)
      }
    }
  }

  /**
   * Close a GitHub issue by number (used when beads issue is deleted)
   */
  private async closeGitHubIssue(githubNumber: number): Promise<void> {
    await this.initRepoContext()
    if (!this.repoFullName || !this.installationId) {
      throw new Error('Repo context not initialized')
    }

    const token = await this.getInstallationToken(this.installationId)

    const response = await fetch(
      `https://api.github.com/repos/${this.repoFullName}/issues/${githubNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'todo.mdx-worker',
        },
        body: JSON.stringify({
          state: 'closed',
          state_reason: 'completed',
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to close GitHub issue: ${response.status} ${error}`)
    }

    this.logSync('github', 'close', { githubNumber })
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

      // Single issue GET
      if (path.startsWith('/issues/') && !path.includes('/close') && request.method === 'GET') {
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

      // Create issue
      if (path === '/issues' && request.method === 'POST') {
        const body = (await request.json()) as {
          title: string
          description?: string
          issue_type?: string
          priority?: number
          assignee?: string
          labels?: string[]
        }

        const id = `todo-${Math.random().toString(36).slice(2, 6)}`
        const now = new Date().toISOString()

        const issue: BeadsIssue = {
          id,
          title: body.title,
          description: body.description || '',
          status: 'open',
          priority: body.priority ?? 2,
          issue_type: body.issue_type || 'task',
          assignee: body.assignee,
          created_at: now,
          updated_at: now,
          labels: body.labels,
        }

        this.upsertIssue(issue)

        // Sync to GitHub if context is set
        if (this.repoFullName && this.installationId) {
          try {
            await this.createGitHubIssue(id)
          } catch (e) {
            console.error('[RepoDO] Failed to create GitHub issue:', e)
          }
        }

        return Response.json({ id, ...issue })
      }

      // Update issue
      if (path.startsWith('/issues/') && !path.includes('/close') && request.method === 'PATCH') {
        const id = path.slice('/issues/'.length)
        const existing = this.getIssue(id)
        if (!existing) {
          return new Response('Not Found', { status: 404 })
        }

        const body = (await request.json()) as {
          title?: string
          description?: string
          status?: string
          priority?: number
          assignee?: string
          labels?: string[]
        }

        const now = new Date().toISOString()

        // Update fields
        if (body.title !== undefined) {
          this.sql.exec('UPDATE issues SET title = ?, updated_at = ? WHERE id = ?', body.title, now, id)
        }
        if (body.description !== undefined) {
          this.sql.exec('UPDATE issues SET description = ?, updated_at = ? WHERE id = ?', body.description, now, id)
        }
        if (body.status !== undefined) {
          this.sql.exec('UPDATE issues SET status = ?, updated_at = ? WHERE id = ?', body.status, now, id)
        }
        if (body.priority !== undefined) {
          this.sql.exec('UPDATE issues SET priority = ?, updated_at = ? WHERE id = ?', body.priority, now, id)
        }
        if (body.assignee !== undefined) {
          this.sql.exec('UPDATE issues SET assignee = ?, updated_at = ? WHERE id = ?', body.assignee || null, now, id)
        }
        if (body.labels !== undefined) {
          this.sql.exec('DELETE FROM labels WHERE issue_id = ?', id)
          for (const label of body.labels) {
            this.sql.exec('INSERT INTO labels (issue_id, label) VALUES (?, ?)', id, label)
          }
        }

        // Sync to GitHub if connected
        const updated = this.getIssue(id)
        if (updated?.github_number && this.repoFullName && this.installationId) {
          try {
            await this.updateGitHubIssue(id)
          } catch (e) {
            console.error('[RepoDO] Failed to update GitHub issue:', e)
          }
        }

        return Response.json(updated)
      }

      // Close issue
      if (path.match(/^\/issues\/[^/]+\/close$/) && request.method === 'POST') {
        const id = path.slice('/issues/'.length, -'/close'.length)
        const existing = this.getIssue(id)
        if (!existing) {
          return new Response('Not Found', { status: 404 })
        }

        const body = (await request.json()) as { reason?: string }
        const now = new Date().toISOString()

        this.sql.exec(
          'UPDATE issues SET status = ?, closed_at = ?, close_reason = ?, updated_at = ? WHERE id = ?',
          'closed',
          now,
          body.reason || 'Completed',
          now,
          id
        )

        // Sync to GitHub if connected
        if (existing.github_number && this.repoFullName && this.installationId) {
          try {
            await this.updateGitHubIssue(id)
          } catch (e) {
            console.error('[RepoDO] Failed to close GitHub issue:', e)
          }
        }

        return Response.json({ ok: true, id })
      }

      // Add dependency
      if (path === '/dependencies' && request.method === 'POST') {
        const body = (await request.json()) as {
          issue_id: string
          depends_on_id: string
          type?: string
        }

        const now = new Date().toISOString()
        this.sql.exec(
          'INSERT OR REPLACE INTO dependencies (issue_id, depends_on_id, type, created_at, created_by) VALUES (?, ?, ?, ?, ?)',
          body.issue_id,
          body.depends_on_id,
          body.type || 'blocks',
          now,
          'mcp'
        )

        return Response.json({ ok: true })
      }

      // Remove dependency
      if (path === '/dependencies' && request.method === 'DELETE') {
        const body = (await request.json()) as {
          issue_id: string
          depends_on_id: string
        }

        this.sql.exec(
          'DELETE FROM dependencies WHERE issue_id = ? AND depends_on_id = ?',
          body.issue_id,
          body.depends_on_id
        )

        return Response.json({ ok: true })
      }

      // GitHub webhook handler
      if (path === '/webhook/github' && request.method === 'POST') {
        const payload = (await request.json()) as {
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
        }
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
