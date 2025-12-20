/**
 * Stdio WebSocket Test Helper
 *
 * Helpers for testing the sandbox stdio WebSocket API.
 * Uses the binary protocol from @todo.mdx/sandbox.
 */

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'http://localhost:8787'
const WORKER_ACCESS_TOKEN = process.env.WORKER_ACCESS_TOKEN

// Stream IDs for binary protocol
export const STREAM_STDOUT = 0x01
export const STREAM_STDERR = 0x02

// Pack output with stream ID prefix
export function pack(streamId: number, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + chunk.byteLength)
  out[0] = streamId
  out.set(chunk, 1)
  return out
}

// Unpack stream ID from binary
export function unpack(data: Uint8Array): { streamId: number; payload: Uint8Array } {
  return {
    streamId: data[0],
    payload: data.subarray(1),
  }
}

// Control message types
export interface ResizeMessage {
  type: 'resize'
  cols: number
  rows: number
}

export interface SignalMessage {
  type: 'signal'
  signal: string
}

export interface ExitMessage {
  type: 'exit'
  code: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export type ControlMessage = ResizeMessage | SignalMessage | ExitMessage | ErrorMessage

export function isControlMessage(data: unknown): data is ControlMessage {
  return typeof data === 'object' && data !== null && 'type' in data
}

/**
 * Create a new sandbox session via the API
 */
export async function createSession(options?: {
  sandboxId?: string
  repo?: string
  installationId?: number
}): Promise<{
  sandboxId: string
  wsUrl: string
  expiresIn: number
}> {
  const response = await fetch(`${WORKER_BASE_URL}/api/stdio/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WORKER_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(options || {}),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create session: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Get session status
 */
export async function getSessionStatus(sandboxId: string): Promise<{
  sandboxId: string
  session: {
    userId: string
    repo?: string
    installationId?: number
    createdAt: number
  }
  wsUrl: string
}> {
  const response = await fetch(`${WORKER_BASE_URL}/api/stdio/${sandboxId}/status`, {
    headers: {
      Authorization: `Bearer ${WORKER_ACCESS_TOKEN}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get session status: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Delete a sandbox session
 */
export async function deleteSession(sandboxId: string): Promise<void> {
  const response = await fetch(`${WORKER_BASE_URL}/api/stdio/${sandboxId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${WORKER_ACCESS_TOKEN}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete session: ${response.status} ${error}`)
  }
}

/**
 * Collected output from a sandbox session
 */
export interface SessionOutput {
  stdout: string
  stderr: string
  exitCode: number | null
  error: string | null
}

/**
 * Connect to a sandbox session and run a command
 *
 * @param sandboxId - The sandbox session ID
 * @param cmd - Command to run
 * @param args - Command arguments
 * @param options - Additional options
 * @returns Session output (stdout, stderr, exitCode)
 */
export async function runCommand(
  sandboxId: string,
  cmd: string,
  args: string[] = [],
  options?: {
    stdin?: string
    timeout?: number
    token?: string
  }
): Promise<SessionOutput> {
  const token = options?.token || WORKER_ACCESS_TOKEN
  const timeout = options?.timeout || 30000

  // Build WebSocket URL
  const wsProtocol = WORKER_BASE_URL.startsWith('https') ? 'wss' : 'ws'
  const wsHost = WORKER_BASE_URL.replace(/^https?:\/\//, '')
  const wsUrl = new URL(`${wsProtocol}://${wsHost}/api/stdio/${sandboxId}`)
  wsUrl.searchParams.set('cmd', cmd)
  wsUrl.searchParams.set('token', token!)
  for (const arg of args) {
    wsUrl.searchParams.append('arg', arg)
  }

  return new Promise((resolve, reject) => {
    const output: SessionOutput = {
      stdout: '',
      stderr: '',
      exitCode: null,
      error: null,
    }

    const timeoutId = setTimeout(() => {
      ws.close()
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)

    const ws = new WebSocket(wsUrl.toString())
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      // Send stdin if provided
      if (options?.stdin) {
        const encoder = new TextEncoder()
        ws.send(encoder.encode(options.stdin))
      }
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON control message
        try {
          const msg = JSON.parse(event.data) as ControlMessage
          if (msg.type === 'exit') {
            output.exitCode = msg.code
            clearTimeout(timeoutId)
            ws.close()
            resolve(output)
          } else if (msg.type === 'error') {
            output.error = msg.message
          }
        } catch {
          // Ignore parse errors
        }
      } else {
        // Binary output
        const bytes = new Uint8Array(event.data)
        const { streamId, payload } = unpack(bytes)
        const text = new TextDecoder().decode(payload)

        if (streamId === STREAM_STDOUT) {
          output.stdout += text
        } else if (streamId === STREAM_STDERR) {
          output.stderr += text
        }
      }
    }

    ws.onerror = (error) => {
      clearTimeout(timeoutId)
      reject(new Error(`WebSocket error: ${error}`))
    }

    ws.onclose = () => {
      clearTimeout(timeoutId)
      if (output.exitCode === null && output.error === null) {
        output.exitCode = 0 // Assume success if no exit message received
      }
      resolve(output)
    }
  })
}

/**
 * Check if sandbox credentials are available
 */
export function hasSandboxCredentials(): boolean {
  return !!WORKER_ACCESS_TOKEN
}

/**
 * Get the worker base URL
 */
export function getWorkerBaseUrl(): string {
  return WORKER_BASE_URL
}
