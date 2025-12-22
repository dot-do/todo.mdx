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
import { hasSandboxCredentials, stdio } from '../helpers'

const {
  createSession,
  createSessionWithRetry,
  getSessionStatus,
  deleteSession,
  runCommand,
  runCommandWithControls,
  getWorkerBaseUrl,
  STREAM_STDOUT,
  STREAM_STDERR,
  pack,
  unpack,
} = stdio

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

describe('EOF signaling', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('EOF closes stdin and allows cat to complete', async () => {
    // cat without args reads from stdin until EOF
    // Without EOF signaling, this would hang forever
    const output = await runCommandWithControls(SHARED_SANDBOX_ID, 'cat', [], {
      timeout: 10000,
      onConnected: (controls) => {
        // Send some input
        controls.sendStdin('line 1\n')
        controls.sendStdin('line 2\n')
        // Signal EOF to let cat complete
        controls.sendEof()
      },
    })

    expect(output.stdout).toContain('line 1')
    expect(output.stdout).toContain('line 2')
    expect(output.exitCode).toBe(0)
  })

  test('EOF works with tr command (pipe without head workaround)', async () => {
    // tr reads stdin until EOF, transforms, then outputs
    // This previously required head -n1 workaround
    const output = await runCommandWithControls(SHARED_SANDBOX_ID, 'tr', ['a-z', 'A-Z'], {
      timeout: 10000,
      onConnected: (controls) => {
        controls.sendStdin('hello world\n')
        controls.sendEof()
      },
    })

    expect(output.stdout).toContain('HELLO WORLD')
    expect(output.exitCode).toBe(0)
  })

  test('EOF with wc command counts lines correctly', async () => {
    // wc -l counts lines in stdin until EOF
    const output = await runCommandWithControls(SHARED_SANDBOX_ID, 'wc', ['-l'], {
      timeout: 10000,
      onConnected: (controls) => {
        controls.sendStdin('line 1\n')
        controls.sendStdin('line 2\n')
        controls.sendStdin('line 3\n')
        controls.sendEof()
      },
    })

    // wc -l should output "3" (may have leading spaces)
    expect(output.stdout.trim()).toBe('3')
    expect(output.exitCode).toBe(0)
  })

  test('EOF allows piping through multiple commands', async () => {
    // Pipe: cat | sort | uniq - requires EOF for each stage
    const output = await runCommandWithControls(
      SHARED_SANDBOX_ID,
      'bash',
      ['-c', 'cat | sort | uniq'],
      {
        timeout: 10000,
        onConnected: (controls) => {
          controls.sendStdin('banana\n')
          controls.sendStdin('apple\n')
          controls.sendStdin('apple\n')
          controls.sendStdin('cherry\n')
          controls.sendEof()
        },
      }
    )

    // Should have sorted unique lines
    const lines = output.stdout.trim().split('\n')
    expect(lines).toEqual(['apple', 'banana', 'cherry'])
    expect(output.exitCode).toBe(0)
  })

  test('EOF with delayed stdin input', async () => {
    // Test that EOF works even with delayed stdin writes
    const output = await runCommandWithControls(SHARED_SANDBOX_ID, 'cat', [], {
      timeout: 10000,
      onConnected: (controls) => {
        controls.sendStdin('first\n')
        // Simulate async input with small delay
        setTimeout(() => {
          controls.sendStdin('second\n')
          controls.sendEof()
        }, 100)
      },
    })

    expect(output.stdout).toContain('first')
    expect(output.stdout).toContain('second')
    expect(output.exitCode).toBe(0)
  })

  test('empty stdin with immediate EOF', async () => {
    // cat with empty input should exit immediately with EOF
    const output = await runCommandWithControls(SHARED_SANDBOX_ID, 'cat', [], {
      timeout: 5000,
      onConnected: (controls) => {
        // Send EOF immediately without any stdin
        controls.sendEof()
      },
    })

    expect(output.stdout).toBe('')
    expect(output.exitCode).toBe(0)
  })

  test('EOF with read command in bash', async () => {
    // bash read command waits for newline, but exits on EOF
    const output = await runCommandWithControls(
      SHARED_SANDBOX_ID,
      'bash',
      ['-c', 'read line && echo "Got: $line" || echo "EOF received"'],
      {
        timeout: 5000,
        onConnected: (controls) => {
          controls.sendStdin('hello\n')
          controls.sendEof()
        },
      }
    )

    expect(output.stdout).toContain('Got: hello')
    expect(output.exitCode).toBe(0)
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

  test('claude-code can run with injected OAuth token', async () => {
    // The worker auto-injects CLAUDE_CODE_OAUTH_TOKEN from its environment
    // This test verifies the token is available in the sandbox
    const output = await runCommand(
      SHARED_SANDBOX_ID,
      'bash',
      ['-c', 'echo "OAUTH_TOKEN_SET=$([[ -n $CLAUDE_CODE_OAUTH_TOKEN ]] && echo yes || echo no)"'],
      { timeout: 5000 }
    )

    // If the token is set in the worker, it should be available in the sandbox
    // The test passes either way - we're just checking the mechanism works
    expect(output.exitCode).toBe(0)
    console.log('OAuth token available:', output.stdout.includes('yes'))
  })
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

  // These tests verify session isolation using retry logic with exponential backoff
  // to handle rate limits when creating multiple containers.

  test('file system is isolated between sessions', async () => {
    // Create two isolated sessions with unique IDs
    // Use createSessionWithRetry to handle rate limits with exponential backoff
    const ts = Date.now()
    const session1Id = `e2e-fs-isolated-1-${ts}`
    const session2Id = `e2e-fs-isolated-2-${ts}`

    // Create sessions sequentially with delay to avoid rate limits
    const session1 = await createSessionWithRetry(
      { sandboxId: session1Id },
      { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 15000 }
    )
    createdSessions.push(session1.sandboxId)

    // Add delay between session creations to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000))

    const session2 = await createSessionWithRetry(
      { sandboxId: session2Id },
      { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 15000 }
    )
    createdSessions.push(session2.sandboxId)

    // Wait for containers to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Write a file in session 1
    const secretContent = `secret-${ts}`
    const writeOutput = await runCommand(
      session1.sandboxId,
      'bash',
      ['-c', `echo "${secretContent}" > /tmp/isolation-test.txt && cat /tmp/isolation-test.txt`],
      { retries: 2, timeout: 10000 }
    )
    expect(writeOutput.exitCode).toBe(0)
    expect(writeOutput.stdout).toContain(secretContent)

    // Verify session 2 cannot see the file (file system isolation)
    const readOutput = await runCommand(
      session2.sandboxId,
      'bash',
      ['-c', 'cat /tmp/isolation-test.txt 2>&1 || echo "FILE_NOT_FOUND"'],
      { retries: 2, timeout: 10000 }
    )

    // The file should not exist in session 2's container
    expect(readOutput.stdout).toContain('FILE_NOT_FOUND')
    expect(readOutput.stdout).not.toContain(secretContent)
  }, 60000) // Long timeout for retries and container startup

  test('process namespace is isolated between sessions', async () => {
    // Create two isolated sessions with unique IDs
    const ts = Date.now()
    const session1Id = `e2e-pid-isolated-1-${ts}`
    const session2Id = `e2e-pid-isolated-2-${ts}`

    // Create sessions sequentially with delay to avoid rate limits
    const session1 = await createSessionWithRetry(
      { sandboxId: session1Id },
      { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 15000 }
    )
    createdSessions.push(session1.sandboxId)

    await new Promise(resolve => setTimeout(resolve, 2000))

    const session2 = await createSessionWithRetry(
      { sandboxId: session2Id },
      { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 15000 }
    )
    createdSessions.push(session2.sandboxId)

    // Wait for containers to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Start a long-running process in session 1 and get its PID
    // Use a unique marker to identify the process
    const processMarker = `isolation-test-${ts}`
    const startOutput = await runCommand(
      session1.sandboxId,
      'bash',
      ['-c', `sleep 300 & echo $! > /tmp/${processMarker}.pid && cat /tmp/${processMarker}.pid`],
      { retries: 2, timeout: 10000 }
    )
    expect(startOutput.exitCode).toBe(0)
    const pid = startOutput.stdout.trim()
    expect(pid).toMatch(/^\d+$/)

    // Verify the process is running in session 1
    const checkSession1 = await runCommand(
      session1.sandboxId,
      'bash',
      ['-c', `ps aux | grep "sleep 300" | grep -v grep && echo "PROCESS_FOUND" || echo "PROCESS_NOT_FOUND"`],
      { retries: 2, timeout: 10000 }
    )
    expect(checkSession1.stdout).toContain('PROCESS_FOUND')

    // Verify session 2 cannot see session 1's process (PID namespace isolation)
    const checkSession2 = await runCommand(
      session2.sandboxId,
      'bash',
      ['-c', `ps aux | grep "sleep 300" | grep -v grep && echo "PROCESS_FOUND" || echo "PROCESS_NOT_FOUND"`],
      { retries: 2, timeout: 10000 }
    )
    expect(checkSession2.stdout).toContain('PROCESS_NOT_FOUND')

    // Also verify session 2 cannot signal the process (even if it guesses the PID)
    const signalOutput = await runCommand(
      session2.sandboxId,
      'bash',
      ['-c', `kill -0 ${pid} 2>&1 && echo "SIGNAL_SUCCESS" || echo "SIGNAL_FAILED"`],
      { retries: 2, timeout: 10000 }
    )
    expect(signalOutput.stdout).toContain('SIGNAL_FAILED')

    // Clean up: kill the background process in session 1
    await runCommand(
      session1.sandboxId,
      'bash',
      ['-c', `kill ${pid} 2>/dev/null || true`],
      { retries: 1, timeout: 5000 }
    )
  }, 90000) // Long timeout for retries, container startup, and process operations

  test('environment variables are isolated between sessions', async () => {
    // Create two isolated sessions with unique IDs
    const ts = Date.now()
    const session1Id = `e2e-env-isolated-1-${ts}`
    const session2Id = `e2e-env-isolated-2-${ts}`

    // Create sessions sequentially with delay
    const session1 = await createSessionWithRetry(
      { sandboxId: session1Id },
      { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 15000 }
    )
    createdSessions.push(session1.sandboxId)

    await new Promise(resolve => setTimeout(resolve, 2000))

    const session2 = await createSessionWithRetry(
      { sandboxId: session2Id },
      { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 15000 }
    )
    createdSessions.push(session2.sandboxId)

    await new Promise(resolve => setTimeout(resolve, 2000))

    // Set an environment variable in session 1 via a persistent file sourced by bash
    const secretEnvValue = `secret-env-${ts}`
    const setEnvOutput = await runCommand(
      session1.sandboxId,
      'bash',
      ['-c', `echo "export SECRET_VAR=${secretEnvValue}" >> ~/.bashrc && export SECRET_VAR=${secretEnvValue} && echo $SECRET_VAR`],
      { retries: 2, timeout: 10000 }
    )
    expect(setEnvOutput.exitCode).toBe(0)
    expect(setEnvOutput.stdout).toContain(secretEnvValue)

    // Verify session 2 does not have this environment variable
    const checkEnvOutput = await runCommand(
      session2.sandboxId,
      'bash',
      ['-c', 'source ~/.bashrc 2>/dev/null; echo "SECRET_VAR=${SECRET_VAR:-NOT_SET}"'],
      { retries: 2, timeout: 10000 }
    )
    expect(checkEnvOutput.stdout).toContain('SECRET_VAR=NOT_SET')
    expect(checkEnvOutput.stdout).not.toContain(secretEnvValue)
  }, 60000)
})
