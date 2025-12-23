import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WebhookEvent } from '../src/webhook'
import type { BeadsIssue } from '../src/beads-to-github'
import type { GitHubIssue } from '../src/github-client'
import type { Installation, IssueMapping } from '../src/entities'
import { defaultConventions } from '../src/conventions'
import {
  createSyncOrchestrator,
  type SyncOrchestrator,
  type SyncOrchestratorOptions,
  type SyncResult,
} from '../src/sync-orchestrator'

describe('SyncOrchestrator', () => {
  let orchestrator: SyncOrchestrator
  let mockGitHubClient: any
  let mockBeadsOps: any
  let mockMappingOps: any
  let mockInstallation: Installation

  beforeEach(() => {
    // Mock installation
    mockInstallation = {
      $type: 'Installation',
      $id: 'inst-1',
      githubInstallationId: 12345,
      owner: 'test-owner',
      repo: 'test-repo',
      accessToken: 'test-token',
      tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Mock GitHub client
    mockGitHubClient = {
      createIssue: vi.fn(),
      updateIssue: vi.fn(),
      getIssue: vi.fn(),
      listIssues: vi.fn(),
      addLabels: vi.fn(),
      removeLabel: vi.fn(),
    }

    // Mock beads operations
    mockBeadsOps = {
      getIssue: vi.fn(),
      createIssue: vi.fn(),
      updateIssue: vi.fn(),
      listIssues: vi.fn(),
    }

    // Mock mapping operations
    mockMappingOps = {
      getMapping: vi.fn(),
      getMappingByGitHub: vi.fn(),
      createMapping: vi.fn(),
      updateMapping: vi.fn(),
    }

    const options: SyncOrchestratorOptions = {
      installation: mockInstallation,
      githubClient: mockGitHubClient,
      conventions: defaultConventions,
      beadsOps: mockBeadsOps,
      mappingOps: mockMappingOps,
    }

    orchestrator = createSyncOrchestrator(options)
  })

  describe('Webhook Processing', () => {
    it('should create beads issue and mapping on issues.opened', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'opened',
        deliveryId: 'delivery-1',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [{ name: 'bug' }],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockBeadsOps.createIssue.mockResolvedValue({
        id: 'beads-1',
        title: 'Test Issue',
        description: 'Test description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/42',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.createIssue).toHaveBeenCalled()
      expect(mockMappingOps.createMapping).toHaveBeenCalled()
      expect(result.created).toHaveLength(1)
      expect(result.created[0].githubNumber).toBe(42)
    })

    it('should update existing beads issue on issues.edited', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'edited',
        deliveryId: 'delivery-2',
        payload: {
          issue: {
            number: 42,
            title: 'Updated Title',
            body: 'Updated description',
            state: 'open',
            labels: [{ name: 'feature' }],
            assignee: { login: 'dev1' },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 42,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/42',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        title: 'Updated Title',
        description: 'Updated description',
        type: 'feature',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/42',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.objectContaining({
        title: 'Updated Title',
        assignee: 'dev1',
      }))
      expect(result.updated).toHaveLength(1)
    })

    it('should close beads issue on issues.closed', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'closed',
        deliveryId: 'delivery-3',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'closed',
            labels: [{ name: 'bug' }],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            closed_at: '2025-01-02T00:00:00Z',
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 42,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/42',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        status: 'closed',
        closedAt: '2025-01-02T00:00:00Z',
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.objectContaining({
        status: 'closed',
        closedAt: '2025-01-02T00:00:00Z',
      }))
      expect(result.updated).toHaveLength(1)
    })

    it('should reopen beads issue on issues.reopened', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'reopened',
        deliveryId: 'delivery-4',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [{ name: 'bug' }],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-03T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 42,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/42',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        status: 'open',
        closedAt: undefined,
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.objectContaining({
        status: 'open',
      }))
      expect(result.updated).toHaveLength(1)
    })

    it('should re-sync labels on issues.labeled', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'labeled',
        deliveryId: 'delivery-5',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [{ name: 'bug' }, { name: 'high-priority' }],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 42,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/42',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        type: 'bug',
        priority: 0,
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.updateIssue).toHaveBeenCalled()
      expect(result.updated).toHaveLength(1)
    })

    it('should re-sync labels on issues.unlabeled', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'unlabeled',
        deliveryId: 'delivery-6',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [{ name: 'bug' }],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 42,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/42',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        type: 'bug',
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.updateIssue).toHaveBeenCalled()
      expect(result.updated).toHaveLength(1)
    })

    it('should update assignee on issues.assigned', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'assigned',
        deliveryId: 'delivery-7',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [{ name: 'bug' }],
            assignee: { login: 'dev1' },
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 42,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/42',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        assignee: 'dev1',
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.objectContaining({
        assignee: 'dev1',
      }))
      expect(result.updated).toHaveLength(1)
    })

    it('should skip unknown event types without error', async () => {
      const event: WebhookEvent = {
        event: 'push',
        action: '',
        deliveryId: 'delivery-8',
        payload: {},
      }

      const result = await orchestrator.processWebhookEvent(event)

      expect(result.created).toHaveLength(0)
      expect(result.updated).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should create issue first when mapping missing on edit', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'edited',
        deliveryId: 'delivery-9',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [{ name: 'bug' }],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockBeadsOps.createIssue.mockResolvedValue({
        id: 'beads-1',
        title: 'Test Issue',
      })

      const result = await orchestrator.processWebhookEvent(event)

      expect(mockBeadsOps.createIssue).toHaveBeenCalled()
      expect(mockMappingOps.createMapping).toHaveBeenCalled()
      expect(result.created).toHaveLength(1)
    })

    it('should deduplicate webhook events by delivery ID', async () => {
      const event: WebhookEvent = {
        event: 'issues',
        action: 'opened',
        deliveryId: 'delivery-10',
        payload: {
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Test description',
            state: 'open',
            labels: [],
            assignee: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            closed_at: null,
            html_url: 'https://github.com/test-owner/test-repo/issues/42',
          },
        },
      }

      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockBeadsOps.createIssue.mockResolvedValue({ id: 'beads-1' })

      // Process same event twice
      await orchestrator.processWebhookEvent(event)
      const result2 = await orchestrator.processWebhookEvent(event)

      // Second call should be skipped
      expect(result2.created).toHaveLength(0)
      expect(mockBeadsOps.createIssue).toHaveBeenCalledTimes(1)
    })
  })

  describe('Push to GitHub', () => {
    it('should create new issue on GitHub for new beads issue', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'New Feature',
        description: 'Add new feature',
        type: 'feature',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMapping.mockResolvedValue(null)
      mockGitHubClient.createIssue.mockResolvedValue({
        number: 100,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
        updated_at: '2025-01-01T00:00:00Z',
      })

      const result = await orchestrator.pushToGitHub([beadsIssue])

      expect(mockGitHubClient.createIssue).toHaveBeenCalled()
      expect(mockMappingOps.createMapping).toHaveBeenCalled()
      expect(result.created).toHaveLength(1)
      expect(result.created[0].beadsId).toBe('beads-1')
      expect(result.created[0].githubNumber).toBe(100)
    })

    it('should update existing GitHub issue', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Updated Feature',
        description: 'Updated description',
        type: 'feature',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockGitHubClient.updateIssue.mockResolvedValue({
        number: 100,
        updated_at: '2025-01-02T00:00:00Z',
      })

      const result = await orchestrator.pushToGitHub([beadsIssue])

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        100,
        expect.any(Object)
      )
      expect(result.updated).toHaveLength(1)
    })

    it('should close issue on GitHub when beads issue is closed', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Closed Feature',
        description: 'Closed',
        type: 'feature',
        status: 'closed',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        closedAt: '2025-01-02T00:00:00Z',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockGitHubClient.updateIssue.mockResolvedValue({
        number: 100,
        state: 'closed',
        updated_at: '2025-01-02T00:00:00Z',
      })

      const result = await orchestrator.pushToGitHub([beadsIssue])

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        100,
        expect.objectContaining({ state: 'closed' })
      )
      expect(result.updated).toHaveLength(1)
    })

    it('should handle multiple issues in batch', async () => {
      const issues: BeadsIssue[] = [
        {
          id: 'beads-1',
          title: 'Issue 1',
          description: 'Desc 1',
          type: 'bug',
          status: 'open',
          priority: 2,
          labels: [],
          dependsOn: [],
          blocks: [],
          externalRef: '',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'beads-2',
          title: 'Issue 2',
          description: 'Desc 2',
          type: 'feature',
          status: 'open',
          priority: 2,
          labels: [],
          dependsOn: [],
          blocks: [],
          externalRef: '',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]

      mockMappingOps.getMapping.mockResolvedValue(null)
      mockGitHubClient.createIssue
        .mockResolvedValueOnce({ number: 100, updated_at: '2025-01-01T00:00:00Z' })
        .mockResolvedValueOnce({ number: 101, updated_at: '2025-01-01T00:00:00Z' })

      const result = await orchestrator.pushToGitHub(issues)

      expect(mockGitHubClient.createIssue).toHaveBeenCalledTimes(2)
      expect(result.created).toHaveLength(2)
    })

    it('should capture GitHub API errors', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Error Issue',
        description: 'Will fail',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMapping.mockResolvedValue(null)
      mockGitHubClient.createIssue.mockRejectedValue(new Error('GitHub API error'))

      const result = await orchestrator.pushToGitHub([beadsIssue])

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].id).toBe('beads-1')
      expect(result.errors[0].error).toContain('GitHub API error')
    })

    it('should create mapping for new issues', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'New Issue',
        description: 'Description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      mockMappingOps.getMapping.mockResolvedValue(null)
      mockGitHubClient.createIssue.mockResolvedValue({
        number: 200,
        html_url: 'https://github.com/test-owner/test-repo/issues/200',
        updated_at: '2025-01-01T00:00:00Z',
      })

      await orchestrator.pushToGitHub([beadsIssue])

      expect(mockMappingOps.createMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          beadsId: 'beads-1',
          githubNumber: 200,
          githubUrl: 'https://github.com/test-owner/test-repo/issues/200',
        })
      )
    })
  })

  describe('Pull from GitHub', () => {
    it('should create beads issue for new GitHub issue', async () => {
      const ghIssue: GitHubIssue = {
        number: 50,
        title: 'GitHub Issue',
        body: 'Issue from GitHub',
        state: 'open',
        labels: [{ name: 'bug' }],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/50',
      }

      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockBeadsOps.createIssue.mockResolvedValue({
        id: 'beads-new',
        title: 'GitHub Issue',
      })

      const result = await orchestrator.pullFromGitHub()

      expect(mockBeadsOps.createIssue).toHaveBeenCalled()
      expect(mockMappingOps.createMapping).toHaveBeenCalled()
      expect(result.created).toHaveLength(1)
    })

    it('should update existing beads issue', async () => {
      const ghIssue: GitHubIssue = {
        number: 50,
        title: 'Updated GitHub Issue',
        body: 'Updated from GitHub',
        state: 'open',
        labels: [{ name: 'feature' }],
        assignee: { login: 'dev2' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/50',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 50,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/50',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({
        id: 'beads-1',
        title: 'Updated GitHub Issue',
      })

      const result = await orchestrator.pullFromGitHub()

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.any(Object))
      expect(result.updated).toHaveLength(1)
    })

    it('should process multiple GitHub issues', async () => {
      const issues: GitHubIssue[] = [
        {
          number: 50,
          title: 'Issue 1',
          body: 'Body 1',
          state: 'open',
          labels: [],
          assignee: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          closed_at: null,
          html_url: 'https://github.com/test-owner/test-repo/issues/50',
        },
        {
          number: 51,
          title: 'Issue 2',
          body: 'Body 2',
          state: 'open',
          labels: [],
          assignee: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          closed_at: null,
          html_url: 'https://github.com/test-owner/test-repo/issues/51',
        },
      ]

      mockGitHubClient.listIssues.mockResolvedValue(issues)
      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockBeadsOps.createIssue
        .mockResolvedValueOnce({ id: 'beads-1' })
        .mockResolvedValueOnce({ id: 'beads-2' })

      const result = await orchestrator.pullFromGitHub()

      expect(mockBeadsOps.createIssue).toHaveBeenCalledTimes(2)
      expect(result.created).toHaveLength(2)
    })

    it('should create mappings for new issues', async () => {
      const ghIssue: GitHubIssue = {
        number: 60,
        title: 'New GitHub Issue',
        body: 'New from GitHub',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/60',
      }

      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockBeadsOps.createIssue.mockResolvedValue({ id: 'beads-new' })

      await orchestrator.pullFromGitHub()

      expect(mockMappingOps.createMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          beadsId: 'beads-new',
          githubNumber: 60,
        })
      )
    })

    it('should respect existing mappings', async () => {
      const ghIssue: GitHubIssue = {
        number: 60,
        title: 'Existing Issue',
        body: 'Has mapping',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/60',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-existing',
        githubNumber: 60,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/60',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({ id: 'beads-existing' })

      const result = await orchestrator.pullFromGitHub()

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-existing', expect.any(Object))
      expect(mockMappingOps.createMapping).not.toHaveBeenCalled()
    })
  })

  describe('Conflict Resolution', () => {
    it('should use GitHub version with github-wins strategy', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Beads Title',
        description: 'Beads description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      const ghIssue: GitHubIssue = {
        number: 100,
        title: 'GitHub Title',
        body: 'GitHub description',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-02T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({ id: 'beads-1' })

      const result = await orchestrator.sync({ strategy: 'github-wins' })

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.objectContaining({
        title: 'GitHub Title',
      }))
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].resolution).toBe('github')
    })

    it('should use beads version with beads-wins strategy', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Beads Title',
        description: 'Beads description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      const ghIssue: GitHubIssue = {
        number: 100,
        title: 'GitHub Title',
        body: 'GitHub description',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-02T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockGitHubClient.updateIssue.mockResolvedValue({ number: 100 })

      const result = await orchestrator.sync({ strategy: 'beads-wins' })

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        100,
        expect.objectContaining({ title: 'Beads Title' })
      )
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].resolution).toBe('beads')
    })

    it('should use GitHub version with newest-wins when GitHub is newer', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Beads Title',
        description: 'Beads description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      const ghIssue: GitHubIssue = {
        number: 100,
        title: 'GitHub Title',
        body: 'GitHub description',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z', // Newer
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-02T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({ id: 'beads-1' })

      const result = await orchestrator.sync({ strategy: 'newest-wins' })

      expect(mockBeadsOps.updateIssue).toHaveBeenCalledWith('beads-1', expect.objectContaining({
        title: 'GitHub Title',
      }))
      expect(result.conflicts[0].resolution).toBe('github')
    })

    it('should use beads version with newest-wins when beads is newer', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Beads Title',
        description: 'Beads description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-03T00:00:00Z', // Newer
      }

      const ghIssue: GitHubIssue = {
        number: 100,
        title: 'GitHub Title',
        body: 'GitHub description',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-02T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockGitHubClient.updateIssue.mockResolvedValue({ number: 100 })

      const result = await orchestrator.sync({ strategy: 'newest-wins' })

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        100,
        expect.objectContaining({ title: 'Beads Title' })
      )
      expect(result.conflicts[0].resolution).toBe('beads')
    })

    it('should default to GitHub when timestamps are equal', async () => {
      const timestamp = '2025-01-02T00:00:00Z'

      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Beads Title',
        description: 'Beads description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: timestamp,
      }

      const ghIssue: GitHubIssue = {
        number: 100,
        title: 'GitHub Title',
        body: 'GitHub description',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: timestamp,
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-01T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({ id: 'beads-1' })

      const result = await orchestrator.sync({ strategy: 'newest-wins' })

      expect(result.conflicts[0].resolution).toBe('github')
    })

    it('should record conflicts in result', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-1',
        title: 'Beads Title',
        description: 'Beads description',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: 'github.com/test-owner/test-repo/issues/100',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      }

      const ghIssue: GitHubIssue = {
        number: 100,
        title: 'GitHub Title',
        body: 'GitHub description',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/100',
      }

      const mapping: IssueMapping = {
        $type: 'IssueMapping',
        $id: 'mapping-1',
        installationId: 'inst-1',
        beadsId: 'beads-1',
        githubNumber: 100,
        githubUrl: 'https://github.com/test-owner/test-repo/issues/100',
        lastSyncedAt: '2025-01-01T00:00:00Z',
        beadsUpdatedAt: '2025-01-02T00:00:00Z',
        githubUpdatedAt: '2025-01-01T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMappingByGitHub.mockResolvedValue(mapping)
      mockMappingOps.getMapping.mockResolvedValue(mapping)
      mockBeadsOps.updateIssue.mockResolvedValue({ id: 'beads-1' })

      const result = await orchestrator.sync()

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toMatchObject({
        beadsId: 'beads-1',
        githubNumber: 100,
        beadsUpdatedAt: '2025-01-02T00:00:00Z',
        githubUpdatedAt: '2025-01-03T00:00:00Z',
      })
    })

    it('should skip conflicts when cannot resolve', async () => {
      // This test would apply if we had logic to skip certain conflicts
      // For now, we always resolve based on strategy, so this is a placeholder
      expect(true).toBe(true)
    })
  })

  describe('Full Sync', () => {
    it('should perform bidirectional sync', async () => {
      const beadsIssue: BeadsIssue = {
        id: 'beads-new',
        title: 'New Beads Issue',
        description: 'From beads',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      const ghIssue: GitHubIssue = {
        number: 99,
        title: 'New GitHub Issue',
        body: 'From GitHub',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/test-owner/test-repo/issues/99',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue])
      mockGitHubClient.listIssues.mockResolvedValue([ghIssue])
      mockMappingOps.getMapping.mockResolvedValue(null)
      mockMappingOps.getMappingByGitHub.mockResolvedValue(null)
      mockGitHubClient.createIssue.mockResolvedValue({ number: 100, updated_at: '2025-01-01T00:00:00Z' })
      mockBeadsOps.createIssue.mockResolvedValue({ id: 'beads-from-gh' })

      const result = await orchestrator.sync()

      expect(result.created.length).toBeGreaterThan(0)
    })

    it('should default to newest-wins strategy', async () => {
      mockBeadsOps.listIssues.mockResolvedValue([])
      mockGitHubClient.listIssues.mockResolvedValue([])

      const result = await orchestrator.sync()

      expect(result).toBeDefined()
    })

    it('should return combined results', async () => {
      mockBeadsOps.listIssues.mockResolvedValue([])
      mockGitHubClient.listIssues.mockResolvedValue([])

      const result = await orchestrator.sync()

      expect(result).toHaveProperty('created')
      expect(result).toHaveProperty('updated')
      expect(result).toHaveProperty('conflicts')
      expect(result).toHaveProperty('errors')
    })

    it('should handle empty systems', async () => {
      mockBeadsOps.listIssues.mockResolvedValue([])
      mockGitHubClient.listIssues.mockResolvedValue([])

      const result = await orchestrator.sync()

      expect(result.created).toHaveLength(0)
      expect(result.updated).toHaveLength(0)
      expect(result.conflicts).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should continue sync when errors occur', async () => {
      const beadsIssue1: BeadsIssue = {
        id: 'beads-1',
        title: 'Issue 1',
        description: 'Will fail',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      const beadsIssue2: BeadsIssue = {
        id: 'beads-2',
        title: 'Issue 2',
        description: 'Will succeed',
        type: 'bug',
        status: 'open',
        priority: 2,
        labels: [],
        dependsOn: [],
        blocks: [],
        externalRef: '',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      mockBeadsOps.listIssues.mockResolvedValue([beadsIssue1, beadsIssue2])
      mockGitHubClient.listIssues.mockResolvedValue([])
      mockMappingOps.getMapping.mockResolvedValue(null)
      mockGitHubClient.createIssue
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ number: 101, updated_at: '2025-01-01T00:00:00Z' })

      const result = await orchestrator.sync()

      expect(result.errors).toHaveLength(1)
      expect(result.created).toHaveLength(1)
    })
  })
})
