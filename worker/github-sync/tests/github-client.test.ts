import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGitHubClient, type GitHubClient, type GitHubIssue } from '../github-client'

describe('GitHubClient', () => {
  let mockOctokit: any
  let client: GitHubClient

  beforeEach(() => {
    // Create a mock Octokit instance
    mockOctokit = {
      rest: {
        issues: {
          create: vi.fn(),
          update: vi.fn(),
          get: vi.fn(),
          listForRepo: vi.fn(),
          addLabels: vi.fn(),
          removeLabel: vi.fn(),
        },
      },
    }

    // Create client with mock Octokit
    client = createGitHubClient({
      token: 'test-token',
      octokit: mockOctokit,
    })
  })

  describe('createIssue', () => {
    it('should call octokit.rest.issues.create with correct params', async () => {
      const mockResponse: GitHubIssue = {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'bug' }],
        assignee: { login: 'testuser' },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/1',
      }

      mockOctokit.rest.issues.create.mockResolvedValue({ data: mockResponse })

      const result = await client.createIssue('owner', 'repo', {
        title: 'Test Issue',
        body: 'Test body',
        labels: ['bug'],
        assignees: ['testuser'],
      })

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: ['bug'],
        assignees: ['testuser'],
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle minimal issue creation', async () => {
      const mockResponse: GitHubIssue = {
        number: 2,
        title: 'Minimal Issue',
        body: null,
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/2',
      }

      mockOctokit.rest.issues.create.mockResolvedValue({ data: mockResponse })

      const result = await client.createIssue('owner', 'repo', {
        title: 'Minimal Issue',
      })

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Minimal Issue',
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateIssue', () => {
    it('should call octokit.rest.issues.update with correct params', async () => {
      const mockResponse: GitHubIssue = {
        number: 1,
        title: 'Updated Issue',
        body: 'Updated body',
        state: 'closed',
        labels: [{ name: 'enhancement' }],
        assignee: { login: 'newuser' },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        closed_at: '2023-01-02T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/1',
      }

      mockOctokit.rest.issues.update.mockResolvedValue({ data: mockResponse })

      const result = await client.updateIssue('owner', 'repo', 1, {
        title: 'Updated Issue',
        body: 'Updated body',
        state: 'closed',
        labels: ['enhancement'],
        assignees: ['newuser'],
      })

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        title: 'Updated Issue',
        body: 'Updated body',
        state: 'closed',
        labels: ['enhancement'],
        assignees: ['newuser'],
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle partial updates', async () => {
      const mockResponse: GitHubIssue = {
        number: 1,
        title: 'Original Title',
        body: 'Updated body only',
        state: 'open',
        labels: [],
        assignee: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/1',
      }

      mockOctokit.rest.issues.update.mockResolvedValue({ data: mockResponse })

      const result = await client.updateIssue('owner', 'repo', 1, {
        body: 'Updated body only',
      })

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        body: 'Updated body only',
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getIssue', () => {
    it('should call octokit.rest.issues.get with correct params', async () => {
      const mockResponse: GitHubIssue = {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        labels: [{ name: 'bug' }],
        assignee: { login: 'testuser' },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        closed_at: null,
        html_url: 'https://github.com/owner/repo/issues/1',
      }

      mockOctokit.rest.issues.get.mockResolvedValue({ data: mockResponse })

      const result = await client.getIssue('owner', 'repo', 1)

      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('listIssues', () => {
    it('should call octokit.rest.issues.listForRepo with default options', async () => {
      const mockResponse: GitHubIssue[] = [
        {
          number: 1,
          title: 'Issue 1',
          body: 'Body 1',
          state: 'open',
          labels: [],
          assignee: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          closed_at: null,
          html_url: 'https://github.com/owner/repo/issues/1',
        },
        {
          number: 2,
          title: 'Issue 2',
          body: 'Body 2',
          state: 'open',
          labels: [],
          assignee: null,
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
          closed_at: null,
          html_url: 'https://github.com/owner/repo/issues/2',
        },
      ]

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: mockResponse })

      const result = await client.listIssues('owner', 'repo')

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle state and pagination options', async () => {
      const mockResponse: GitHubIssue[] = []

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: mockResponse })

      const result = await client.listIssues('owner', 'repo', {
        state: 'closed',
        per_page: 50,
      })

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'closed',
        per_page: 50,
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle "all" state option', async () => {
      const mockResponse: GitHubIssue[] = []

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: mockResponse })

      await client.listIssues('owner', 'repo', { state: 'all' })

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'all',
      })
    })
  })

  describe('addLabels', () => {
    it('should call octokit.rest.issues.addLabels with correct params', async () => {
      mockOctokit.rest.issues.addLabels.mockResolvedValue({ data: [] })

      await client.addLabels('owner', 'repo', 1, ['bug', 'enhancement'])

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: ['bug', 'enhancement'],
      })
    })

    it('should handle empty labels array', async () => {
      mockOctokit.rest.issues.addLabels.mockResolvedValue({ data: [] })

      await client.addLabels('owner', 'repo', 1, [])

      expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        labels: [],
      })
    })
  })

  describe('removeLabel', () => {
    it('should call octokit.rest.issues.removeLabel with correct params', async () => {
      mockOctokit.rest.issues.removeLabel.mockResolvedValue({ data: [] })

      await client.removeLabel('owner', 'repo', 1, 'bug')

      expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        name: 'bug',
      })
    })
  })

  describe('client creation', () => {
    it('should create client with token only', () => {
      const client = createGitHubClient({ token: 'test-token' })
      expect(client).toBeDefined()
      expect(typeof client.createIssue).toBe('function')
      expect(typeof client.updateIssue).toBe('function')
      expect(typeof client.getIssue).toBe('function')
      expect(typeof client.listIssues).toBe('function')
      expect(typeof client.addLabels).toBe('function')
      expect(typeof client.removeLabel).toBe('function')
    })

    it('should create client with installation ID', () => {
      const client = createGitHubClient({
        token: 'test-token',
        installationId: 12345,
      })
      expect(client).toBeDefined()
    })
  })
})
