/**
 * Wait for a condition to be met by polling at regular intervals
 *
 * @param predicate - Async function that returns truthy when condition is met
 * @param options - Configuration options
 * @returns The truthy result from the predicate
 * @throws Error if timeout is reached before condition is met
 */
export async function waitFor<T>(
  predicate: () => Promise<T>,
  options: {
    timeout?: number
    interval?: number
    description?: string
  } = {}
): Promise<T> {
  const { timeout = 10000, interval = 500, description = 'condition to be met' } = options

  const startTime = Date.now()
  let lastError: Error | undefined

  while (Date.now() - startTime < timeout) {
    try {
      const result = await predicate()
      if (result) {
        return result
      }
    } catch (error) {
      // Store error but continue polling
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  // Timeout reached
  const elapsed = Date.now() - startTime
  const errorMessage = lastError
    ? `\n  Last error: ${lastError.message}`
    : ''

  throw new Error(
    `Timeout waiting for ${description} after ${elapsed}ms${errorMessage}`
  )
}
