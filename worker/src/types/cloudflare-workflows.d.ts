/**
 * Type declarations for Cloudflare Workflows
 * See: https://developers.cloudflare.com/workflows/
 */

declare module 'cloudflare:workflows' {
  /**
   * Base class for Cloudflare Workflows
   */
  export class Workflow<Env = any, Params = any> {
    /**
     * Environment bindings
     */
    protected env: Env

    /**
     * Workflow execution entry point
     * @param event - The workflow event that triggered execution
     * @param step - Workflow step API for durable operations
     */
    run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<void>
  }

  /**
   * Workflow event payload
   */
  export interface WorkflowEvent<T = any> {
    /**
     * Workflow event payload
     */
    payload: T

    /**
     * Event timestamp
     */
    timestamp: Date
  }

  /**
   * Workflow step API for durable operations
   */
  export interface WorkflowStep {
    /**
     * Execute a durable step with automatic retries
     *
     * If the function throws, the step will be retried with exponential backoff.
     * Once the step completes successfully, it will not be re-executed even if
     * the workflow restarts.
     *
     * @param name - Unique name for this step (used for resumption)
     * @param fn - The function to execute
     * @returns The result of the function
     */
    do<T>(name: string, fn: () => Promise<T>): Promise<T>

    /**
     * Wait for an external event
     *
     * Pauses workflow execution until the specified event is received or timeout expires.
     * The workflow can be resumed at any time by sending the event via the Workflows API.
     *
     * @param eventName - Unique event name to wait for
     * @param options - Wait options
     * @returns The event data when received
     */
    waitForEvent<T = unknown>(
      eventName: string,
      options?: {
        /**
         * Maximum time to wait (e.g., '7d', '1h', '30m')
         */
        timeout?: string
        /**
         * Error to throw if timeout is reached
         */
        timeoutError?: Error
      }
    ): Promise<T>

    /**
     * Sleep for a duration
     *
     * @param duration - Duration to sleep (e.g., '1h', '30m', '10s')
     */
    sleep(duration: string): Promise<void>
  }
}
