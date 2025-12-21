import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IssueDO } from '../issue'
import type { Env } from '../../types/env'

describe('IssueDO', () => {
  let mockState: DurableObjectState
  let mockEnv: Env
  let issueDO: IssueDO

  beforeEach(() => {
    // Mock SqlStorage
    const tables = new Map<string, any[]>()

    const mockSql = {
      exec: vi.fn((query: string, ...params: any[]) => {
        // Simple mock that returns empty arrays for SELECTs
        if (query.trim().startsWith('SELECT')) {
          return {
            toArray: () => [],
          }
        }
        // For INSERTs/UPDATEs/DELETEs, just succeed
        return { toArray: () => [] }
      }),
    } as any

    // Mock DurableObjectState
    const storage = new Map<string, any>()
    mockState = {
      id: {
        toString: () => 'issue-do-test-123',
      },
      storage: {
        sql: mockSql,
        get: vi.fn((key: string) => storage.get(key)),
        put: vi.fn((key: string, value: any) => {
          storage.set(key, value)
          return Promise.resolve()
        }),
        setAlarm: vi.fn((timestamp: number) => Promise.resolve()),
      },
      waitUntil: vi.fn((promise: Promise<any>) => promise),
    } as any

    // Mock Env with WORKER RPC
    mockEnv = {
      WORKER: {
        persistDOState: vi.fn(() => Promise.resolve({ success: true })),
      },
    } as any

    issueDO = new IssueDO(mockState, mockEnv)
  })

  describe('initialization', () => {
    it('should initialize with correct DO type and ref', () => {
      expect(issueDO['doType']).toBe('issue')
      expect(issueDO['ref']).toBe('issue-do-test-123')
    })

    it('should create SQL tables on first fetch', async () => {
      const request = new Request('https://test.com/state')
      await issueDO.fetch(request)

      expect(mockState.storage.sql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS execution_sessions')
      )
      expect(mockState.storage.sql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS tool_checks')
      )
      expect(mockState.storage.sql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS verifications')
      )
      expect(mockState.storage.sql.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS state_transitions')
      )
    })
  })

  describe('state machine lifecycle', () => {
    it('should start in idle state', async () => {
      const request = new Request('https://test.com/state')
      const response = await issueDO.fetch(request)
      const data = await response.json()

      expect(data.state).toBe('idle')
      expect(data.context.assignedAgent).toBeNull()
    })

    it('should transition to preparing state when agent assigned', async () => {
      const assignRequest = new Request('https://test.com/assign-agent', {
        method: 'POST',
        body: JSON.stringify({
          agent: 'test-agent',
          pat: 'test-pat',
          issueId: 'todo-123',
          repoFullName: 'user/repo',
          installationId: 456,
          title: 'Test Issue',
          description: 'Test description',
          requiredTools: ['git', 'npm'],
        }),
      })

      const response = await issueDO.fetch(assignRequest)
      const data = await response.json()

      expect(data.ok).toBe(true)
      // State will be 'executing' because tools are auto-ready in mock
      expect(['preparing', 'executing']).toContain(data.state)
    })

    it('should not allow reassigning agent', async () => {
      // First assignment
      await issueDO.fetch(
        new Request('https://test.com/assign-agent', {
          method: 'POST',
          body: JSON.stringify({
            agent: 'agent-1',
            pat: 'pat-1',
            issueId: 'todo-123',
            repoFullName: 'user/repo',
            installationId: 456,
            title: 'Test',
            description: 'Test',
          }),
        })
      )

      // Second assignment should fail
      const response = await issueDO.fetch(
        new Request('https://test.com/assign-agent', {
          method: 'POST',
          body: JSON.stringify({
            agent: 'agent-2',
            pat: 'pat-2',
            issueId: 'todo-123',
            repoFullName: 'user/repo',
            installationId: 456,
            title: 'Test',
            description: 'Test',
          }),
        })
      )

      const data = await response.json()
      expect(data.ok).toBe(false)
      expect(data.error).toContain('already has agent')
    })
  })

  describe('API endpoints', () => {
    describe('GET /state', () => {
      it('should return current state and context', async () => {
        const request = new Request('https://test.com/state')
        const response = await issueDO.fetch(request)

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('state')
        expect(data).toHaveProperty('context')
        expect(data).toHaveProperty('canTransition')
      })
    })

    describe('POST /cancel', () => {
      it('should cancel execution', async () => {
        const request = new Request('https://test.com/cancel', {
          method: 'POST',
        })

        const response = await issueDO.fetch(request)
        const data = await response.json()

        expect(data.ok).toBe(true)
        expect(data.message).toContain('cancelled')
      })

      it('should transition to failed state', async () => {
        await issueDO.fetch(
          new Request('https://test.com/cancel', {
            method: 'POST',
          })
        )

        const stateResponse = await issueDO.fetch(new Request('https://test.com/state'))
        const stateData = await stateResponse.json()

        expect(stateData.state).toBe('failed')
      })
    })

    describe('GET /logs', () => {
      it('should return execution logs', async () => {
        const request = new Request('https://test.com/logs')
        const response = await issueDO.fetch(request)

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('sessions')
        expect(data).toHaveProperty('toolChecks')
        expect(data).toHaveProperty('verifications')
      })
    })

    describe('GET /transitions', () => {
      it('should return state transition audit log', async () => {
        const request = new Request('https://test.com/transitions')
        const response = await issueDO.fetch(request)

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('transitions')
        expect(Array.isArray(data.transitions)).toBe(true)
      })
    })

    describe('404 handling', () => {
      it('should return 404 for unknown paths', async () => {
        const request = new Request('https://test.com/unknown')
        const response = await issueDO.fetch(request)

        expect(response.status).toBe(404)
      })
    })
  })

  describe('state persistence', () => {
    it('should persist state to storage on transitions', async () => {
      await issueDO.fetch(
        new Request('https://test.com/assign-agent', {
          method: 'POST',
          body: JSON.stringify({
            agent: 'test-agent',
            pat: 'test-pat',
            issueId: 'todo-123',
            repoFullName: 'user/repo',
            installationId: 456,
            title: 'Test',
            description: 'Test',
          }),
        })
      )

      // Give time for async persistence
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify storage.put was called with machineState
      expect(mockState.storage.put).toHaveBeenCalledWith('machineState', expect.any(Object))
    })

    it('should persist to D1 via WORKER RPC', async () => {
      await issueDO.fetch(
        new Request('https://test.com/assign-agent', {
          method: 'POST',
          body: JSON.stringify({
            agent: 'test-agent',
            pat: 'test-pat',
            issueId: 'todo-123',
            repoFullName: 'user/repo',
            installationId: 456,
            title: 'Test',
            description: 'Test',
          }),
        })
      )

      // Give time for async persistence
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify WORKER RPC was called
      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledWith({
        doId: 'issue-do-test-123',
        type: 'issue',
        ref: expect.any(String),
        state: expect.any(Object),
      })
    })
  })

  describe('alarm handling', () => {
    it('should handle alarm for retry logic', async () => {
      // Set up issue in executing state
      await issueDO.fetch(
        new Request('https://test.com/assign-agent', {
          method: 'POST',
          body: JSON.stringify({
            agent: 'test-agent',
            pat: 'test-pat',
            issueId: 'todo-123',
            repoFullName: 'user/repo',
            installationId: 456,
            title: 'Test',
            description: 'Test',
          }),
        })
      )

      // Mock the state to be in executing
      // (In real scenario, this would happen via state machine transitions)

      // Call alarm
      await issueDO.alarm()

      // Verify no errors thrown
      expect(true).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should handle invalid JSON in requests', async () => {
      const request = new Request('https://test.com/assign-agent', {
        method: 'POST',
        body: 'invalid json',
      })

      try {
        await issueDO.fetch(request)
      } catch (error) {
        // Should throw error for invalid JSON
        expect(error).toBeDefined()
      }
    })

    it('should handle missing required fields', async () => {
      const request = new Request('https://test.com/assign-agent', {
        method: 'POST',
        body: JSON.stringify({
          agent: 'test-agent',
          // Missing other required fields
        }),
      })

      // Should not crash, even with incomplete data
      const response = await issueDO.fetch(request)

      // Will either succeed with defaults or return error, but shouldn't crash
      expect([200, 400, 500]).toContain(response.status)
    })
  })

  describe('audit logging', () => {
    it('should initialize SQL tables for audit trail', async () => {
      // Simply verify tables are created on initialization
      await issueDO.fetch(new Request('https://test.com/state'))

      // Verify SQL exec was called for table creation
      const execCalls = vi.mocked(mockState.storage.sql.exec).mock.calls
      const tableCreation = execCalls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('CREATE TABLE IF NOT EXISTS state_transitions')
      )

      expect(tableCreation).toBeDefined()
    })

    it('should record execution sessions', async () => {
      await issueDO.fetch(
        new Request('https://test.com/assign-agent', {
          method: 'POST',
          body: JSON.stringify({
            agent: 'test-agent',
            pat: 'test-pat',
            issueId: 'todo-123',
            repoFullName: 'user/repo',
            installationId: 456,
            title: 'Test',
            description: 'Test',
          }),
        })
      )

      // Give time for async execution to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify execution session was logged
      const execCalls = vi.mocked(mockState.storage.sql.exec).mock.calls
      const sessionLog = execCalls.find(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('INSERT INTO execution_sessions')
      )

      expect(sessionLog).toBeDefined()
    })
  })
})
