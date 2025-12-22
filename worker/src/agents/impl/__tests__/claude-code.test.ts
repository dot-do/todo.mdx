import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeCodeAgent, SandboxExecuteOptions, ClaudeCodeDoOptions } from '../claude-code'
import { AgentDef } from '../../base'
import type { Env } from '../../../types/env'
import type { TestResult } from '../../../sandbox/claude'

describe('ClaudeCodeAgent', () => {
  const testDef: AgentDef = {
    id: 'test-claude-code',
    name: 'Test Claude Code Agent',
    description: 'Test sandbox agent',
    tools: ['*'],
    tier: 'sandbox',
    model: 'best',
    framework: 'claude-code',
    instructions: 'Test instructions',
  }

  /**
   * Create a mock environment with Sandbox DO
   */
  function createMockEnv(mockFetch: (req: Request) => Promise<Response>): Partial<Env> {
    const mockSandboxStub = {
      fetch: mockFetch,
    }

    return {
      Sandbox: {
        idFromName: vi.fn().mockReturnValue({ name: 'test-session' }),
        get: vi.fn().mockReturnValue(mockSandboxStub),
      } as any,
    }
  }

  const testSandboxOptions: SandboxExecuteOptions = {
    repo: 'test-org/test-repo',
    branch: 'main',
    installationId: 12345,
  }

  it('should create an instance', () => {
    const agent = new ClaudeCodeAgent(testDef)
    expect(agent).toBeDefined()
    expect(agent.def).toEqual(testDef)
  })

  it('should have do method', () => {
    const agent = new ClaudeCodeAgent(testDef)
    expect(typeof agent.do).toBe('function')
  })

  it('should have ask method', () => {
    const agent = new ClaudeCodeAgent(testDef)
    expect(typeof agent.ask).toBe('function')
  })

  describe('do() validation', () => {
    it('should return error when env is not provided', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const result = await agent.do('test task')

      expect(result.success).toBe(false)
      expect(result.output).toContain('Environment bindings not provided')
    })

    it('should return error when repo is not specified', async () => {
      const mockEnv = createMockEnv(async () => new Response())
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, {})
      const result = await agent.do('test task')

      expect(result.success).toBe(false)
      expect(result.output).toContain('Repository not specified')
    })
  })

  describe('do() sandbox execution', () => {
    it('should call sandbox /execute endpoint for non-streaming', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: 'mock diff',
          summary: 'Task completed successfully',
          filesChanged: ['src/test.ts'],
          exitCode: 0,
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('echo "hello"', { stream: false })

      expect(result.success).toBe(true)
      expect(result.output).toBe('Task completed successfully')
      expect(result.artifacts).toHaveLength(1)
      expect(result.artifacts?.[0]).toEqual({ type: 'file', ref: 'src/test.ts' })

      expect(mockFetch).toHaveBeenCalledOnce()
      const request = mockFetch.mock.calls[0][0] as Request
      expect(request.url).toContain('/execute')
    })

    it('should include branch and commit artifacts when push succeeds', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: 'mock diff',
          summary: 'Changes pushed',
          filesChanged: ['src/feature.ts'],
          exitCode: 0,
          pushedToBranch: 'feature/test',
          commitSha: 'abc123',
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, {
        ...testSandboxOptions,
        push: true,
        targetBranch: 'feature/test',
      })
      const result = await agent.do('implement feature', { stream: false })

      expect(result.success).toBe(true)
      expect(result.artifacts).toHaveLength(3)
      expect(result.artifacts).toContainEqual({ type: 'file', ref: 'src/feature.ts' })
      expect(result.artifacts).toContainEqual({
        type: 'branch',
        ref: 'feature/test',
        url: 'https://github.com/test-org/test-repo/tree/feature/test',
      })
      expect(result.artifacts).toContainEqual({
        type: 'commit',
        ref: 'abc123',
        url: 'https://github.com/test-org/test-repo/commit/abc123',
      })
    })

    it('should handle sandbox execution errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({ error: 'Failed to clone repository' }, { status: 500 })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('test task', { stream: false })

      expect(result.success).toBe(false)
      expect(result.output).toContain('Sandbox execution failed')
    })

    it('should handle non-zero exit codes', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: '',
          summary: 'Claude Code failed',
          filesChanged: [],
          exitCode: 1,
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('invalid task', { stream: false })

      expect(result.success).toBe(false)
    })
  })

  describe('events', () => {
    it('should emit thinking event during do()', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: '',
          summary: 'Done',
          filesChanged: [],
          exitCode: 0,
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const events: any[] = []

      await agent.do('test task', {
        stream: false,
        onEvent: (event) => events.push(event),
      })

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe('thinking')
      expect(events[0].content).toContain('Preparing sandbox')
    })

    it('should emit error event when validation fails', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const events: any[] = []

      await agent.do('test task', {
        onEvent: (event) => events.push(event),
      })

      const errorEvents = events.filter((e) => e.type === 'error')
      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0].error).toContain('Environment bindings')
    })

    it('should include events array in result', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: '',
          summary: 'Done',
          filesChanged: [],
          exitCode: 0,
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('test task', { stream: false })

      expect(result.events).toBeDefined()
      expect(Array.isArray(result.events)).toBe(true)
      expect(result.events.length).toBeGreaterThan(0)
    })
  })

  describe('ask()', () => {
    it('should return suggestion for ask()', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const result = await agent.ask('test question')

      expect(result).toBeDefined()
      expect(result.answer).toContain('Claude Code sandbox')
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should emit event during ask()', async () => {
      const agent = new ClaudeCodeAgent(testDef)
      const events: any[] = []

      await agent.ask('test question', {
        onEvent: (event) => events.push(event),
      })

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe('message')
    })
  })

  describe('streaming execution', () => {
    it('should call sandbox /stream endpoint when streaming with onEvent', async () => {
      // Create a mock SSE response
      const sseData = [
        'event: stdout\ndata: Cloning repository...\n\n',
        'event: stdout\ndata: Running Claude Code...\n\n',
        'event: complete\ndata: {"diff":"test diff","filesChanged":["test.ts"]}\n\n',
      ].join('')

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(sseData, {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const events: any[] = []

      const result = await agent.do('test task', {
        stream: true,
        onEvent: (event) => events.push(event),
      })

      expect(mockFetch).toHaveBeenCalledOnce()
      const request = mockFetch.mock.calls[0][0] as Request
      expect(request.url).toContain('/stream')

      // Should have received message events from stream
      const messageEvents = events.filter((e) => e.type === 'message')
      expect(messageEvents.length).toBeGreaterThan(0)
    })

    it('should fall back to /execute when stream=false', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: '',
          summary: 'Done',
          filesChanged: [],
          exitCode: 0,
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)

      await agent.do('test task', { stream: false })

      const request = mockFetch.mock.calls[0][0] as Request
      expect(request.url).toContain('/execute')
    })
  })

  describe('test runner integration', () => {
    it('should call /test endpoint when runTests is true', async () => {
      const testResult: TestResult = {
        passed: 10,
        failed: 0,
        skipped: 2,
        duration: 1234,
        failedTests: [],
      }

      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === '/execute') {
          return Response.json({
            diff: 'mock diff',
            summary: 'Task completed',
            filesChanged: ['src/test.ts'],
            exitCode: 0,
          })
        }
        if (url.pathname === '/test') {
          return Response.json(testResult)
        }
        return new Response('Not found', { status: 404 })
      })

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('implement feature', {
        stream: false,
        runTests: true,
      } as ClaudeCodeDoOptions)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify /test was called
      const testRequest = mockFetch.mock.calls.find(
        (call) => new URL((call[0] as Request).url).pathname === '/test'
      )
      expect(testRequest).toBeDefined()

      // Verify test-results artifact was added
      const testArtifact = result.artifacts?.find((a) => a.type === 'test-results')
      expect(testArtifact).toBeDefined()
      expect(testArtifact?.ref).toBe('10 passed')
      expect(testArtifact?.data).toEqual(testResult)
    })

    it('should include test failure details in artifact', async () => {
      const testResult: TestResult = {
        passed: 8,
        failed: 2,
        skipped: 0,
        duration: 2345,
        failedTests: [
          {
            name: 'should handle errors',
            file: 'src/handler.test.ts',
            error: 'Expected 200 but got 500',
            stack: 'at handler.test.ts:42',
          },
          {
            name: 'should validate input',
            file: 'src/validator.test.ts',
            error: 'Validation failed',
          },
        ],
      }

      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === '/execute') {
          return Response.json({
            diff: 'mock diff',
            summary: 'Task completed',
            filesChanged: ['src/handler.ts'],
            exitCode: 0,
          })
        }
        if (url.pathname === '/test') {
          return Response.json(testResult)
        }
        return new Response('Not found', { status: 404 })
      })

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('fix bug', {
        stream: false,
        runTests: true,
      } as ClaudeCodeDoOptions)

      // Tests failed, so overall success should be false
      expect(result.success).toBe(false)

      const testArtifact = result.artifacts?.find((a) => a.type === 'test-results')
      expect(testArtifact).toBeDefined()
      expect(testArtifact?.ref).toBe('2 failed, 8 passed')
      expect((testArtifact?.data as TestResult).failedTests).toHaveLength(2)
    })

    it('should handle test execution errors gracefully', async () => {
      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === '/execute') {
          return Response.json({
            diff: 'mock diff',
            summary: 'Task completed',
            filesChanged: ['src/test.ts'],
            exitCode: 0,
          })
        }
        if (url.pathname === '/test') {
          return Response.json({ error: 'pnpm not found' }, { status: 500 })
        }
        return new Response('Not found', { status: 404 })
      })

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const events: any[] = []

      const result = await agent.do('implement feature', {
        stream: false,
        runTests: true,
        onEvent: (e) => events.push(e),
      } as ClaudeCodeDoOptions)

      // When tests are requested but error, overall success is false
      // (we couldn't verify tests passed)
      expect(result.success).toBe(false)

      // Should have error event for test failure
      const errorEvents = events.filter((e) => e.type === 'error')
      expect(errorEvents.length).toBeGreaterThan(0)
      expect(errorEvents[0].error).toContain('Test execution failed')

      // Should have test-results artifact with error
      const testArtifact = result.artifacts?.find((a) => a.type === 'test-results')
      expect(testArtifact).toBeDefined()
      expect(testArtifact?.ref).toBe('error')
      expect((testArtifact?.data as { error: string }).error).toContain('pnpm not found')
    })

    it('should not run tests when runTests is false', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        Response.json({
          diff: 'mock diff',
          summary: 'Task completed',
          filesChanged: ['src/test.ts'],
          exitCode: 0,
        })
      )

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const result = await agent.do('implement feature', {
        stream: false,
        runTests: false,
      } as ClaudeCodeDoOptions)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Verify no test-results artifact
      const testArtifact = result.artifacts?.find((a) => a.type === 'test-results')
      expect(testArtifact).toBeUndefined()
    })

    it('should pass testOptions to /test endpoint', async () => {
      const testResult: TestResult = {
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 500,
        failedTests: [],
      }

      let capturedTestBody: any

      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === '/execute') {
          return Response.json({
            diff: 'mock diff',
            summary: 'Task completed',
            filesChanged: [],
            exitCode: 0,
          })
        }
        if (url.pathname === '/test') {
          capturedTestBody = await req.json()
          return Response.json(testResult)
        }
        return new Response('Not found', { status: 404 })
      })

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)

      await agent.do('implement feature', {
        stream: false,
        runTests: true,
        testOptions: {
          filter: 'integration',
          timeout: 60000,
          cwd: '/workspace/packages/core',
        },
      } as ClaudeCodeDoOptions)

      expect(capturedTestBody).toEqual({
        filter: 'integration',
        timeout: 60000,
        cwd: '/workspace/packages/core',
      })
    })

    it('should emit test-related events', async () => {
      const testResult: TestResult = {
        passed: 10,
        failed: 1,
        skipped: 3,
        duration: 4567,
        failedTests: [
          {
            name: 'test case',
            file: 'test.ts',
            error: 'failed',
          },
        ],
      }

      const mockFetch = vi.fn().mockImplementation(async (req: Request) => {
        const url = new URL(req.url)
        if (url.pathname === '/execute') {
          return Response.json({
            diff: 'mock diff',
            summary: 'Done',
            filesChanged: [],
            exitCode: 0,
          })
        }
        if (url.pathname === '/test') {
          return Response.json(testResult)
        }
        return new Response('Not found', { status: 404 })
      })

      const mockEnv = createMockEnv(mockFetch)
      const agent = new ClaudeCodeAgent(testDef, mockEnv as Env, testSandboxOptions)
      const events: any[] = []

      await agent.do('fix bug', {
        stream: false,
        runTests: true,
        onEvent: (e) => events.push(e),
      } as ClaudeCodeDoOptions)

      // Should have 'Running tests...' thinking event
      const thinkingEvents = events.filter((e) => e.type === 'thinking')
      const testThinkingEvent = thinkingEvents.find((e) => e.content.includes('Running tests'))
      expect(testThinkingEvent).toBeDefined()

      // Should have test result message event
      const messageEvents = events.filter((e) => e.type === 'message')
      const testResultEvent = messageEvents.find((e) => e.content.includes('10 passed'))
      expect(testResultEvent).toBeDefined()
      expect(testResultEvent.content).toContain('1 failed')
      expect(testResultEvent.content).toContain('3 skipped')
      expect(testResultEvent.content).toContain('4567ms')
    })
  })
})
