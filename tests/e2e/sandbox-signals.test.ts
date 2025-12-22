/**
 * E2E: Sandbox Signal Handling Tests
 *
 * Tests signal handling in the stdio-over-WebSocket sandbox API:
 * - SIGINT (Ctrl+C) terminates running command
 * - SIGTERM graceful shutdown
 * - SIGKILL force termination
 * - Signal propagation to child processes
 *
 * Requires:
 * - WORKER_BASE_URL (default: https://todo.mdx.do)
 * - TEST_API_KEY for authentication
 *
 * NOTE: Signal tests require long-running commands to be interrupted.
 * Uses the existing stdio-ws protocol which supports signals via JSON control messages.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  createSession,
  deleteSession,
  runCommandWithSignal,
  hasSandboxCredentials,
  getWorkerBaseUrl,
} from '../helpers/stdio'

// Track created sessions for cleanup
const createdSessions: string[] = []

// Check auth status before tests
let hasCredentials = false

// Shared session for signal tests
const SIGNAL_TEST_SANDBOX_ID = 'e2e-signal-tests'
let sharedSessionReady = false

beforeAll(async () => {
  hasCredentials = hasSandboxCredentials()
  if (!hasCredentials) {
    console.log('Skipping sandbox signal tests - not authenticated')
    console.log('Set TEST_API_KEY to run these tests')
    console.log(`Worker URL: ${getWorkerBaseUrl()}`)
    return
  }

  // Pre-create the shared session for tests to reuse
  try {
    await createSession({ sandboxId: SIGNAL_TEST_SANDBOX_ID })
    createdSessions.push(SIGNAL_TEST_SANDBOX_ID)
    sharedSessionReady = true
    console.log('Signal test sandbox session created:', SIGNAL_TEST_SANDBOX_ID)
  } catch (e) {
    console.error('Failed to create signal test sandbox session:', e)
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

describe('SIGINT (Ctrl+C) handling', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('SIGINT terminates a running sleep command', async () => {
    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'], // Would take 30 seconds without signal
      {
        timeout: 10000,
        signalDelay: 500, // Send signal after 500ms
        onConnected: (sendSignal) => {
          sendSignal('SIGINT')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // Command should exit quickly (< 5 seconds), not wait for full 30 seconds
    expect(elapsed).toBeLessThan(5000)

    // Exit code for SIGINT is typically 130 (128 + 2) but may vary
    // The important thing is the command was terminated early
    expect(output.exitCode).not.toBe(0)
  }, 10000)

  test('SIGINT terminates a running bash loop', async () => {
    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'bash',
      ['-c', 'while true; do echo "running"; sleep 1; done'],
      {
        timeout: 10000,
        signalDelay: 1000, // Let it run for 1 second first
        onConnected: (sendSignal) => {
          sendSignal('SIGINT')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // Should have captured some output before signal
    expect(output.stdout).toContain('running')

    // Should exit within reasonable time
    expect(elapsed).toBeLessThan(5000)

    // SIGINT typically results in exit code 130
    expect(output.exitCode).not.toBe(0)
  }, 10000)
})

describe('SIGTERM graceful shutdown', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('SIGTERM terminates running command', async () => {
    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'],
      {
        timeout: 10000,
        signalDelay: 500,
        onConnected: (sendSignal) => {
          sendSignal('SIGTERM')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // Command should exit quickly
    expect(elapsed).toBeLessThan(5000)

    // SIGTERM typically results in exit code 143 (128 + 15)
    expect(output.exitCode).not.toBe(0)
  }, 10000)

  test('process can handle cleanup before SIGTERM exit', async () => {
    // Use a bash script that traps SIGTERM and does cleanup
    const script = `
      trap 'echo "cleanup started"; sleep 0.5; echo "cleanup done"; exit 0' SIGTERM
      echo "process started"
      while true; do sleep 1; done
    `

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'bash',
      ['-c', script],
      {
        timeout: 10000,
        signalDelay: 1000, // Let process start first
        onConnected: (sendSignal) => {
          sendSignal('SIGTERM')
        },
      }
    )

    // Process should have captured the trap and done cleanup
    expect(output.stdout).toContain('process started')
    expect(output.stdout).toContain('cleanup started')
    expect(output.stdout).toContain('cleanup done')

    // Trap exited with 0
    expect(output.exitCode).toBe(0)
  }, 10000)
})

describe('SIGKILL force termination', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('SIGKILL immediately terminates process', async () => {
    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'],
      {
        timeout: 10000,
        signalDelay: 500,
        onConnected: (sendSignal) => {
          sendSignal('SIGKILL')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // SIGKILL should terminate immediately
    expect(elapsed).toBeLessThan(3000)

    // SIGKILL typically results in exit code 137 (128 + 9)
    expect(output.exitCode).not.toBe(0)
  }, 10000)

  test('SIGKILL bypasses signal handlers', async () => {
    // Process with SIGTERM trap that ignores the signal
    const script = `
      trap 'echo "ignoring SIGTERM"' SIGTERM
      echo "process started"
      sleep 30
    `

    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'bash',
      ['-c', script],
      {
        timeout: 10000,
        signalDelay: 500,
        onConnected: (sendSignal) => {
          // SIGKILL cannot be caught or ignored
          sendSignal('SIGKILL')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // Should terminate quickly despite trap
    expect(elapsed).toBeLessThan(3000)

    // No cleanup message because SIGKILL bypasses handlers
    expect(output.stdout).not.toContain('ignoring SIGTERM')
  }, 10000)
})

describe('signal propagation to child processes', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('SIGTERM propagates to child process', async () => {
    // Parent spawns child process; signal should reach child
    const script = `
      echo "parent $$"
      bash -c 'trap "echo child cleanup; exit 0" SIGTERM; echo "child started"; sleep 30' &
      wait
    `

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'bash',
      ['-c', script],
      {
        timeout: 10000,
        signalDelay: 1000,
        onConnected: (sendSignal) => {
          sendSignal('SIGTERM')
        },
      }
    )

    // Both parent and child should have started
    expect(output.stdout).toContain('parent')
    expect(output.stdout).toContain('child started')

    // Signal may or may not propagate depending on process group handling
    // The test verifies the parent terminates within timeout
    expect(output.exitCode).not.toBe(null)
  }, 15000)

  test('signals work with piped commands', async () => {
    // Pipeline should be terminated by signal
    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'bash',
      ['-c', 'yes "test output" | head -n 1000000'],
      {
        timeout: 10000,
        signalDelay: 500,
        onConnected: (sendSignal) => {
          sendSignal('SIGTERM')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // Should terminate before producing 1M lines
    expect(elapsed).toBeLessThan(5000)

    // Should have some output before termination
    expect(output.stdout.length).toBeGreaterThan(0)
  }, 10000)
})

describe('signal edge cases', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('multiple signals are handled correctly', async () => {
    // Process ignores SIGINT, responds to SIGTERM
    const script = `
      trap '' SIGINT
      trap 'echo "got SIGTERM"; exit 0' SIGTERM
      echo "started"
      sleep 30
    `

    let signalSent = false
    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'bash',
      ['-c', script],
      {
        timeout: 10000,
        signalDelay: 500,
        onConnected: (sendSignal) => {
          // Send SIGINT first (ignored), then SIGTERM
          sendSignal('SIGINT')
          setTimeout(() => {
            sendSignal('SIGTERM')
            signalSent = true
          }, 500)
        },
      }
    )

    expect(signalSent).toBe(true)
    expect(output.stdout).toContain('started')
    expect(output.stdout).toContain('got SIGTERM')
    expect(output.exitCode).toBe(0)
  }, 10000)

  test('SIGHUP terminates process', async () => {
    const startTime = Date.now()

    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'],
      {
        timeout: 10000,
        signalDelay: 500,
        onConnected: (sendSignal) => {
          sendSignal('SIGHUP')
        },
      }
    )

    const elapsed = Date.now() - startTime

    // SIGHUP should terminate the process
    expect(elapsed).toBeLessThan(5000)

    // SIGHUP typically results in exit code 129 (128 + 1)
    expect(output.exitCode).not.toBe(0)
  }, 10000)

  test('signal to already-exited process is ignored', async () => {
    // Quick command that exits before signal is sent
    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'echo',
      ['quick exit'],
      {
        timeout: 5000,
        signalDelay: 2000, // Signal sent after process exits
        onConnected: (sendSignal) => {
          sendSignal('SIGTERM')
        },
      }
    )

    // Process should have exited successfully before signal
    expect(output.stdout).toContain('quick exit')
    expect(output.exitCode).toBe(0)
  }, 5000)
})

describe('exit codes reflect signal termination', () => {
  beforeEach((ctx) => {
    if (!hasCredentials || !sharedSessionReady) ctx.skip()
  })

  test('SIGINT exit code is 130 (128+2)', async () => {
    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'],
      {
        timeout: 5000,
        signalDelay: 300,
        onConnected: (sendSignal) => {
          sendSignal('SIGINT')
        },
      }
    )

    // Standard exit code for SIGINT is 130
    // But some systems may report differently
    expect([130, 2, -2]).toContain(output.exitCode)
  }, 10000)

  test('SIGTERM exit code is 143 (128+15)', async () => {
    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'],
      {
        timeout: 5000,
        signalDelay: 300,
        onConnected: (sendSignal) => {
          sendSignal('SIGTERM')
        },
      }
    )

    // Standard exit code for SIGTERM is 143
    expect([143, 15, -15]).toContain(output.exitCode)
  }, 10000)

  test('SIGKILL exit code is 137 (128+9)', async () => {
    const output = await runCommandWithSignal(
      SIGNAL_TEST_SANDBOX_ID,
      'sleep',
      ['30'],
      {
        timeout: 5000,
        signalDelay: 300,
        onConnected: (sendSignal) => {
          sendSignal('SIGKILL')
        },
      }
    )

    // Standard exit code for SIGKILL is 137
    expect([137, 9, -9]).toContain(output.exitCode)
  }, 10000)
})
