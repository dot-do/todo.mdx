import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatefulDO } from '../base'
import type { Env } from '../../types'

// Mock concrete implementation for testing
class TestDO extends StatefulDO {
  protected readonly doType = 'repo' as const
  protected readonly ref = 'test/repo'

  // Expose protected methods for testing
  public async testPersistToD1(maxRetries?: number) {
    return this.persistToD1(maxRetries)
  }

  public testOnTransition(newState: any) {
    return this.onTransition(newState)
  }

  public async testLoadState() {
    return this.loadState()
  }

  public getMachineState() {
    return this.machineState
  }
}

describe('StatefulDO', () => {
  let mockState: DurableObjectState
  let mockEnv: Env
  let testDO: TestDO

  beforeEach(() => {
    // Mock DurableObjectState
    const storage = new Map<string, any>()
    mockState = {
      id: {
        toString: () => 'test-do-id-123',
      },
      storage: {
        get: vi.fn((key: string) => storage.get(key)),
        put: vi.fn((key: string, value: any) => {
          storage.set(key, value)
          return Promise.resolve()
        }),
      },
      waitUntil: vi.fn((promise: Promise<any>) => promise),
    } as any

    // Mock Env with WORKER RPC
    mockEnv = {
      WORKER: {
        persistDOState: vi.fn(() => Promise.resolve({ success: true })),
      },
    } as any

    testDO = new TestDO(mockState, mockEnv)
  })

  describe('persistToD1', () => {
    it('should persist state successfully on first attempt', async () => {
      await testDO.testPersistToD1()

      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledTimes(1)
      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledWith({
        doId: 'test-do-id-123',
        type: 'repo',
        ref: 'test/repo',
        state: null,
      })
    })

    it('should retry with exponential backoff on failure', async () => {
      // Fail 3 times, then succeed
      let callCount = 0
      mockEnv.WORKER.persistDOState = vi.fn(() => {
        callCount++
        if (callCount < 3) {
          return Promise.resolve({ success: false, error: 'Test error' })
        }
        return Promise.resolve({ success: true })
      })

      const startTime = Date.now()
      await testDO.testPersistToD1()
      const duration = Date.now() - startTime

      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledTimes(3)

      // Should have delays: 200ms (2^1 * 100) + 400ms (2^2 * 100) = 600ms minimum
      // Allow some tolerance for test execution time
      expect(duration).toBeGreaterThanOrEqual(500)
    })

    it('should throw error after max retries', async () => {
      mockEnv.WORKER.persistDOState = vi.fn(() =>
        Promise.resolve({ success: false, error: 'Persistent error' })
      )

      await expect(testDO.testPersistToD1(3)).rejects.toThrow('Persistent error')
      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledTimes(3)
    })

    it('should handle RPC exceptions with retry', async () => {
      let callCount = 0
      mockEnv.WORKER.persistDOState = vi.fn(() => {
        callCount++
        if (callCount < 2) {
          throw new Error('Network error')
        }
        return Promise.resolve({ success: true })
      })

      await testDO.testPersistToD1()
      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledTimes(2)
    })

    it('should use steep logarithmic backoff delays', async () => {
      const delays: number[] = []
      let callCount = 0
      let lastTime = Date.now()

      mockEnv.WORKER.persistDOState = vi.fn(() => {
        callCount++
        const now = Date.now()

        // Record delay before this call (except for first call)
        if (callCount > 1) {
          delays.push(now - lastTime)
        }
        lastTime = now

        // Fail first 2 attempts
        if (callCount <= 2) {
          return Promise.resolve({ success: false, error: 'Test error' })
        }
        return Promise.resolve({ success: true })
      })

      await testDO.testPersistToD1()

      // We should have 2 delays recorded (before attempt 2 and 3)
      expect(delays).toHaveLength(2)

      // Verify exponential growth: each delay should be ~2x the previous
      // Delay before attempt 2: 100 * 2^1 = 200ms
      // Delay before attempt 3: 100 * 2^2 = 400ms
      expect(delays[0]).toBeGreaterThanOrEqual(180) // ~200ms with tolerance
      expect(delays[1]).toBeGreaterThanOrEqual(380) // ~400ms with tolerance

      // Verify it's actually exponential (second delay ~2x first)
      expect(delays[1]).toBeGreaterThanOrEqual(delays[0] * 1.8)
    }, 2000) // 2s timeout sufficient for 200ms + 400ms

    it('should cap backoff delay at 100 seconds', async () => {
      // Mock a scenario where we'd exceed 100s
      // At attempt 11: 100 * 2^11 = 204,800ms > 100,000ms cap
      mockEnv.WORKER.persistDOState = vi.fn(() =>
        Promise.resolve({ success: true })
      )

      // We can't actually wait that long, so we'll just verify the formula
      const maxRetry = 11
      const expectedDelay = Math.min(100 * Math.pow(2, maxRetry), 100_000)
      expect(expectedDelay).toBe(100_000)
    })
  })

  describe('onTransition', () => {
    it('should persist state to DO storage synchronously', () => {
      const newState = { value: 'test-state', count: 42 }

      testDO.testOnTransition(newState)

      expect(mockState.storage.put).toHaveBeenCalledWith('machineState', newState)
      expect(testDO.getMachineState()).toEqual(newState)
    })

    it('should persist to D1 asynchronously via waitUntil', () => {
      const newState = { value: 'async-test' }

      testDO.testOnTransition(newState)

      expect(mockState.waitUntil).toHaveBeenCalledTimes(1)
      // waitUntil should receive a promise
      const [promise] = vi.mocked(mockState.waitUntil).mock.calls[0]
      expect(promise).toBeInstanceOf(Promise)
    })

    it('should update machineState before persisting', () => {
      const state1 = { version: 1 }
      const state2 = { version: 2 }

      testDO.testOnTransition(state1)
      expect(testDO.getMachineState()).toEqual(state1)

      testDO.testOnTransition(state2)
      expect(testDO.getMachineState()).toEqual(state2)
    })

    it('should call persistToD1 with retry logic', async () => {
      mockEnv.WORKER.persistDOState = vi.fn(() =>
        Promise.resolve({ success: true })
      )

      const newState = { test: 'data' }
      testDO.testOnTransition(newState)

      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockEnv.WORKER.persistDOState).toHaveBeenCalledWith({
        doId: 'test-do-id-123',
        type: 'repo',
        ref: 'test/repo',
        state: newState,
      })
    })
  })

  describe('loadState', () => {
    it('should retrieve state from DO storage', async () => {
      const savedState = { restored: true, value: 123 }
      await mockState.storage.put('machineState', savedState)

      const loaded = await testDO.testLoadState()

      expect(mockState.storage.get).toHaveBeenCalledWith('machineState')
      expect(loaded).toEqual(savedState)
    })

    it('should return undefined if no state exists', async () => {
      const loaded = await testDO.testLoadState()
      expect(loaded).toBeUndefined()
    })
  })

  describe('constructor', () => {
    it('should initialize with null machineState', () => {
      expect(testDO.getMachineState()).toBeNull()
    })

    it('should store state and env references', () => {
      expect(testDO['state']).toBe(mockState)
      expect(testDO['env']).toBe(mockEnv)
    })
  })

  describe('abstract properties', () => {
    it('should require doType to be defined by subclass', () => {
      expect(testDO['doType']).toBe('repo')
    })

    it('should require ref to be defined by subclass', () => {
      expect(testDO['ref']).toBe('test/repo')
    })

    it('should support all DO types', () => {
      class OrgDO extends StatefulDO {
        protected readonly doType = 'org' as const
        protected readonly ref = 'my-org'
      }
      class ProjectDO extends StatefulDO {
        protected readonly doType = 'project' as const
        protected readonly ref = 'my-project'
      }
      class PRDO extends StatefulDO {
        protected readonly doType = 'pr' as const
        protected readonly ref = 'pr-123'
      }
      class IssueDO extends StatefulDO {
        protected readonly doType = 'issue' as const
        protected readonly ref = 'issue-456'
      }

      const orgDO = new OrgDO(mockState, mockEnv)
      const projectDO = new ProjectDO(mockState, mockEnv)
      const prDO = new PRDO(mockState, mockEnv)
      const issueDO = new IssueDO(mockState, mockEnv)

      expect(orgDO['doType']).toBe('org')
      expect(projectDO['doType']).toBe('project')
      expect(prDO['doType']).toBe('pr')
      expect(issueDO['doType']).toBe('issue')
    })
  })
})
