/**
 * Type declarations for beads-workflows (optional peer dependency)
 */

declare module 'beads-workflows' {
  export interface BeadsWatcherOptions {
    debounceMs?: number
  }

  export interface BeadsWatcher {
    on(event: 'issue', handler: (event: any) => void): void
    on(event: 'error', handler: (error: any) => void): void
    start(): Promise<void>
    stop(): Promise<void>
  }

  export function createWatcher(dir: string, opts?: BeadsWatcherOptions): BeadsWatcher
}
