/**
 * E2E: Stdio WebSocket Sandbox Tests
 *
 * Tests the stdio-over-WebSocket sandbox API:
 * - Session creation via /api/stdio/create
 * - WebSocket connection and binary protocol
 * - Command execution (echo, bash)
 * - stdout/stderr multiplexing
 * - Exit code handling
 *
 * Requires:
 * - WORKER_BASE_URL (default: https://todo.mdx.do)
 * - TEST_API_KEY for authentication
 *
 * NOTE: Tests share sandbox sessions where possible to reduce container usage.
 * Same sandboxId = same container instance.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  createSession,
  getSessionStatus,
  deleteSession,
  runCommand,
  hasSandboxCredentials,
  getWorkerBaseUrl,
  STREAM_STDOUT,
  STREAM_STDERR,
  pack,
  unpack,
} from '../helpers/stdio'

// Track created sessions for cleanup
const createdSessions: string[] = []

// Check auth status before tests
let hasCredentials = false

// Shared session for tests that don't need isolation
// Using the same sandboxId means the same container is reused
const SHARED_SANDBOX_ID = 'e2e-shared-sandbox'
let sharedSessionReady = false

beforeAll(async () => {
  hasCredentials = hasSandboxCredentials()
  if (!hasCredentials) {
    console.log('Skipping stdio sandbox tests - not authenticated')
    console.log('Set TEST_API_KEY to run these tests')
    console.log(`Worker URL: ${getWorkerBaseUrl()}`)
    return
  }

  // Pre-create the shared session for tests to reuse
  try {
    await createSession({ sandboxId: SHARED_SANDBOX_ID })
    createdSessions.push(SHARED_SANDBOX_ID)
    sharedSessionReady = true
    console.log('Shared sandbox session created:', SHARED_SANDBOX_ID)
  } catch (e) {
    console.error('Failed to create shared sandbox session:', e)
  }
})

afterAll(async () => {
  // Clean up all created sessions
  for (const sessionId of createdSessions) {
    try {
      await deleteSession(sessionId)
    } catch {
      // Ignore cleanup errors
    }
  }
})

describe('protocol helpers', () => {
  test('pack creates correct binary format', () => {
    const payload = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
    const packed = pack(STREAM_STDOUT, payload)

    expect(packed.length).toBe(6)
    expect(packed[0]).toBe(STREAM_STDOUT)
    expect(packed.slice(1)).toEqual(payload)
  })

  test('unpack extracts stream ID and payload', () => {
    const data = new Uint8Array([STREAM_STDERR, 0x45, 0x72, 0x72]) // "Err"
    const { streamId, payload } = unpack(data)

    expect(streamId).toBe(STREAM_STDERR)
    expect(new TextDecoder().decode(payload)).toBe('Err')
  })

  test('pack and unpack are inverse operations', () => {
    const originalPayload = new TextEncoder().encode('Test message')
    const packed = pack(STREAM_STDOUT, originalPayload)
    const { streamId, payload } = unpack(packed)

    expect(streamId).toBe(STREAM_STDOUT)
    expect(payload).toEqual(originalPayload)
  })
})

describe('session management', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('can create a sandbox session', async () => {
    const session = await createSession()

    expect(session.sandboxId).toBeDefined()
    expect(session.wsUrl).toContain('/api/stdio/')
    expect(session.expiresIn).toBeGreaterThan(0)

    createdSessions.push(session.sandboxId)
  })

  test('can create session with custom ID', async () => {
    const customId = `test-${Date.now()}`
    const session = await createSession({ sandboxId: customId })

    expect(session.sandboxId).toBe(customId)
    createdSessions.push(session.sandboxId)
  })

  test('can get session status', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const status = await getSessionStatus(session.sandboxId)

    expect(status.sandboxId).toBe(session.sandboxId)
    expect(status.session).toBeDefined()
    expect(status.session.createdAt).toBeGreaterThan(0)
  })

  test('can delete session', async () => {
    const session = await createSession()

    await deleteSession(session.sandboxId)

    // Status should now fail
    await expect(getSessionStatus(session.sandboxId)).rejects.toThrow()
  })
})

describe('command execution', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('can run echo command', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'echo', ['Hello, Sandbox!'])

    expect(output.stdout).toContain('Hello, Sandbox!')
    expect(output.exitCode).toBe(0)
  })

  test('can run command with multiple args', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'echo', ['-n', 'no newline'])

    expect(output.stdout).toBe('no newline')
    expect(output.exitCode).toBe(0)
  })

  test('captures stderr separately', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'bash', [
      '-c',
      'echo "stdout" && echo "stderr" >&2',
    ])

    expect(output.stdout).toContain('stdout')
    expect(output.stderr).toContain('stderr')
    expect(output.exitCode).toBe(0)
  })

  test('returns non-zero exit code for failed commands', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'bash', ['-c', 'exit 42'])

    expect(output.exitCode).toBe(42)
  })

  test('handles command not found', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'nonexistent-command-12345', [])

    // Either non-zero exit code OR stderr contains error message
    const hasError = output.exitCode !== 0 ||
      output.stderr.includes('not found') ||
      output.stderr.includes('No such file') ||
      output.error !== null
    expect(hasError).toBe(true)
  })
})

describe('stdin handling', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  // Note: Direct stdin to cat/tr requires EOF signaling which isn't implemented yet.
  // Use head -n1 or timeout to work around missing EOF signal.

  test('can send stdin to command', async () => {
    // Use head -n1 to only read one line and exit (doesn't wait for EOF)
    const output = await runCommand(SHARED_SANDBOX_ID, 'head', ['-n1'], {
      stdin: 'Hello from stdin\n',
      timeout: 5000,
    })

    expect(output.stdout).toContain('Hello from stdin')
    expect(output.exitCode).toBe(0)
  })

  test('can pipe stdin through multiple commands', async () => {
    // Use head -n1 to read exactly one line then exit
    const output = await runCommand(SHARED_SANDBOX_ID, 'bash', ['-c', 'head -n1 | tr a-z A-Z'], {
      stdin: 'lowercase\n',
      timeout: 5000,
    })

    expect(output.stdout).toContain('LOWERCASE')
  })
})

describe('bash integration', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('can run bash one-liner', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'bash', [
      '-c',
      'for i in 1 2 3; do echo $i; done',
    ])

    expect(output.stdout).toContain('1')
    expect(output.stdout).toContain('2')
    expect(output.stdout).toContain('3')
    expect(output.exitCode).toBe(0)
  })

  test('environment variables work', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'bash', [
      '-c',
      'export FOO=bar && echo $FOO',
    ])

    expect(output.stdout).toContain('bar')
  })

  test('working directory is writable', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'bash', [
      '-c',
      'echo "test" > /tmp/test.txt && cat /tmp/test.txt',
    ])

    expect(output.stdout).toContain('test')
    expect(output.exitCode).toBe(0)
  })
})

describe('git operations', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('git is available', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'git', ['--version'])

    expect(output.stdout).toContain('git version')
    expect(output.exitCode).toBe(0)
  })

  test('can clone public repo', async () => {
    // Use unique path to avoid conflicts with previous test runs
    const repoPath = `/tmp/repo-${Date.now()}`
    const output = await runCommand(
      SHARED_SANDBOX_ID,
      'bash',
      ['-c', `git clone --depth 1 https://github.com/octocat/Hello-World.git ${repoPath} && ls ${repoPath}`],
      { timeout: 60000 }
    )

    expect(output.stdout).toContain('README')
    expect(output.exitCode).toBe(0)
  }, 60000)
})

describe('node/bun availability', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('node is available', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'node', ['--version'])

    expect(output.stdout).toMatch(/v\d+\.\d+/)
    expect(output.exitCode).toBe(0)
  })

  test('bun is available', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'bun', ['--version'])

    expect(output.stdout).toMatch(/\d+\.\d+/)
    expect(output.exitCode).toBe(0)
  })

  test('can run inline node script', async () => {
    const output = await runCommand(SHARED_SANDBOX_ID, 'node', [
      '-e',
      'console.log(JSON.stringify({hello: "world"}))',
    ])

    expect(output.stdout).toContain('{"hello":"world"}')
    expect(output.exitCode).toBe(0)
  })
})

describe('claude code availability', () => {
  // Check if we have Claude Code OAuth token
  const claudeOAuthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN

  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('claude-code CLI is installed', async () => {
    // Just check --version works (doesn't require auth)
    const output = await runCommand(SHARED_SANDBOX_ID, 'claude', ['--version'])

    expect(output.exitCode).toBe(0)
    // Should output version info
    expect(output.stdout.length).toBeGreaterThan(0)
  })

  test('claude-code can authenticate with OAuth token', async () => {
    if (!claudeOAuthToken) {
      console.log('Skipping - CLAUDE_CODE_OAUTH_TOKEN not set')
      return
    }

    // Run a simple claude-code command with OAuth token
    const output = await runCommand(
      SHARED_SANDBOX_ID,
      'claude',
      ['--print', 'Say "Hello from sandbox" and nothing else'],
      {
        env: { CLAUDE_CODE_OAUTH_TOKEN: claudeOAuthToken },
        timeout: 60000, // Claude can take a while
      }
    )

    expect(output.exitCode).toBe(0)
    expect(output.stdout.toLowerCase()).toContain('hello')
  }, 60000)
})

describe('timeout handling', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('command times out after specified duration', async () => {
    await expect(
      runCommand(SHARED_SANDBOX_ID, 'sleep', ['10'], { timeout: 1000, retries: 0 })
    ).rejects.toThrow(/timed out|WebSocket/)
  }, 5000)
})

describe('concurrent command execution', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('can run multiple commands concurrently on same session', async () => {
    // Run concurrent commands on the shared session
    const [output1, output2, output3] = await Promise.all([
      runCommand(SHARED_SANDBOX_ID, 'echo', ['cmd1']),
      runCommand(SHARED_SANDBOX_ID, 'echo', ['cmd2']),
      runCommand(SHARED_SANDBOX_ID, 'echo', ['cmd3']),
    ])

    expect(output1.stdout).toContain('cmd1')
    expect(output2.stdout).toContain('cmd2')
    expect(output3.stdout).toContain('cmd3')
  })
})

describe('multi-session isolation', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  // Note: Creating multiple concurrent sessions can hit rate limits.
  // These tests verify session isolation but may need retry logic in CI.

  test.skip('sessions are isolated (requires multiple containers)', async () => {
    // This test requires creating multiple containers which can hit rate limits.
    // Skipped for now - isolation is verified by the container architecture.
    const ts = Date.now()
    const session1 = await createSession({ sandboxId: `e2e-isolated-1-${ts}` })
    const session2 = await createSession({ sandboxId: `e2e-isolated-2-${ts}` })
    createdSessions.push(session1.sandboxId, session2.sandboxId)

    await new Promise(resolve => setTimeout(resolve, 2000))

    await runCommand(session1.sandboxId, 'bash', ['-c', 'echo "secret" > /tmp/test.txt'], { retries: 2 })

    const output = await runCommand(session2.sandboxId, 'bash', [
      '-c',
      'cat /tmp/test.txt 2>&1 || echo "file not found"',
    ], { retries: 2 })

    expect(output.stdout).toContain('file not found')
  })
})
