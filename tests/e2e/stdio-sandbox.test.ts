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
 * - oauth.do authentication (run `oauth.do login` first)
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

beforeAll(async () => {
  hasCredentials = await hasSandboxCredentials()
  if (!hasCredentials) {
    console.log('Skipping stdio sandbox tests - not authenticated')
    console.log('Run `oauth.do login` to authenticate')
    console.log(`Worker URL: ${getWorkerBaseUrl()}`)
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
    if (!hasCredentials) ctx.skip()
  })

  test('can run echo command', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'echo', ['Hello, Sandbox!'])

    expect(output.stdout).toContain('Hello, Sandbox!')
    expect(output.exitCode).toBe(0)
  })

  test('can run command with multiple args', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'echo', ['-n', 'no newline'])

    expect(output.stdout).toBe('no newline')
    expect(output.exitCode).toBe(0)
  })

  test('captures stderr separately', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bash', [
      '-c',
      'echo "stdout" && echo "stderr" >&2',
    ])

    expect(output.stdout).toContain('stdout')
    expect(output.stderr).toContain('stderr')
    expect(output.exitCode).toBe(0)
  })

  test('returns non-zero exit code for failed commands', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bash', ['-c', 'exit 42'])

    expect(output.exitCode).toBe(42)
  })

  test('handles command not found', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'nonexistent-command-12345', [])

    expect(output.exitCode).not.toBe(0)
  })
})

describe('stdin handling', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('can send stdin to command', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'cat', [], {
      stdin: 'Hello from stdin\n',
    })

    expect(output.stdout).toContain('Hello from stdin')
    expect(output.exitCode).toBe(0)
  })

  test('can pipe stdin through multiple commands', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bash', ['-c', 'cat | tr a-z A-Z'], {
      stdin: 'lowercase\n',
    })

    expect(output.stdout).toContain('LOWERCASE')
  })
})

describe('bash integration', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('can run bash one-liner', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bash', [
      '-c',
      'for i in 1 2 3; do echo $i; done',
    ])

    expect(output.stdout).toContain('1')
    expect(output.stdout).toContain('2')
    expect(output.stdout).toContain('3')
    expect(output.exitCode).toBe(0)
  })

  test('environment variables work', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bash', [
      '-c',
      'export FOO=bar && echo $FOO',
    ])

    expect(output.stdout).toContain('bar')
  })

  test('working directory is writable', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bash', [
      '-c',
      'echo "test" > /tmp/test.txt && cat /tmp/test.txt',
    ])

    expect(output.stdout).toContain('test')
    expect(output.exitCode).toBe(0)
  })
})

describe('git operations', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('git is available', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'git', ['--version'])

    expect(output.stdout).toContain('git version')
    expect(output.exitCode).toBe(0)
  })

  test('can clone public repo', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(
      session.sandboxId,
      'bash',
      ['-c', 'git clone --depth 1 https://github.com/octocat/Hello-World.git /tmp/repo && ls /tmp/repo'],
      { timeout: 60000 }
    )

    expect(output.stdout).toContain('README')
    expect(output.exitCode).toBe(0)
  }, 60000)
})

describe('node/bun availability', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('node is available', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'node', ['--version'])

    expect(output.stdout).toMatch(/v\d+\.\d+/)
    expect(output.exitCode).toBe(0)
  })

  test('bun is available', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'bun', ['--version'])

    expect(output.stdout).toMatch(/\d+\.\d+/)
    expect(output.exitCode).toBe(0)
  })

  test('can run inline node script', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'node', [
      '-e',
      'console.log(JSON.stringify({hello: "world"}))',
    ])

    expect(output.stdout).toContain('{"hello":"world"}')
    expect(output.exitCode).toBe(0)
  })
})

describe('claude code availability', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test.skip('claude-code CLI is installed', async () => {
    // Skip if ANTHROPIC_API_KEY not set
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping claude-code test - ANTHROPIC_API_KEY not set')
      return
    }

    const session = await createSession()
    createdSessions.push(session.sandboxId)

    const output = await runCommand(session.sandboxId, 'claude-code', ['--version'])

    expect(output.exitCode).toBe(0)
    expect(output.stdout).toContain('claude')
  })
})

describe('timeout handling', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('command times out after specified duration', async () => {
    const session = await createSession()
    createdSessions.push(session.sandboxId)

    await expect(
      runCommand(session.sandboxId, 'sleep', ['10'], { timeout: 1000 })
    ).rejects.toThrow('timed out')
  }, 5000)
})

describe('concurrent sessions', () => {
  beforeEach((ctx) => {
    if (!hasCredentials) ctx.skip()
  })

  test('can run multiple sessions concurrently', async () => {
    const session1 = await createSession()
    const session2 = await createSession()
    createdSessions.push(session1.sandboxId, session2.sandboxId)

    const [output1, output2] = await Promise.all([
      runCommand(session1.sandboxId, 'echo', ['session1']),
      runCommand(session2.sandboxId, 'echo', ['session2']),
    ])

    expect(output1.stdout).toContain('session1')
    expect(output2.stdout).toContain('session2')
  })

  test('sessions are isolated', async () => {
    const session1 = await createSession()
    const session2 = await createSession()
    createdSessions.push(session1.sandboxId, session2.sandboxId)

    // Write file in session1
    await runCommand(session1.sandboxId, 'bash', ['-c', 'echo "secret" > /tmp/test.txt'])

    // Try to read in session2 (should not exist)
    const output = await runCommand(session2.sandboxId, 'bash', [
      '-c',
      'cat /tmp/test.txt 2>&1 || echo "file not found"',
    ])

    expect(output.stdout).toContain('file not found')
  })
})
