import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeCodeAgent, SandboxExecuteOptions } from '../claude-code'
import { AgentDef } from '../../base'
import type { Env } from '../../../types/env'

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
})
