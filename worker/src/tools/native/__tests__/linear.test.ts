import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { Linear } from '../linear'
import type { Connection } from '../../types'

// Mock @linear/sdk
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn().mockImplementation(() => ({
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    createComment: vi.fn(),
    issues: vi.fn(),
    createProject: vi.fn(),
    teams: vi.fn(),
    workflowStates: vi.fn(),
    issueLabels: vi.fn()
  }))
}))

describe('Linear Integration', () => {
  let mockConnection: Connection
  let mockEnv: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockConnection = {
      id: 'conn-123',
      user: 'user-456',
      app: 'Linear',
      provider: 'native',
      externalId: 'ext-789',
      externalRef: {
        accessToken: 'lin_api_mock_access_token_12345'
      },
      status: 'active',
      scopes: ['read', 'write']
    }

    mockEnv = {
      GITHUB_APP_ID: 'test-app-id',
      GITHUB_PRIVATE_KEY: 'test-private-key',
      WORKOS_API_KEY: 'test-workos-key'
    }
  })

  describe('Integration structure', () => {
    it('has correct name', () => {
      expect(Linear.name).toBe('Linear')
    })

    it('has tools array', () => {
      expect(Linear.tools).toBeDefined()
      expect(Array.isArray(Linear.tools)).toBe(true)
    })

    it('exports all expected tools', () => {
      const toolNames = Linear.tools.map(t => t.name)
      expect(toolNames).toContain('createIssue')
      expect(toolNames).toContain('updateIssue')
      expect(toolNames).toContain('addComment')
      expect(toolNames).toContain('listIssues')
      expect(toolNames).toContain('createProject')
      expect(toolNames).toContain('listTeams')
      expect(toolNames).toContain('listStates')
      expect(toolNames).toContain('listLabels')
    })
  })

  describe('createIssue tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.createIssue')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with minimal required params', () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      const result = tool?.schema.safeParse({
        title: 'Fix authentication bug',
        teamId: 'team-123'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with all optional params', () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      const result = tool?.schema.safeParse({
        title: 'Fix authentication bug',
        teamId: 'team-123',
        description: 'Users cannot login with OAuth',
        priority: 1,
        stateId: 'state-456',
        assigneeId: 'user-789',
        labelIds: ['label-1', 'label-2'],
        projectId: 'project-123',
        cycleId: 'cycle-456'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      const result = tool?.schema.safeParse({
        title: 'Fix bug'
        // missing teamId
      })
      expect(result?.success).toBe(false)
    })

    it('rejects invalid priority values', () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      const result = tool?.schema.safeParse({
        title: 'Fix bug',
        teamId: 'team-123',
        priority: 5 // max is 4
      })
      expect(result?.success).toBe(false)
    })

    it('accepts valid priority values', () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      for (let priority = 0; priority <= 4; priority++) {
        const result = tool?.schema.safeParse({
          title: 'Fix bug',
          teamId: 'team-123',
          priority
        })
        expect(result?.success).toBe(true)
      }
    })
  })

  describe('updateIssue tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'updateIssue')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.updateIssue')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with issue ID only', () => {
      const tool = Linear.tools.find(t => t.name === 'updateIssue')
      const result = tool?.schema.safeParse({
        issueId: 'issue-123'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with all optional params', () => {
      const tool = Linear.tools.find(t => t.name === 'updateIssue')
      const result = tool?.schema.safeParse({
        issueId: 'issue-123',
        title: 'Updated title',
        description: 'Updated description',
        priority: 2,
        stateId: 'state-456',
        assigneeId: 'user-789',
        labelIds: ['label-1'],
        projectId: 'project-123',
        cycleId: 'cycle-456'
      })
      expect(result?.success).toBe(true)
    })

    it('allows partial updates', () => {
      const tool = Linear.tools.find(t => t.name === 'updateIssue')
      const result = tool?.schema.safeParse({
        issueId: 'issue-123',
        stateId: 'state-done'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects missing issue ID', () => {
      const tool = Linear.tools.find(t => t.name === 'updateIssue')
      const result = tool?.schema.safeParse({
        title: 'Updated title'
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('addComment tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'addComment')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.addComment')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with valid params', () => {
      const tool = Linear.tools.find(t => t.name === 'addComment')
      const result = tool?.schema.safeParse({
        issueId: 'issue-123',
        body: 'This is a comment with **markdown**'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const tool = Linear.tools.find(t => t.name === 'addComment')
      const result = tool?.schema.safeParse({
        issueId: 'issue-123'
        // missing body
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('listIssues tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'listIssues')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.listIssues')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with team ID only', () => {
      const tool = Linear.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        teamId: 'team-123'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with all filters', () => {
      const tool = Linear.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        teamId: 'team-123',
        stateId: 'state-456',
        assigneeId: 'user-789',
        projectId: 'project-123',
        cycleId: 'cycle-456',
        labelId: 'label-123',
        first: 100
      })
      expect(result?.success).toBe(true)
    })

    it('uses default first value', () => {
      const tool = Linear.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        teamId: 'team-123'
      })
      expect(result?.success).toBe(true)
      if (result?.success) {
        expect(result.data.first).toBe(50)
      }
    })

    it('rejects missing team ID', () => {
      const tool = Linear.tools.find(t => t.name === 'listIssues')
      const result = tool?.schema.safeParse({
        stateId: 'state-456'
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('createProject tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.createProject')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with required params', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      const result = tool?.schema.safeParse({
        name: 'Q1 2025 Roadmap',
        teamIds: ['team-123', 'team-456']
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with all optional params', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      const result = tool?.schema.safeParse({
        name: 'Q1 2025 Roadmap',
        teamIds: ['team-123'],
        description: 'Project description',
        state: 'started',
        targetDate: '2025-03-31T00:00:00Z',
        leadId: 'user-123'
      })
      expect(result?.success).toBe(true)
    })

    it('validates project states', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      const validStates = ['planned', 'started', 'paused', 'completed', 'canceled']

      for (const state of validStates) {
        const result = tool?.schema.safeParse({
          name: 'Test Project',
          teamIds: ['team-123'],
          state
        })
        expect(result?.success).toBe(true)
      }
    })

    it('rejects invalid project state', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      const result = tool?.schema.safeParse({
        name: 'Test Project',
        teamIds: ['team-123'],
        state: 'invalid'
      })
      expect(result?.success).toBe(false)
    })

    it('rejects missing required fields', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      const result = tool?.schema.safeParse({
        name: 'Test Project'
        // missing teamIds
      })
      expect(result?.success).toBe(false)
    })

    it('rejects empty teamIds array', () => {
      const tool = Linear.tools.find(t => t.name === 'createProject')
      const result = tool?.schema.safeParse({
        name: 'Test Project',
        teamIds: []
      })
      expect(result?.success).toBe(false)
    })
  })

  describe('listTeams tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'listTeams')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.listTeams')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with no params', () => {
      const tool = Linear.tools.find(t => t.name === 'listTeams')
      const result = tool?.schema.safeParse({})
      expect(result?.success).toBe(true)
    })

    it('validates schema with first param', () => {
      const tool = Linear.tools.find(t => t.name === 'listTeams')
      const result = tool?.schema.safeParse({
        first: 100
      })
      expect(result?.success).toBe(true)
    })

    it('uses default first value', () => {
      const tool = Linear.tools.find(t => t.name === 'listTeams')
      const result = tool?.schema.safeParse({})
      expect(result?.success).toBe(true)
      if (result?.success) {
        expect(result.data.first).toBe(50)
      }
    })
  })

  describe('listStates tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'listStates')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.listStates')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with team ID', () => {
      const tool = Linear.tools.find(t => t.name === 'listStates')
      const result = tool?.schema.safeParse({
        teamId: 'team-123'
      })
      expect(result?.success).toBe(true)
    })

    it('rejects missing team ID', () => {
      const tool = Linear.tools.find(t => t.name === 'listStates')
      const result = tool?.schema.safeParse({})
      expect(result?.success).toBe(false)
    })
  })

  describe('listLabels tool', () => {
    it('exists and has correct structure', () => {
      const tool = Linear.tools.find(t => t.name === 'listLabels')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('linear.listLabels')
      expect(tool?.schema).toBeDefined()
      expect(typeof tool?.execute).toBe('function')
    })

    it('validates schema with no params', () => {
      const tool = Linear.tools.find(t => t.name === 'listLabels')
      const result = tool?.schema.safeParse({})
      expect(result?.success).toBe(true)
    })

    it('validates schema with team ID filter', () => {
      const tool = Linear.tools.find(t => t.name === 'listLabels')
      const result = tool?.schema.safeParse({
        teamId: 'team-123'
      })
      expect(result?.success).toBe(true)
    })

    it('validates schema with first param', () => {
      const tool = Linear.tools.find(t => t.name === 'listLabels')
      const result = tool?.schema.safeParse({
        first: 100
      })
      expect(result?.success).toBe(true)
    })

    it('uses default first value', () => {
      const tool = Linear.tools.find(t => t.name === 'listLabels')
      const result = tool?.schema.safeParse({})
      expect(result?.success).toBe(true)
      if (result?.success) {
        expect(result.data.first).toBe(50)
      }
    })
  })

  describe('Connection validation', () => {
    it('should require accessToken in externalRef', async () => {
      const tool = Linear.tools.find(t => t.name === 'createIssue')
      const invalidConnection = {
        ...mockConnection,
        externalRef: {} // missing accessToken
      }

      await expect(
        tool?.execute(
          { title: 'Test', teamId: 'team-123' },
          invalidConnection,
          mockEnv
        )
      ).rejects.toThrow('Linear connection missing accessToken')
    })
  })

  describe('Tool naming consistency', () => {
    it('all tools follow camelCase.verbObject naming', () => {
      Linear.tools.forEach(tool => {
        expect(tool.fullName).toMatch(/^linear\.[a-z][a-zA-Z]*$/)
      })
    })

    it('fullName matches pattern linear.{name}', () => {
      Linear.tools.forEach(tool => {
        expect(tool.fullName).toBe(`linear.${tool.name}`)
      })
    })
  })

  describe('Schema descriptions', () => {
    it('all required params have descriptions', () => {
      Linear.tools.forEach(tool => {
        const schema = tool.schema as z.ZodObject<any>
        const shape = schema.shape

        Object.keys(shape).forEach(key => {
          const field = shape[key]
          if (!field.isOptional()) {
            expect(field.description).toBeDefined()
          }
        })
      })
    })
  })
})
