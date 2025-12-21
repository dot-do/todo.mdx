import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { GitHub } from '../native/github'
import type { Connection } from '../types'

// Mock the vault module
vi.mock('../../auth/vault', () => ({
  getGitHubToken: vi.fn()
}))

// Mock @octokit/rest
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    repos: {
      getBranch: vi.fn(),
      createRef: vi.fn()
    },
    pulls: {
      create: vi.fn(),
      list: vi.fn()
    },
    issues: {
      addComment: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      addLabels: vi.fn()
    },
    git: {
      createRef: vi.fn()
    }
  }))
}))

// Mock @octokit/auth-app
vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn().mockImplementation(() => {
    return vi.fn().mockResolvedValue({ token: 'mock-token' })
  })
}))

describe('GitHub Integration', () => {
  let mockConnection: Connection
  let mockEnv: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockConnection = {
      id: 'conn-123',
      user: 'user-456',
      app: 'GitHub',
      provider: 'native',
      externalId: 'ext-789',
      externalRef: {
        installationId: 12345
      },
      status: 'active',
      scopes: ['repo', 'issues']
    }

    mockEnv = {
      GITHUB_APP_ID: 'test-app-id',
      GITHUB_PRIVATE_KEY: 'test-private-key',
      WORKOS_API_KEY: 'test-workos-key'
    }
  })

  describe('Integration structure', () => {
    it('has correct name', () => {
      expect(GitHub.name).toBe('GitHub')
    })

    it('has tools array', () => {
      expect(GitHub.tools).toBeDefined()
      expect(Array.isArray(GitHub.tools)).toBe(true)
    })
  })

  describe('createBranch tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'createBranch')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.createBranch')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'createBranch')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        ref: 'feature-branch'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with sha', () => {
      const tool = GitHub.tools.find(t => t.name === 'createBranch')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        ref: 'feature-branch',
        sha: 'abc123'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects invalid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'createBranch')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo'
        // missing ref
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('createPullRequest tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'createPullRequest')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.createPullRequest')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'createPullRequest')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with optional body', () => {
      const tool = GitHub.tools.find(t => t.name === 'createPullRequest')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        title: 'Test PR',
        head: 'feature-branch',
        base: 'main',
        body: 'PR description'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const tool = GitHub.tools.find(t => t.name === 'createPullRequest')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        title: 'Test PR'
        // missing head and base
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('addComment tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'addComment')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.addComment')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'addComment')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        issue: 123,
        body: 'Comment text'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects non-number issue', () => {
      const tool = GitHub.tools.find(t => t.name === 'addComment')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        issue: '123', // should be number
        body: 'Comment text'
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('listIssues tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'listIssues')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.listIssues')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with repo only', () => {
      const tool = GitHub.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with state filter', () => {
      const tool = GitHub.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        state: 'open'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects invalid state', () => {
      const tool = GitHub.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        state: 'invalid'
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('updateIssue tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'updateIssue')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.updateIssue')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'updateIssue')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        issue: 123,
        title: 'Updated title',
        body: 'Updated body',
        state: 'closed'
      })
      expect(result?.success).toBe(true)
    })

    it('allows partial updates', () => {
      const tool = GitHub.tools.find(t => t.name === 'updateIssue')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        issue: 123,
        state: 'closed'
      })
      expect(result?.success).toBe(true)
    })
  })

  describe('addLabels tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'addLabels')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.addLabels')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'addLabels')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        issue: 123,
        labels: ['bug', 'priority-high']
      })
      expect(result?.success).toBe(true)
    })

    it('rejects non-array labels', () => {
      const tool = GitHub.tools.find(t => t.name === 'addLabels')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        issue: 123,
        labels: 'bug' // should be array
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('createLabel tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'createLabel')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.createLabel')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'createLabel')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        name: 'bug',
        color: 'ff0000',
        description: 'Bug reports'
      })
      expect(result?.success).toBe(true)
    })

    it('allows optional description', () => {
      const tool = GitHub.tools.find(t => t.name === 'createLabel')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        name: 'bug',
        color: 'ff0000'
      })
      expect(result?.success).toBe(true)
    })
  })

  describe('mergePullRequest tool', () => {
    it('exists and has correct structure', () => {
      const tool = GitHub.tools.find(t => t.name === 'mergePullRequest')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('github.mergePullRequest')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = GitHub.tools.find(t => t.name === 'mergePullRequest')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        pullNumber: 123
      })
      expect(result?.success).toBe(true)
    })

    it('validates with merge method', () => {
      const tool = GitHub.tools.find(t => t.name === 'mergePullRequest')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        pullNumber: 123,
        mergeMethod: 'squash'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects invalid merge method', () => {
      const tool = GitHub.tools.find(t => t.name === 'mergePullRequest')
      const result = tool?.schema.safeParse({
        repo: 'owner/repo',
        pullNumber: 123,
        mergeMethod: 'invalid'
      })
      expect(result?.success).toBe(false)
    })
  })
})
