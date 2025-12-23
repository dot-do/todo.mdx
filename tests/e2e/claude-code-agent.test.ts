/**
 * E2E: Claude Code Agent Tests
 *
 * TDD RED PHASE: Tests for ClaudeCodeAgent.do() sandbox execution.
 * These tests verify the agent properly delegates to the sandbox infrastructure
 * instead of returning a placeholder message.
 *
 * The ClaudeCodeAgent should:
 * 1. Create a sandbox session
 * 2. Execute the task via the sandbox
 * 3. Return real results (diff, files changed, success status)
 * 4. Properly clean up after execution
 *
 * Requires:
 * - WORKER_BASE_URL (default: https://todo.mdx.do)
 * - TEST_API_KEY for authentication
 * - ANTHROPIC_API_KEY for Claude Code execution
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest'
import { hasWorkerCredentials } from '../helpers'

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const TEST_API_KEY = process.env.TEST_API_KEY

// ANTHROPIC_API_KEY is configured on the worker, not needed for tests
const hasCredentials = hasWorkerCredentials()

// Skip tests if no credentials
const describeWithCredentials = hasCredentials ? describe : describe.skip

// Helper to make authenticated requests to the worker
async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${WORKER_BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(TEST_API_KEY && { Authorization: `Bearer ${TEST_API_KEY}` }),
    ...options.headers,
  }
  return fetch(url, { ...options, headers })
}

// ============================================================================
// ClaudeCodeAgent.do() Tests
// ============================================================================

describeWithCredentials('ClaudeCodeAgent sandbox execution', () => {
  beforeAll(() => {
    if (!hasCredentials) {
      console.log('Skipping ClaudeCodeAgent tests - missing credentials')
      console.log('  TEST_API_KEY:', !!TEST_API_KEY)
    }
  })

  test('agent.do() executes task in sandbox and returns real results', async () => {
    // This test verifies that ClaudeCodeAgent actually executes tasks
    // instead of returning the placeholder message

    const response = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'Add a comment "// Test comment from ClaudeCodeAgent" at the top of README.md',
        repo: 'dot-do/test.mdx',
      }),
    })

    expect(response.ok).toBe(true)

    const result = await response.json() as {
      success: boolean
      output: string
      artifacts: Array<{ type: string; ref: string; url?: string }>
      events: Array<{ type: string }>
    }

    // Must succeed (not a placeholder failure)
    expect(result.success).toBe(true)

    // Output must not contain placeholder message
    expect(result.output).not.toContain('Placeholder')
    expect(result.output).not.toContain('not yet implemented')
    expect(result.output).not.toContain('Implementation pending')

    // Must have events tracking the execution
    expect(result.events.length).toBeGreaterThan(0)

    // Must have at least a thinking and done event
    const eventTypes = result.events.map(e => e.type)
    expect(eventTypes).toContain('thinking')
    expect(eventTypes).toContain('done')
  }, 180_000) // 3 minute timeout for sandbox execution

  test('agent.do() returns diff for file modifications', async () => {
    const response = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'Create a new file called test-output.txt with content "Hello from Claude Code Agent"',
        repo: 'dot-do/test.mdx',
      }),
    })

    expect(response.ok).toBe(true)

    const result = await response.json() as {
      success: boolean
      output: string
      artifacts: Array<{ type: string; ref: string }>
    }

    expect(result.success).toBe(true)

    // Output should contain diff or summary of changes
    expect(result.output.length).toBeGreaterThan(0)

    // Should have file artifacts
    const fileArtifacts = result.artifacts?.filter(a => a.type === 'file')
    expect(fileArtifacts?.length).toBeGreaterThan(0)
  }, 180_000)

  test('agent.do() emits streaming events', async () => {
    const events: Array<{ type: string; content?: string }> = []

    const response = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'List all files in the repository',
        repo: 'dot-do/test.mdx',
        stream: true,
      }),
    })

    // Should return SSE stream
    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    const timeout = setTimeout(() => reader.cancel(), 120_000)

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              events.push(event)

              if (event.type === 'done' || event.type === 'error') {
                reader.cancel()
                break
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout)
    }

    // Must have streaming events
    expect(events.length).toBeGreaterThan(0)

    // Must have thinking event
    const thinkingEvents = events.filter(e => e.type === 'thinking')
    expect(thinkingEvents.length).toBeGreaterThan(0)

    // Must have done event with result
    const doneEvents = events.filter(e => e.type === 'done')
    expect(doneEvents.length).toBe(1)
  }, 180_000)

  test('agent.do() handles errors gracefully', async () => {
    const response = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'Do something',
        repo: 'nonexistent-org/nonexistent-repo-xyz123',
      }),
    })

    // Should still return a response (not crash)
    expect(response.status).toBeDefined()

    const result = await response.json() as {
      success: boolean
      output: string
      events: Array<{ type: string; error?: string }>
    }

    // Success should be false for error cases
    expect(result.success).toBe(false)

    // Should have error event or error in output
    const hasError =
      result.output.toLowerCase().includes('error') ||
      result.output.toLowerCase().includes('failed') ||
      result.events.some(e => e.type === 'error')
    expect(hasError).toBe(true)
  }, 30_000)
})

// ============================================================================
// ClaudeCodeAgent.ask() Tests
// ============================================================================

describeWithCredentials('ClaudeCodeAgent.ask() behavior', () => {
  test('ask() returns recommendation to use lighter agent', async () => {
    const response = await apiRequest('/api/agents/claude-code/ask', {
      method: 'POST',
      body: JSON.stringify({
        question: 'What is TypeScript?',
      }),
    })

    expect(response.ok).toBe(true)

    const result = await response.json() as {
      answer: string
      confidence: number
    }

    // Should suggest using a lighter agent
    expect(result.answer.toLowerCase()).toContain('sandbox')
    expect(result.confidence).toBeGreaterThan(0.5)
  })
})

// ============================================================================
// Sandbox Session Management
// ============================================================================

describeWithCredentials('ClaudeCodeAgent sandbox session lifecycle', () => {
  test('creates sandbox session for execution', async () => {
    // First, verify sandbox health
    const healthResponse = await apiRequest('/api/sandbox/health?quick=true')
    const health = await healthResponse.json() as { available: boolean }

    if (!health.available) {
      console.log('Sandbox not available, skipping session test')
      return
    }

    // Execute a task
    const response = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'echo "test"',
        repo: 'dot-do/test.mdx',
      }),
    })

    expect(response.ok).toBe(true)

    const result = await response.json() as {
      success: boolean
      output: string
    }

    // Should complete without sandbox-related errors
    expect(result.output).not.toContain('Sandbox service is not available')
    expect(result.output).not.toContain('Sandbox binding not configured')
  }, 180_000)

  test('cleans up sandbox session after execution', async () => {
    // Execute a task
    const executeResponse = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'echo "cleanup test"',
        repo: 'dot-do/test.mdx',
      }),
    })

    expect(executeResponse.ok).toBe(true)

    // The session should be cleaned up automatically
    // We can't directly verify this, but we can check that
    // subsequent executions work (no resource exhaustion)
    const secondResponse = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({
        task: 'echo "second execution"',
        repo: 'dot-do/test.mdx',
      }),
    })

    expect(secondResponse.ok).toBe(true)
  }, 300_000)
})

// ============================================================================
// Integration with Existing Sandbox API
// ============================================================================

describeWithCredentials('ClaudeCodeAgent uses existing sandbox infrastructure', () => {
  test('agent execution produces same results as direct sandbox execute', async () => {
    const task = 'List all files in the current directory using ls -la'
    const repo = 'dot-do/test.mdx'

    // Execute via ClaudeCodeAgent
    const agentResponse = await apiRequest('/api/agents/claude-code/do', {
      method: 'POST',
      body: JSON.stringify({ task, repo }),
    })

    // Execute via sandbox API directly
    const sandboxResponse = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({ task, repo }),
    })

    // Both should succeed
    expect(agentResponse.ok).toBe(true)
    expect(sandboxResponse.ok).toBe(true)

    const agentResult = await agentResponse.json() as { success: boolean; output: string }
    const sandboxResult = await sandboxResponse.json() as { exitCode: number; summary: string }

    // Both should have executed successfully
    expect(agentResult.success).toBe(true)
    expect(sandboxResult.exitCode).toBe(0)

    // Both outputs should contain file listing information
    expect(agentResult.output.length).toBeGreaterThan(0)
    expect(sandboxResult.summary.length).toBeGreaterThan(0)
  }, 180_000)
})
