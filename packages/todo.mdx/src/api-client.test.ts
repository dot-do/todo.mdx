/**
 * Tests for API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TodoApiClient, loadApiIssues } from './api-client.js'
import type { Issue } from './types.js'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('TodoApiClient', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('should fetch issues from the API', async () => {
    const client = new TodoApiClient({
      baseUrl: 'https://test.api',
      apiKey: 'test-key',
      owner: 'test-owner',
      repo: 'test-repo',
    })

    // Mock API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        issues: [
          {
            id: 1,
            localId: 'test-1',
            title: 'Test Issue',
            body: 'Test body',
            status: 'open',
            priority: 2,
            labels: ['bug'],
            assignees: ['user1'],
            type: 'task',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            dependsOn: [],
          },
        ],
      }),
    })

    const issues = await client.fetchIssues()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.api/api/repos/test-owner/test-repo/issues',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      id: 'test-1',
      title: 'Test Issue',
      state: 'open',
    })
  })

  it('should apply client-side filters', async () => {
    const client = new TodoApiClient({
      baseUrl: 'https://test.api',
      apiKey: 'test-key',
      owner: 'test-owner',
      repo: 'test-repo',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        issues: [
          {
            id: 1,
            localId: 'test-1',
            title: 'Bug Fix',
            status: 'open',
            type: 'bug',
            labels: ['bug', 'critical'],
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
          {
            id: 2,
            localId: 'test-2',
            title: 'Feature',
            status: 'open',
            type: 'feature',
            labels: ['feature'],
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      }),
    })

    const issues = await client.fetchIssues({ type: 'bug' })

    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('bug')
  })

  it('should compute reverse blocks relationships', async () => {
    const client = new TodoApiClient({
      baseUrl: 'https://test.api',
      apiKey: 'test-key',
      owner: 'test-owner',
      repo: 'test-repo',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        issues: [
          {
            id: 1,
            localId: 'test-1',
            title: 'Issue 1',
            status: 'open',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            dependsOn: [],
          },
          {
            id: 2,
            localId: 'test-2',
            title: 'Issue 2',
            status: 'open',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            dependsOn: [{ id: 1, localId: 'test-1' }],
          },
        ],
      }),
    })

    const issues = await client.fetchIssues()

    const issue1 = issues.find(i => i.id === 'test-1')
    const issue2 = issues.find(i => i.id === 'test-2')

    expect(issue2?.blockedBy).toContain('test-1')
    expect(issue1?.blocks).toContain('test-2')
  })

  it('should handle missing configuration gracefully', async () => {
    const client = new TodoApiClient({
      apiKey: 'test-key',
      // Missing owner/repo
    })

    await expect(client.fetchIssues()).rejects.toThrow('Repository owner and name must be configured')
  })

  it('should fetch single issue by ID', async () => {
    const client = new TodoApiClient({
      baseUrl: 'https://test.api',
      apiKey: 'test-key',
      owner: 'test-owner',
      repo: 'test-repo',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        issue: {
          id: 1,
          localId: 'test-1',
          title: 'Test Issue',
          status: 'open',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      }),
    })

    const issue = await client.fetchIssue('test-1')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.api/api/repos/test-owner/test-repo/issues/test-1',
      expect.any(Object)
    )

    expect(issue).toMatchObject({
      id: 'test-1',
      title: 'Test Issue',
    })
  })

  it('should return null for 404 on single issue fetch', async () => {
    const client = new TodoApiClient({
      baseUrl: 'https://test.api',
      apiKey: 'test-key',
      owner: 'test-owner',
      repo: 'test-repo',
    })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const issue = await client.fetchIssue('nonexistent')

    expect(issue).toBeNull()
  })
})

describe('loadApiIssues', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Clear env vars
    delete process.env.TODO_MDX_API_URL
    delete process.env.TODO_MDX_API_KEY
    delete process.env.TODO_MDX_OWNER
    delete process.env.TODO_MDX_REPO
  })

  it('should load issues with config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        issues: [
          {
            id: 1,
            localId: 'test-1',
            title: 'Test',
            status: 'open',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      }),
    })

    const issues = await loadApiIssues({
      baseUrl: 'https://test.api',
      apiKey: 'test-key',
      owner: 'test-owner',
      repo: 'test-repo',
    })

    expect(issues).toHaveLength(1)
  })

  it('should return empty array if not configured', async () => {
    const issues = await loadApiIssues()
    expect(issues).toEqual([])
  })

  it('should use environment variables', async () => {
    process.env.TODO_MDX_API_URL = 'https://env.api'
    process.env.TODO_MDX_API_KEY = 'env-key'
    process.env.TODO_MDX_OWNER = 'env-owner'
    process.env.TODO_MDX_REPO = 'env-repo'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ issues: [] }),
    })

    await loadApiIssues()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://env.api/api/repos/env-owner/env-repo/issues',
      expect.any(Object)
    )
  })

  it('should return empty array on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const issues = await loadApiIssues({
      owner: 'test-owner',
      repo: 'test-repo',
      apiKey: 'test-key',
    })

    expect(issues).toEqual([])
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load API issues:',
      expect.any(Error)
    )

    consoleError.mockRestore()
  })
})
