/**
 * Retry Utilities for Cloudflare Workflows
 *
 * Provides exponential backoff retry logic with jitter for handling transient failures.
 * Designed to work with Cloudflare Workflows' step.do() and custom error handling.
 *
 * Features:
 * - Exponential backoff with jitter (base 1s, max 30s)
 * - Detection of transient failures (network, rate limits, server errors)
 * - Configurable retry attempts and delays
 * - Logging of retry attempts with attempt number and delay
 */

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number

  /** Base delay in milliseconds for exponential backoff (default: 1000ms) */
  baseDelay?: number

  /** Maximum delay in milliseconds (default: 30000ms) */
  maxDelay?: number

  /** Jitter factor 0-1 to randomize delays (default: 0.3) */
  jitterFactor?: number

  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean

  /** Optional logger prefix for retry logs */
  logPrefix?: string
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'isRetryable' | 'logPrefix'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Error types that indicate transient failures worth retrying
 */
export type TransientErrorType =
  | 'network'      // Network connectivity issues
  | 'rate_limit'   // HTTP 429 Too Many Requests
  | 'server_error' // HTTP 5xx errors
  | 'timeout'      // Request timeout
  | 'unavailable'  // Service unavailable

/**
 * Extended error with retry metadata
 */
export interface RetryableError extends Error {
  retryable: boolean
  errorType?: TransientErrorType
  statusCode?: number
  retryAfter?: number // Seconds to wait before retry (from Retry-After header)
}

/**
 * Detect if an error is a transient failure that should be retried
 */
export function isTransientError(error: unknown): { retryable: boolean; errorType?: TransientErrorType; retryAfter?: number } {
  // Handle HTTP Response objects (from fetch)
  if (error instanceof Response || (error && typeof error === 'object' && 'status' in error)) {
    const response = error as Response
    const status = response.status

    // Rate limit (429)
    if (status === 429) {
      const retryAfterHeader = response.headers?.get?.('Retry-After')
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined
      return { retryable: true, errorType: 'rate_limit', retryAfter }
    }

    // Server errors (5xx)
    if (status >= 500 && status < 600) {
      return { retryable: true, errorType: 'server_error' }
    }

    // Service unavailable
    if (status === 503) {
      return { retryable: true, errorType: 'unavailable' }
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Network errors
    if (
      name === 'typeerror' && message.includes('failed to fetch') ||
      name === 'networkerror' ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    ) {
      return { retryable: true, errorType: 'network' }
    }

    // Timeout errors
    if (
      name === 'aborterror' ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('aborted')
    ) {
      return { retryable: true, errorType: 'timeout' }
    }

    // Rate limit errors in message
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return { retryable: true, errorType: 'rate_limit' }
    }

    // Server error codes in message
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('bad gateway') ||
      message.includes('service unavailable') ||
      message.includes('gateway timeout')
    ) {
      return { retryable: true, errorType: 'server_error' }
    }

    // Check for retryable property (RetryableError)
    if ('retryable' in error && (error as RetryableError).retryable) {
      return {
        retryable: true,
        errorType: (error as RetryableError).errorType,
        retryAfter: (error as RetryableError).retryAfter,
      }
    }
  }

  // Check plain objects with status codes
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>

    // Check for status/statusCode properties
    const status = obj.status || obj.statusCode
    if (typeof status === 'number') {
      if (status === 429) {
        return { retryable: true, errorType: 'rate_limit' }
      }
      if (status >= 500 && status < 600) {
        return { retryable: true, errorType: 'server_error' }
      }
    }
  }

  // Not retryable by default
  return { retryable: false }
}

/**
 * Create a retryable error with metadata
 */
export function createRetryableError(
  message: string,
  errorType: TransientErrorType,
  options?: { statusCode?: number; retryAfter?: number; cause?: Error }
): RetryableError {
  const error = new Error(message) as RetryableError
  error.retryable = true
  error.errorType = errorType
  error.statusCode = options?.statusCode
  error.retryAfter = options?.retryAfter
  if (options?.cause) {
    error.cause = options.cause
  }
  return error
}

// ============================================================================
// Delay Calculation
// ============================================================================

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt * (1 + random * jitter))
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Pick<Required<RetryConfig>, 'baseDelay' | 'maxDelay' | 'jitterFactor'>
): number {
  const { baseDelay, maxDelay, jitterFactor } = config

  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)

  // Add jitter: multiply by (1 - jitter/2) to (1 + jitter/2)
  const jitter = 1 + (Math.random() - 0.5) * jitterFactor

  // Apply jitter and cap at maxDelay
  return Math.min(maxDelay, Math.floor(exponentialDelay * jitter))
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Retry Wrapper
// ============================================================================

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean
  value?: T
  error?: Error
  attempts: number
  totalDelayMs: number
}

/**
 * Execute a function with automatic retry on transient failures
 *
 * @example
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, logPrefix: '[MyWorkflow]' }
 * )
 *
 * if (!result.success) {
 *   throw result.error
 * }
 *
 * return result.value
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_CONFIG.maxRetries,
    baseDelay = DEFAULT_CONFIG.baseDelay,
    maxDelay = DEFAULT_CONFIG.maxDelay,
    jitterFactor = DEFAULT_CONFIG.jitterFactor,
    isRetryable,
    logPrefix = '[Retry]',
  } = config

  let attempts = 0
  let totalDelayMs = 0
  let lastError: Error | undefined

  while (attempts <= maxRetries) {
    try {
      const value = await fn()
      return {
        success: true,
        value,
        attempts: attempts + 1,
        totalDelayMs,
      }
    } catch (error) {
      attempts++
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if error is retryable
      const customRetryable = isRetryable?.(error)
      const { retryable: defaultRetryable, errorType, retryAfter } = isTransientError(error)
      const shouldRetry = customRetryable ?? defaultRetryable

      // If not retryable or out of retries, return failure
      if (!shouldRetry || attempts > maxRetries) {
        console.log(
          `${logPrefix} Failed after ${attempts} attempt(s): ${lastError.message}` +
          (errorType ? ` [${errorType}]` : '')
        )
        return {
          success: false,
          error: lastError,
          attempts,
          totalDelayMs,
        }
      }

      // Calculate delay (prefer Retry-After header if available)
      let delayMs: number
      if (retryAfter && retryAfter > 0) {
        delayMs = Math.min(retryAfter * 1000, maxDelay)
      } else {
        delayMs = calculateBackoffDelay(attempts - 1, { baseDelay, maxDelay, jitterFactor })
      }

      console.log(
        `${logPrefix} Attempt ${attempts}/${maxRetries + 1} failed` +
        (errorType ? ` [${errorType}]` : '') +
        `: ${lastError.message}. Retrying in ${delayMs}ms...`
      )

      totalDelayMs += delayMs
      await sleep(delayMs)
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts,
    totalDelayMs,
  }
}

// ============================================================================
// Workflow Step Retry Wrapper
// ============================================================================

/**
 * Wrap a Cloudflare Workflow step.do() call with retry logic
 *
 * This is designed to work with Cloudflare Workflows' step.do() method.
 * It handles the step execution and applies retry logic for transient failures.
 *
 * @example
 * // In a workflow:
 * const result = await retryStep(
 *   step,
 *   'fetch-external-data',
 *   async () => {
 *     const response = await fetch('https://api.example.com/data')
 *     if (!response.ok) {
 *       throw createRetryableError(
 *         `API error: ${response.status}`,
 *         response.status >= 500 ? 'server_error' : 'rate_limit',
 *         { statusCode: response.status }
 *       )
 *     }
 *     return response.json()
 *   },
 *   { logPrefix: '[MyWorkflow]' }
 * )
 */
export async function retryStep<T>(
  step: { do: <R>(name: string, fn: () => Promise<R>) => Promise<R> },
  stepName: string,
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_CONFIG.maxRetries,
    logPrefix = `[${stepName}]`,
  } = config

  // Execute within step.do() for durability
  return step.do(`${stepName}-with-retry`, async () => {
    const result = await withRetry(fn, { ...config, maxRetries, logPrefix })

    if (!result.success) {
      throw result.error
    }

    return result.value!
  })
}

// ============================================================================
// Fetch with Retry
// ============================================================================

/**
 * Fetch with automatic retry for transient failures
 *
 * Wraps the standard fetch() with retry logic, automatically detecting
 * rate limits, server errors, and network failures.
 *
 * @example
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ key: 'value' }),
 * }, { logPrefix: '[API]' })
 */
export async function fetchWithRetry(
  url: string | URL | Request,
  init?: RequestInit,
  config: RetryConfig = {}
): Promise<Response> {
  const result = await withRetry(async () => {
    const response = await fetch(url, init)

    // Treat certain status codes as errors for retry
    if (response.status === 429 || response.status >= 500) {
      const retryAfterHeader = response.headers.get('Retry-After')
      throw createRetryableError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status === 429 ? 'rate_limit' : 'server_error',
        {
          statusCode: response.status,
          retryAfter: retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined,
        }
      )
    }

    return response
  }, config)

  if (!result.success) {
    throw result.error
  }

  return result.value!
}

// ============================================================================
// Cloudflare Workflow retryConfig Helper
// ============================================================================

/**
 * Generate Cloudflare Workflow step retry configuration
 *
 * Cloudflare Workflows support built-in retries via step options.
 * This helper generates a compatible configuration object.
 *
 * @example
 * await step.do('my-step', {
 *   retries: cfRetryConfig({ maxRetries: 5 }),
 * }, async () => {
 *   // step logic
 * })
 */
export function cfRetryConfig(config: RetryConfig = {}): {
  limit: number
  delay: string
  backoff: 'exponential' | 'linear' | 'constant'
} {
  const { maxRetries = DEFAULT_CONFIG.maxRetries, baseDelay = DEFAULT_CONFIG.baseDelay } = config

  return {
    limit: maxRetries,
    delay: `${baseDelay}ms`,
    backoff: 'exponential',
  }
}
