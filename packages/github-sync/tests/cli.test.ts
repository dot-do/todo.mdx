import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGithubCli, type GithubCliOptions, type GithubCli } from '../src/cli'
import type { GitHubClient } from '../src/github-client'
import type { SyncOrchestrator, SyncResult } from '../src/sync-orchestrator'

describe('GitHub CLI', () => {
  let mockConfig: Map<string, string>
  let mockGitHubClient: GitHubClient
  let mockOrchestrator: SyncOrchestrator
  let mockLog: ReturnType<typeof vi.fn>
  let mockError: ReturnType<typeof vi.fn>
  let cli: GithubCli
  let cliOptions: GithubCliOptions

  beforeEach(() => {
    // Mock config storage
    mockConfig = new Map<string, string>()

    // Mock GitHub client
    mockGitHubClient = {
      createIssue: vi.fn(),
      updateIssue: vi.fn(),
      getIssue: vi.fn(),
      listIssues: vi.fn().mockResolvedValue([]),
      addLabels: vi.fn(),
      removeLabel: vi.fn(),
    }

    // Mock sync orchestrator
    mockOrchestrator = {
      processWebhookEvent: vi.fn(),
      pushToGitHub: vi.fn().mockResolvedValue({
        created: [],
        updated: [],
        conflicts: [],
        errors: [],
      }),
      pullFromGitHub: vi.fn().mockResolvedValue({
        created: [],
        updated: [],
        conflicts: [],
        errors: [],
      }),
      sync: vi.fn().mockResolvedValue({
        created: [],
        updated: [],
        conflicts: [],
        errors: [],
      }),
    }

    // Mock output functions
    mockLog = vi.fn()
    mockError = vi.fn()

    // Create CLI options
    cliOptions = {
      config: {
        get: vi.fn(async (key: string) => mockConfig.get(key) || null),
        set: vi.fn(async (key: string, value: string) => {
          mockConfig.set(key, value)
        }),
        delete: vi.fn(async (key: string) => {
          mockConfig.delete(key)
        }),
      },
      createClient: vi.fn(() => mockGitHubClient),
      createOrchestrator: vi.fn(() => mockOrchestrator),
      log: mockLog,
      error: mockError,
    }

    cli = createGithubCli(cliOptions)
  })

  describe('connect', () => {
    it('should store owner and repo in config', async () => {
      await cli.connect({ owner: 'testowner', repo: 'testrepo' })

      expect(cliOptions.config.set).toHaveBeenCalledWith('github.owner', 'testowner')
      expect(cliOptions.config.set).toHaveBeenCalledWith('github.repo', 'testrepo')
    })

    it('should use provided owner option', async () => {
      await cli.connect({ owner: 'customowner', repo: 'testrepo' })

      expect(cliOptions.config.set).toHaveBeenCalledWith('github.owner', 'customowner')
    })

    it('should use provided repo option', async () => {
      await cli.connect({ owner: 'testowner', repo: 'customrepo' })

      expect(cliOptions.config.set).toHaveBeenCalledWith('github.repo', 'customrepo')
    })

    it('should log success message', async () => {
      await cli.connect({ owner: 'testowner', repo: 'testrepo' })

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('Connected to testowner/testrepo')
      )
    })

    it('should handle missing owner gracefully', async () => {
      await cli.connect({ repo: 'testrepo' })

      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('owner'))
    })

    it('should handle missing repo gracefully', async () => {
      await cli.connect({ owner: 'testowner' })

      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('repo'))
    })
  })

  describe('sync', () => {
    beforeEach(() => {
      // Set up connected state
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')
      mockConfig.set('github.token', 'test-token')
    })

    it('should call sync with default direction (both)', async () => {
      await cli.sync()

      expect(mockOrchestrator.sync).toHaveBeenCalledWith({
        strategy: undefined,
      })
    })

    it('should call pushToGitHub when direction is push', async () => {
      // Mock beads ops to return empty array
      const pushResult: SyncResult = {
        created: [{ beadsId: 'test-1', githubNumber: 1 }],
        updated: [],
        conflicts: [],
        errors: [],
      }
      mockOrchestrator.pushToGitHub = vi.fn().mockResolvedValue(pushResult)

      await cli.sync({ direction: 'push' })

      expect(mockOrchestrator.pushToGitHub).toHaveBeenCalled()
    })

    it('should call pullFromGitHub when direction is pull', async () => {
      const pullResult: SyncResult = {
        created: [{ beadsId: 'test-1', githubNumber: 1 }],
        updated: [],
        conflicts: [],
        errors: [],
      }
      mockOrchestrator.pullFromGitHub = vi.fn().mockResolvedValue(pullResult)

      await cli.sync({ direction: 'pull' })

      expect(mockOrchestrator.pullFromGitHub).toHaveBeenCalled()
    })

    it('should respect strategy option', async () => {
      await cli.sync({ strategy: 'github-wins' })

      expect(mockOrchestrator.sync).toHaveBeenCalledWith({
        strategy: 'github-wins',
      })
    })

    it('should return SyncResult', async () => {
      const expectedResult: SyncResult = {
        created: [{ beadsId: 'test-1', githubNumber: 1 }],
        updated: [{ beadsId: 'test-2', githubNumber: 2 }],
        conflicts: [],
        errors: [],
      }
      mockOrchestrator.sync = vi.fn().mockResolvedValue(expectedResult)

      const result = await cli.sync()

      expect(result).toEqual(expectedResult)
    })

    it('should log created issues', async () => {
      const syncResult: SyncResult = {
        created: [
          { beadsId: 'test-1', githubNumber: 1 },
          { beadsId: 'test-2', githubNumber: 2 },
        ],
        updated: [],
        conflicts: [],
        errors: [],
      }
      mockOrchestrator.sync = vi.fn().mockResolvedValue(syncResult)

      await cli.sync()

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Created 2'))
    })

    it('should log updated issues', async () => {
      const syncResult: SyncResult = {
        created: [],
        updated: [
          { beadsId: 'test-1', githubNumber: 1 },
          { beadsId: 'test-2', githubNumber: 2 },
        ],
        conflicts: [],
        errors: [],
      }
      mockOrchestrator.sync = vi.fn().mockResolvedValue(syncResult)

      await cli.sync()

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Updated 2'))
    })

    it('should log conflicts', async () => {
      const syncResult: SyncResult = {
        created: [],
        updated: [],
        conflicts: [
          {
            beadsId: 'test-1',
            githubNumber: 1,
            beadsUpdatedAt: '2023-01-01T00:00:00Z',
            githubUpdatedAt: '2023-01-02T00:00:00Z',
            resolution: 'github',
          },
        ],
        errors: [],
      }
      mockOrchestrator.sync = vi.fn().mockResolvedValue(syncResult)

      await cli.sync()

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('1 conflict'))
    })

    it('should throw if not connected', async () => {
      // Clear config to simulate not connected
      mockConfig.clear()

      await expect(cli.sync()).rejects.toThrow('Not connected')
    })
  })

  describe('status', () => {
    it('should return connected: false when no config', async () => {
      const status = await cli.status()

      expect(status.connected).toBe(false)
    })

    it('should return owner when configured', async () => {
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')

      const status = await cli.status()

      expect(status.owner).toBe('testowner')
    })

    it('should return repo when configured', async () => {
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')

      const status = await cli.status()

      expect(status.repo).toBe('testrepo')
    })

    it('should return lastSync timestamp', async () => {
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')
      mockConfig.set('github.lastSync', '2023-01-01T00:00:00Z')

      const status = await cli.status()

      expect(status.lastSync).toBe('2023-01-01T00:00:00Z')
    })

    it('should return syncStatus', async () => {
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')
      mockConfig.set('github.syncStatus', 'idle')

      const status = await cli.status()

      expect(status.syncStatus).toBe('idle')
    })

    it('should return connected: true when owner and repo exist', async () => {
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')

      const status = await cli.status()

      expect(status.connected).toBe(true)
    })
  })

  describe('disconnect', () => {
    beforeEach(() => {
      mockConfig.set('github.owner', 'testowner')
      mockConfig.set('github.repo', 'testrepo')
      mockConfig.set('github.token', 'test-token')
      mockConfig.set('github.lastSync', '2023-01-01T00:00:00Z')
    })

    it('should delete github.owner config key', async () => {
      await cli.disconnect()

      expect(cliOptions.config.delete).toHaveBeenCalledWith('github.owner')
    })

    it('should delete github.repo config key', async () => {
      await cli.disconnect()

      expect(cliOptions.config.delete).toHaveBeenCalledWith('github.repo')
    })

    it('should delete github.token config key', async () => {
      await cli.disconnect()

      expect(cliOptions.config.delete).toHaveBeenCalledWith('github.token')
    })

    it('should log confirmation', async () => {
      await cli.disconnect()

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Disconnected'))
    })

    it('should work even if not connected', async () => {
      mockConfig.clear()

      await expect(cli.disconnect()).resolves.not.toThrow()
    })

    it('should return cleanly', async () => {
      const result = await cli.disconnect()

      expect(result).toBeUndefined()
    })
  })
})
