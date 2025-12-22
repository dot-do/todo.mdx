/**
 * Stdio WebSocket Test Helper
 *
 * Helpers for testing the sandbox stdio WebSocket API.
 * Uses the binary protocol from @todo.mdx/sandbox.
 * Authentication via TEST_API_KEY env var.
 */

/**
 * Get authentication token (reads env at call time for dotenv support)
 */
function getAuthToken(): string | null {
  return process.env.TEST_API_KEY || null
}

function getWorkerBaseUrl(): string {
  return process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
}

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

export interface EofMessage {
  type: 'eof'
}

export type ControlMessage = ResizeMessage | SignalMessage | ExitMessage | ErrorMessage | EofMessage

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
  const token = getAuthToken()
  if (!token) {
    throw new Error('Authentication required - set TEST_API_KEY')
  }

  const response = await fetch(`${getWorkerBaseUrl()}/api/stdio/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
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
  const token = getAuthToken()
  if (!token) {
    throw new Error('Authentication required - set TEST_API_KEY')
  }

  const response = await fetch(`${getWorkerBaseUrl()}/api/stdio/${sandboxId}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
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
  const token = getAuthToken()
  if (!token) {
    throw new Error('Authentication required - set TEST_API_KEY')
  }

  const response = await fetch(`${getWorkerBaseUrl()}/api/stdio/${sandboxId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
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
 * Control functions available during command execution
 */
export interface CommandControls {
  /**
   * Send a signal to the process (e.g., 'SIGINT', 'SIGTERM')
   */
  sendSignal: (signal: string) => void
  /**
   * Send EOF to close stdin, signaling end of input to the process
   */
  sendEof: () => void
  /**
   * Send stdin data to the process
   */
  sendStdin: (data: string) => void
}

/**
 * Options for running a command with signal support
 */
export interface RunCommandWithSignalOptions {
  stdin?: string
  timeout?: number
  token?: string
  env?: Record<string, string>
  /**
   * Callback to receive the sendSignal function.
   * Called once WebSocket is connected and before command completes.
   * @deprecated Use onConnected with controls.sendSignal instead
   */
  onConnected?: (sendSignal: (signal: string) => void) => void
  /**
   * Delay in ms before sending the signal (for onConnected)
   */
  signalDelay?: number
}

/**
 * Options for running a command with full control (stdin, signals, EOF)
 */
export interface RunCommandWithControlsOptions {
  stdin?: string
  timeout?: number
  token?: string
  env?: Record<string, string>
  /**
   * Callback to receive control functions.
   * Called once WebSocket is connected and before command completes.
   */
  onConnected?: (controls: CommandControls) => void
  /**
   * Delay in ms before invoking onConnected callback
   */
  connectDelay?: number
}

/**
 * Internal function to connect WebSocket and run command
 */
async function runCommandInternal(
  sandboxId: string,
  cmd: string,
  args: string[] = [],
  options?: {
    stdin?: string
    timeout?: number
    token?: string
    env?: Record<string, string>
  }
): Promise<SessionOutput> {
  const token = options?.token || getAuthToken()
  if (!token) {
    throw new Error('Authentication required - set TEST_API_KEY')
  }
  const timeout = options?.timeout || 30000

  // Build WebSocket URL
  const wsProtocol = getWorkerBaseUrl().startsWith('https') ? 'wss' : 'ws'
  const wsHost = getWorkerBaseUrl().replace(/^https?:\/\//, '')
  const wsUrl = new URL(`${wsProtocol}://${wsHost}/api/stdio/${sandboxId}`)
  wsUrl.searchParams.set('cmd', cmd)
  wsUrl.searchParams.set('token', token!)
  for (const arg of args) {
    wsUrl.searchParams.append('arg', arg)
  }
  // Pass environment variables as env_NAME=value query params
  if (options?.env) {
    for (const [key, value] of Object.entries(options.env)) {
      wsUrl.searchParams.set(`env_${key}`, value)
    }
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

    ws.onerror = (event: Event) => {
      clearTimeout(timeoutId)
      // ErrorEvent has limited info in browsers/Node; try to extract what's available
      const errorEvent = event as ErrorEvent
      const message = errorEvent.message || errorEvent.error?.message || 'Unknown WebSocket error'
      reject(new Error(`WebSocket error: ${message} (type: ${event.type})`))
    }

    ws.onclose = (event: CloseEvent) => {
      clearTimeout(timeoutId)
      if (output.exitCode === null && output.error === null) {
        // Check if close was abnormal
        if (event.code !== 1000 && event.code !== 1005) {
          output.error = `WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`
        }
        output.exitCode = 0 // Assume success if no exit message received
      }
      resolve(output)
    }
  })
}

/**
 * Connect to a sandbox session and run a command
 * Includes retry logic with session recreation on connection failure
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
    retries?: number
    env?: Record<string, string>
  }
): Promise<SessionOutput> {
  const maxRetries = options?.retries ?? 1

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await runCommandInternal(sandboxId, cmd, args, options)
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      const isConnectionError = error instanceof Error &&
        (error.message.includes('WebSocket error') ||
         error.message.includes('non-101'))

      if (isLastAttempt || !isConnectionError) {
        throw error
      }

      // Wait a moment before retry
      await new Promise(resolve => setTimeout(resolve, 500))

      // Try to recreate the session before retrying
      try {
        await createSession({ sandboxId })
      } catch {
        // Ignore session recreation errors - it might already exist
      }
    }
  }

  throw new Error('Unreachable')
}

/**
 * Run command with ability to send signals during execution.
 * Similar to runCommand but provides a sendSignal callback.
 *
 * @param sandboxId - The sandbox session ID
 * @param cmd - Command to run
 * @param args - Command arguments
 * @param options - Additional options including signal callback
 * @returns Session output (stdout, stderr, exitCode)
 */
export async function runCommandWithSignal(
  sandboxId: string,
  cmd: string,
  args: string[] = [],
  options: RunCommandWithSignalOptions = {}
): Promise<SessionOutput> {
  const token = options?.token || getAuthToken()
  if (!token) {
    throw new Error('Authentication required - set TEST_API_KEY')
  }
  const timeout = options?.timeout || 30000

  // Build WebSocket URL
  const wsProtocol = getWorkerBaseUrl().startsWith('https') ? 'wss' : 'ws'
  const wsHost = getWorkerBaseUrl().replace(/^https?:\/\//, '')
  const wsUrl = new URL(`${wsProtocol}://${wsHost}/api/stdio/${sandboxId}`)
  wsUrl.searchParams.set('cmd', cmd)
  wsUrl.searchParams.set('token', token!)
  for (const arg of args) {
    wsUrl.searchParams.append('arg', arg)
  }
  // Pass environment variables as env_NAME=value query params
  if (options?.env) {
    for (const [key, value] of Object.entries(options.env)) {
      wsUrl.searchParams.set(`env_${key}`, value)
    }
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

    // Signal sending function
    const sendSignal = (signal: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        const msg: SignalMessage = { type: 'signal', signal }
        ws.send(JSON.stringify(msg))
      }
    }

    ws.onopen = () => {
      // Send stdin if provided
      if (options?.stdin) {
        const encoder = new TextEncoder()
        ws.send(encoder.encode(options.stdin))
      }

      // Invoke callback with signal function after optional delay
      if (options?.onConnected) {
        const delay = options.signalDelay ?? 0
        if (delay > 0) {
          setTimeout(() => options.onConnected!(sendSignal), delay)
        } else {
          options.onConnected(sendSignal)
        }
      }
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON control message
        try {
          const msg = JSON.parse(event.data) as ControlMessage
          if (msg.type === 'exit') {
            output.exitCode = (msg as ExitMessage).code
            clearTimeout(timeoutId)
            ws.close()
            resolve(output)
          } else if (msg.type === 'error') {
            output.error = (msg as ErrorMessage).message
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

    ws.onerror = (event: Event) => {
      clearTimeout(timeoutId)
      const errorEvent = event as ErrorEvent
      const message = errorEvent.message || errorEvent.error?.message || 'Unknown WebSocket error'
      reject(new Error(`WebSocket error: ${message} (type: ${event.type})`))
    }

    ws.onclose = (event: CloseEvent) => {
      clearTimeout(timeoutId)
      if (output.exitCode === null && output.error === null) {
        // Check if close was abnormal
        if (event.code !== 1000 && event.code !== 1005) {
          output.error = `WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`
        }
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
  return !!process.env.TEST_API_KEY
}

/**
 * Run command with full control over stdin, signals, and EOF.
 * Provides a controls object with sendSignal, sendEof, and sendStdin functions.
 *
 * @param sandboxId - The sandbox session ID
 * @param cmd - Command to run
 * @param args - Command arguments
 * @param options - Additional options including control callback
 * @returns Session output (stdout, stderr, exitCode)
 */
export async function runCommandWithControls(
  sandboxId: string,
  cmd: string,
  args: string[] = [],
  options: RunCommandWithControlsOptions = {}
): Promise<SessionOutput> {
  const token = options?.token || getAuthToken()
  if (!token) {
    throw new Error('Authentication required - set TEST_API_KEY')
  }
  const timeout = options?.timeout || 30000

  // Build WebSocket URL
  const wsProtocol = getWorkerBaseUrl().startsWith('https') ? 'wss' : 'ws'
  const wsHost = getWorkerBaseUrl().replace(/^https?:\/\//, '')
  const wsUrl = new URL(`${wsProtocol}://${wsHost}/api/stdio/${sandboxId}`)
  wsUrl.searchParams.set('cmd', cmd)
  wsUrl.searchParams.set('token', token!)
  for (const arg of args) {
    wsUrl.searchParams.append('arg', arg)
  }
  // Pass environment variables as env_NAME=value query params
  if (options?.env) {
    for (const [key, value] of Object.entries(options.env)) {
      wsUrl.searchParams.set(`env_${key}`, value)
    }
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
    const encoder = new TextEncoder()

    // Control functions
    const controls: CommandControls = {
      sendSignal: (signal: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg: SignalMessage = { type: 'signal', signal }
          ws.send(JSON.stringify(msg))
        }
      },
      sendEof: () => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg: EofMessage = { type: 'eof' }
          ws.send(JSON.stringify(msg))
        }
      },
      sendStdin: (data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(data))
        }
      },
    }

    ws.onopen = () => {
      // Send initial stdin if provided
      if (options?.stdin) {
        ws.send(encoder.encode(options.stdin))
      }

      // Invoke callback with control functions after optional delay
      if (options?.onConnected) {
        const delay = options.connectDelay ?? 0
        if (delay > 0) {
          setTimeout(() => options.onConnected!(controls), delay)
        } else {
          options.onConnected(controls)
        }
      }
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON control message
        try {
          const msg = JSON.parse(event.data) as ControlMessage
          if (msg.type === 'exit') {
            output.exitCode = (msg as ExitMessage).code
            clearTimeout(timeoutId)
            ws.close()
            resolve(output)
          } else if (msg.type === 'error') {
            output.error = (msg as ErrorMessage).message
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

    ws.onerror = (event: Event) => {
      clearTimeout(timeoutId)
      const errorEvent = event as ErrorEvent
      const message = errorEvent.message || errorEvent.error?.message || 'Unknown WebSocket error'
      reject(new Error(`WebSocket error: ${message} (type: ${event.type})`))
    }

    ws.onclose = (event: CloseEvent) => {
      clearTimeout(timeoutId)
      if (output.exitCode === null && output.error === null) {
        // Check if close was abnormal
        if (event.code !== 1000 && event.code !== 1005) {
          output.error = `WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`
        }
        output.exitCode = 0 // Assume success if no exit message received
      }
      resolve(output)
    }
  })
}

/**
 * Create a session with retry logic and exponential backoff for rate limits.
 * Useful for tests that create multiple sessions which may hit rate limits.
 *
 * @param options - Session creation options
 * @param retryOptions - Retry configuration
 * @returns Session info or throws after max retries
 */
export async function createSessionWithRetry(
  options?: {
    sandboxId?: string
    repo?: string
    installationId?: number
  },
  retryOptions?: {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
  }
): Promise<{
  sandboxId: string
  wsUrl: string
  expiresIn: number
}> {
  const maxRetries = retryOptions?.maxRetries ?? 3
  const initialDelayMs = retryOptions?.initialDelayMs ?? 1000
  const maxDelayMs = retryOptions?.maxDelayMs ?? 10000

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await createSession(options)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a rate limit error (429) or server error (5xx)
      const isRetryable =
        lastError.message.includes('429') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('503') ||
        lastError.message.includes('502')

      if (!isRetryable || attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff with jitter
      const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs)
      const jitter = Math.random() * 0.3 * baseDelay // 0-30% jitter
      const delay = baseDelay + jitter

      console.log(`Session creation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Failed to create session after retries')
}

// Export getWorkerBaseUrl for test output
export { getWorkerBaseUrl }
