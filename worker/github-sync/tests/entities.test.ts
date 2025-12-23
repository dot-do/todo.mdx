import { describe, it, expect, beforeEach } from 'vitest'
import {
  Installation,
  SyncState,
  IssueMapping,
  createInstallation,
  createSyncState,
  createIssueMapping,
  GitHubConventions
} from '../entities'

describe('entities', () => {
  describe('Installation', () => {
    it('should create installation with $type and $id', () => {
      const now = new Date().toISOString()
      const installation = createInstallation({
        githubInstallationId: 12345,
        owner: 'testorg',
        repo: 'testrepo',
        accessToken: 'ghs_test_token_12345',
        tokenExpiresAt: now
      })

      expect(installation.$type).toBe('Installation')
      expect(installation.$id).toBeDefined()
      expect(installation.$id.length).toBeGreaterThan(0)
      expect(installation.githubInstallationId).toBe(12345)
      expect(installation.owner).toBe('testorg')
      expect(installation.repo).toBe('testrepo')
      expect(installation.accessToken).toBe('ghs_test_token_12345')
      expect(installation.tokenExpiresAt).toBe(now)
      expect(installation.createdAt).toBeDefined()
      expect(installation.updatedAt).toBeDefined()
    })

    it('should include conventions if provided', () => {
      const conventions: GitHubConventions = {
        labelMapping: { bug: 'bug', feature: 'enhancement' },
        statusMapping: { open: 'open', closed: 'closed' }
      }
      const installation = createInstallation({
        githubInstallationId: 12345,
        owner: 'testorg',
        repo: 'testrepo',
        accessToken: 'ghs_test_token',
        tokenExpiresAt: new Date().toISOString(),
        conventions
      })

      expect(installation.conventions).toEqual(conventions)
    })

    it('should generate unique IDs for different installations', () => {
      const installation1 = createInstallation({
        githubInstallationId: 1,
        owner: 'org1',
        repo: 'repo1',
        accessToken: 'token1',
        tokenExpiresAt: new Date().toISOString()
      })
      const installation2 = createInstallation({
        githubInstallationId: 2,
        owner: 'org2',
        repo: 'repo2',
        accessToken: 'token2',
        tokenExpiresAt: new Date().toISOString()
      })

      expect(installation1.$id).not.toBe(installation2.$id)
    })
  })

  describe('SyncState', () => {
    it('should create sync state with initial values', () => {
      const installationId = 'test-install-123'
      const syncState = createSyncState(installationId)

      expect(syncState.$type).toBe('SyncState')
      expect(syncState.$id).toBeDefined()
      expect(syncState.$id.length).toBeGreaterThan(0)
      expect(syncState.installationId).toBe(installationId)
      expect(syncState.lastSyncAt).toBeDefined()
      expect(syncState.syncStatus).toBe('idle')
      expect(syncState.errorCount).toBe(0)
      expect(syncState.lastGitHubEventId).toBeUndefined()
      expect(syncState.lastBeadsCommit).toBeUndefined()
      expect(syncState.errorMessage).toBeUndefined()
    })

    it('should generate unique IDs for different sync states', () => {
      const syncState1 = createSyncState('install-1')
      const syncState2 = createSyncState('install-2')

      expect(syncState1.$id).not.toBe(syncState2.$id)
    })
  })

  describe('IssueMapping', () => {
    it('should create issue mapping with all required fields', () => {
      const now = new Date().toISOString()
      const mapping = createIssueMapping({
        installationId: 'install-123',
        beadsId: 'todo-abc',
        githubNumber: 42,
        githubUrl: 'https://github.com/testorg/testrepo/issues/42',
        lastSyncedAt: now,
        beadsUpdatedAt: now,
        githubUpdatedAt: now
      })

      expect(mapping.$type).toBe('IssueMapping')
      expect(mapping.$id).toBeDefined()
      expect(mapping.$id.length).toBeGreaterThan(0)
      expect(mapping.installationId).toBe('install-123')
      expect(mapping.beadsId).toBe('todo-abc')
      expect(mapping.githubNumber).toBe(42)
      expect(mapping.githubUrl).toBe('https://github.com/testorg/testrepo/issues/42')
      expect(mapping.lastSyncedAt).toBe(now)
      expect(mapping.beadsUpdatedAt).toBe(now)
      expect(mapping.githubUpdatedAt).toBe(now)
    })

    it('should generate unique IDs for different mappings', () => {
      const now = new Date().toISOString()
      const mapping1 = createIssueMapping({
        installationId: 'install-1',
        beadsId: 'todo-1',
        githubNumber: 1,
        githubUrl: 'https://github.com/org/repo/issues/1',
        lastSyncedAt: now,
        beadsUpdatedAt: now,
        githubUpdatedAt: now
      })
      const mapping2 = createIssueMapping({
        installationId: 'install-1',
        beadsId: 'todo-2',
        githubNumber: 2,
        githubUrl: 'https://github.com/org/repo/issues/2',
        lastSyncedAt: now,
        beadsUpdatedAt: now,
        githubUpdatedAt: now
      })

      expect(mapping1.$id).not.toBe(mapping2.$id)
    })
  })

  describe('ID generation', () => {
    it('should use reasonable format for IDs', () => {
      const installation = createInstallation({
        githubInstallationId: 12345,
        owner: 'test',
        repo: 'test',
        accessToken: 'token',
        tokenExpiresAt: new Date().toISOString()
      })

      // ID should be alphanumeric with possible separators
      expect(installation.$id).toMatch(/^[a-zA-Z0-9_-]+$/)
    })
  })

  describe('Required field validation', () => {
    it('should require all installation fields', () => {
      const now = new Date().toISOString()

      // This should compile and work correctly
      const installation = createInstallation({
        githubInstallationId: 123,
        owner: 'org',
        repo: 'repo',
        accessToken: 'token',
        tokenExpiresAt: now
      })

      expect(installation).toBeDefined()
    })

    it('should require all issue mapping fields', () => {
      const now = new Date().toISOString()

      // This should compile and work correctly
      const mapping = createIssueMapping({
        installationId: 'install-1',
        beadsId: 'todo-1',
        githubNumber: 1,
        githubUrl: 'https://github.com/org/repo/issues/1',
        lastSyncedAt: now,
        beadsUpdatedAt: now,
        githubUpdatedAt: now
      })

      expect(mapping).toBeDefined()
    })
  })
})
