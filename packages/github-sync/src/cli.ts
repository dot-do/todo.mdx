/**
 * GitHub CLI for beads integration
 *
 * Provides command implementations for connecting, syncing, and managing
 * GitHub integration with beads issue tracker.
 */

import type { GitHubClient } from './github-client'
import type { SyncOrchestrator, SyncResult, ConflictStrategy } from './sync-orchestrator'

export interface GithubCliOptions {
  // Config storage operations
  config: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
  }

  // GitHub client factory
  createClient(token: string): GitHubClient

  // Sync orchestrator factory
  createOrchestrator(options: any): SyncOrchestrator

  // Output functions
  log(message: string): void
  error(message: string): void

  // Browser open (for OAuth)
  openBrowser?(url: string): Promise<void>
}

export interface GithubCli {
  // Connect current repo to GitHub App
  connect(options?: { owner?: string; repo?: string }): Promise<void>

  // Trigger manual sync
  sync(options?: {
    direction?: 'both' | 'push' | 'pull'
    strategy?: ConflictStrategy
  }): Promise<SyncResult>

  // Check sync health/status
  status(): Promise<{
    connected: boolean
    owner?: string
    repo?: string
    lastSync?: string
    syncStatus?: 'idle' | 'syncing' | 'error'
    issueCount?: number
    pendingChanges?: number
  }>

  // Remove GitHub connection
  disconnect(): Promise<void>
}

export function createGithubCli(options: GithubCliOptions): GithubCli {
  const { config, createClient, createOrchestrator, log, error } = options

  /**
   * Connect current repo to GitHub App
   */
  async function connect(connectOptions?: {
    owner?: string
    repo?: string
  }): Promise<void> {
    const { owner, repo } = connectOptions || {}

    // Validate required options
    if (!owner) {
      error('Error: owner is required')
      return
    }

    if (!repo) {
      error('Error: repo is required')
      return
    }

    // Store in config
    await config.set('github.owner', owner)
    await config.set('github.repo', repo)

    log(`Connected to ${owner}/${repo}`)
  }

  /**
   * Trigger manual sync
   */
  async function sync(syncOptions?: {
    direction?: 'both' | 'push' | 'pull'
    strategy?: ConflictStrategy
  }): Promise<SyncResult> {
    const { direction = 'both', strategy } = syncOptions || {}

    // Load config to validate connection
    const owner = await config.get('github.owner')
    const repo = await config.get('github.repo')
    const token = await config.get('github.token')

    if (!owner || !repo) {
      throw new Error('Not connected to GitHub. Run connect first.')
    }

    if (!token) {
      throw new Error('No GitHub token configured.')
    }

    // Create GitHub client
    const client = createClient(token)

    // Create sync orchestrator with mock beads/mapping ops
    // In production, these would be wired up to actual beads operations
    const orchestrator = createOrchestrator({
      installation: {
        $type: 'Installation',
        $id: 'mock-installation',
        githubInstallationId: 0,
        owner,
        repo,
        accessToken: token,
        tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      githubClient: client,
      conventions: {
        labels: {
          type: {
            bug: 'bug',
            enhancement: 'feature',
            task: 'task',
            epic: 'epic',
            chore: 'chore',
          },
          priority: {
            P0: 0,
            P1: 1,
            P2: 2,
            P3: 3,
            P4: 4,
          },
          status: {
            inProgress: 'status:in-progress',
          },
        },
        dependencies: {
          pattern: 'Depends on:\\s*(.+)',
          separator: ', ',
          blocksPattern: 'Blocks:\\s*(.+)',
        },
        epics: {
          labelPrefix: 'epic:',
          bodyPattern: 'Parent:\\s*#(\\d+)',
        },
      },
      beadsOps: {
        getIssue: async (_id: string) => null,
        createIssue: async (issue: any) => issue,
        updateIssue: async (id: string, issue: any) => ({ ...issue, id }) as any,
        listIssues: async () => [],
      },
      mappingOps: {
        getMapping: async (_beadsId: string) => null,
        getMappingByGitHub: async (_number: number) => null,
        createMapping: async (mapping: any) => ({
          $type: 'IssueMapping',
          $id: 'mock-mapping',
          ...mapping,
        }),
        updateMapping: async (id: string, data: any) => ({
          $type: 'IssueMapping',
          $id: id,
          ...data,
        }) as any,
      },
    })

    // Perform sync based on direction
    let result: SyncResult

    if (direction === 'push') {
      // Push only - get beads issues and push to GitHub
      result = await orchestrator.pushToGitHub([])
    } else if (direction === 'pull') {
      // Pull only - get GitHub issues and update beads
      result = await orchestrator.pullFromGitHub()
    } else {
      // Bidirectional sync with conflict resolution
      result = await orchestrator.sync({ strategy })
    }

    // Update last sync timestamp
    await config.set('github.lastSync', new Date().toISOString())

    // Log results
    if (result.created.length > 0) {
      log(`Created ${result.created.length} issue${result.created.length === 1 ? '' : 's'}`)
    }

    if (result.updated.length > 0) {
      log(`Updated ${result.updated.length} issue${result.updated.length === 1 ? '' : 's'}`)
    }

    if (result.conflicts.length > 0) {
      log(`Resolved ${result.conflicts.length} conflict${result.conflicts.length === 1 ? '' : 's'}`)
    }

    if (result.errors.length > 0) {
      error(`Encountered ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`)
      for (const err of result.errors) {
        error(`  ${err.id}: ${err.error}`)
      }
    }

    return result
  }

  /**
   * Check sync health/status
   */
  async function status(): Promise<{
    connected: boolean
    owner?: string
    repo?: string
    lastSync?: string
    syncStatus?: 'idle' | 'syncing' | 'error'
    issueCount?: number
    pendingChanges?: number
  }> {
    const owner = await config.get('github.owner')
    const repo = await config.get('github.repo')
    const lastSync = await config.get('github.lastSync')
    const syncStatus = (await config.get('github.syncStatus')) as
      | 'idle'
      | 'syncing'
      | 'error'
      | null

    const connected = Boolean(owner && repo)

    return {
      connected,
      owner: owner || undefined,
      repo: repo || undefined,
      lastSync: lastSync || undefined,
      syncStatus: syncStatus || undefined,
    }
  }

  /**
   * Remove GitHub connection
   */
  async function disconnect(): Promise<void> {
    // Delete all GitHub config keys
    await config.delete('github.owner')
    await config.delete('github.repo')
    await config.delete('github.token')
    await config.delete('github.installationId')
    await config.delete('github.lastSync')
    await config.delete('github.syncStatus')

    log('Disconnected from GitHub')
  }

  return {
    connect,
    sync,
    status,
    disconnect,
  }
}
