/**
 * GitHub App Entity Types for db.td
 *
 * These entities track the state of GitHub App installations, sync operations,
 * and mappings between beads issues and GitHub issues.
 *
 * Using db.td FlatEntity format with $type and $id fields.
 */

/**
 * GitHub Conventions Configuration
 * Per-repo override for label/status mappings
 */
export interface GitHubConventions {
  labelMapping?: Record<string, string>   // beads type -> GitHub label
  statusMapping?: Record<string, string>  // beads status -> GitHub state
}

/**
 * GitHub App Installation Entity
 * Tracks one GitHub App installation per repository
 */
export interface Installation {
  $type: 'Installation'
  $id: string
  githubInstallationId: number
  owner: string
  repo: string
  accessToken: string
  tokenExpiresAt: string  // ISO timestamp
  conventions?: GitHubConventions  // Per-repo config override
  createdAt: string
  updatedAt: string
}

/**
 * Sync State Entity
 * Tracks sync status and cursor position for bi-directional sync
 */
export interface SyncState {
  $type: 'SyncState'
  $id: string
  installationId: string  // Reference to Installation.$id
  lastSyncAt: string
  lastGitHubEventId?: string  // Webhook delivery ID cursor
  lastBeadsCommit?: string   // Git commit hash for beads changes
  syncStatus: 'idle' | 'syncing' | 'error'
  errorMessage?: string
  errorCount: number
}

/**
 * Issue Mapping Entity
 * Maps beads issue ID ↔ GitHub issue number
 */
export interface IssueMapping {
  $type: 'IssueMapping'
  $id: string
  installationId: string
  beadsId: string
  githubNumber: number
  githubUrl: string  // Full URL like "https://github.com/owner/repo/issues/123"
  lastSyncedAt: string
  beadsUpdatedAt: string
  githubUpdatedAt: string
}

/**
 * Generate a simple unique ID using timestamp + random string
 * This matches the pattern used in db.td for base62 IDs
 */
function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  // Prefix with timestamp for uniqueness and sortability
  const timestamp = Date.now().toString(36)
  return `${timestamp}${result}`
}

/**
 * Create a new Installation entity
 */
export function createInstallation(
  data: Omit<Installation, '$type' | '$id' | 'createdAt' | 'updatedAt'>
): Installation {
  const now = new Date().toISOString()
  return {
    $type: 'Installation',
    $id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Create a new SyncState entity
 */
export function createSyncState(installationId: string): SyncState {
  const now = new Date().toISOString()
  return {
    $type: 'SyncState',
    $id: generateId(),
    installationId,
    lastSyncAt: now,
    syncStatus: 'idle',
    errorCount: 0
  }
}

/**
 * Create a new IssueMapping entity
 */
export function createIssueMapping(
  data: Omit<IssueMapping, '$type' | '$id'>
): IssueMapping {
  return {
    $type: 'IssueMapping',
    $id: generateId(),
    ...data
  }
}
