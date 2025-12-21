import type { Env } from '../types'

/**
 * Base class for Durable Objects that persist state via worker RPC.
 * Subclasses should override doType and ref.
 */
export abstract class StatefulDO {
  protected state: DurableObjectState
  protected env: Env
  protected machineState: any = null

  // Subclasses must define
  protected abstract readonly doType: 'org' | 'repo' | 'project' | 'pr' | 'issue'
  protected abstract readonly ref: string

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  /**
   * Persist state to D1 via worker RPC with steep logarithmic backoff.
   * Retries up to 10 times with delays: 100ms, 200ms, 400ms, 800ms, ...
   */
  protected async persistToD1(maxRetries = 10): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.env.WORKER.persistDOState({
          doId: this.state.id.toString(),
          type: this.doType,
          ref: this.ref,
          state: this.machineState,
        })

        if (result.success) return
        throw new Error(result.error || 'Unknown persistence error')
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`[${this.doType}] Failed to persist after ${maxRetries} attempts:`, error)
          throw error
        }

        // Steep logarithmic backoff: 100ms * 2^attempt (capped at 100s)
        const delayMs = Math.min(100 * Math.pow(2, attempt), 100_000)
        await this.sleep(delayMs)
      }
    }
  }

  /**
   * Called on every XState transition to persist state.
   */
  protected onTransition(newState: any): void {
    this.machineState = newState

    // Persist to DO storage (sync, fast)
    this.state.storage.put('machineState', newState)

    // Persist to D1 via RPC (async, with retry)
    this.state.waitUntil(this.persistToD1())
  }

  /**
   * Load persisted state on DO startup.
   */
  protected async loadState(): Promise<any> {
    return this.state.storage.get('machineState')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
