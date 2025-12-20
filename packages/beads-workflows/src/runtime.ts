/**
 * WorkflowRuntime
 *
 * Unified runtime that connects:
 * - BeadsWatcher (monitors .beads/ for changes)
 * - WorkflowEventEmitter (emits typed events)
 * - Compiled workflow handlers (executes on events)
 *
 * Usage:
 *   const runtime = await createRuntime('/path/to/project')
 *   await runtime.start()
 *   // ... runtime watches for changes and executes workflows
 *   await runtime.stop()
 */

import { join } from 'node:path'
import type {
  BeadsIssue,
  IssueReadyEvent,
  IssueBlockedEvent,
  IssueClosedEvent,
  IssueCreatedEvent,
  IssueUpdatedEvent,
  IssueReopenedEvent,
  EpicCompletedEvent,
  EpicProgressEvent,
} from './types.js'
import { WorkflowEventEmitter } from './events.js'
import { BeadsWatcher, type WatcherOptions } from './watcher.js'
import { findBeadsDir } from './beads.js'
import { loadWorkflows, findWorkflowsDir } from './parser.js'
import {
  compileWorkflows,
  createHandlerRegistry,
  type WorkflowHandlers,
  type CompiledWorkflow,
} from './compiler.js'

export interface RuntimeOptions extends WatcherOptions {
  /** Custom path to .beads directory (auto-detected if not provided) */
  beadsDir?: string
  /** Custom path to .workflows directory (auto-detected if not provided) */
  workflowsDir?: string
  /** Whether to load and compile workflows on start (default: true) */
  loadWorkflows?: boolean
  /** Log handler execution (default: false) */
  verbose?: boolean
}

export interface WorkflowRuntime {
  /** Start the runtime (watcher + event handlers) */
  start(): Promise<void>
  /** Stop the runtime */
  stop(): Promise<void>
  /** Check if runtime is running */
  isRunning(): boolean
  /** Get the event emitter for manual event subscription */
  readonly emitter: WorkflowEventEmitter
  /** Get the handler registry for inspection */
  readonly handlers: WorkflowHandlers
  /** Get compiled workflows for inspection */
  readonly workflows: CompiledWorkflow[]
  /** Manually trigger a reload of workflows */
  reloadWorkflows(): Promise<void>
}

/**
 * Execute a compiled workflow source and register handlers
 */
function executeWorkflow(
  compiled: CompiledWorkflow,
  handlers: WorkflowHandlers,
  verbose: boolean
): void {
  if (!compiled.success) {
    if (verbose) {
      console.warn(
        `[beads-workflows] Skipping ${compiled.name}: compilation failed`,
        compiled.errors
      )
    }
    return
  }

  try {
    // Create the function from compiled source
    const fn = new Function('handlers', compiled.source)
    // Execute to register handlers
    fn(handlers)

    if (verbose) {
      console.log(`[beads-workflows] Loaded workflow: ${compiled.name}`)
    }
  } catch (error) {
    if (verbose) {
      console.error(
        `[beads-workflows] Failed to execute ${compiled.name}:`,
        error
      )
    }
  }
}

/**
 * Connect event emitter to handler registry
 */
function connectHandlers(
  emitter: WorkflowEventEmitter,
  handlers: WorkflowHandlers,
  verbose: boolean
): void {
  // Issue handlers
  emitter.on('issue.created', async (event: IssueCreatedEvent) => {
    for (const handler of handlers.issue.created) {
      try {
        await handler(event.issue)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] issue.created handler error:', error)
      }
    }
  })

  emitter.on('issue.updated', async (event: IssueUpdatedEvent) => {
    for (const handler of handlers.issue.updated) {
      try {
        await handler(event.issue, event.changes)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] issue.updated handler error:', error)
      }
    }
  })

  emitter.on('issue.ready', async (event: IssueReadyEvent) => {
    for (const handler of handlers.issue.ready) {
      try {
        await handler(event.issue)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] issue.ready handler error:', error)
      }
    }
  })

  emitter.on('issue.blocked', async (event: IssueBlockedEvent) => {
    for (const handler of handlers.issue.blocked) {
      try {
        await handler(event.issue, event.blockedBy)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] issue.blocked handler error:', error)
      }
    }
  })

  emitter.on('issue.closed', async (event: IssueClosedEvent) => {
    for (const handler of handlers.issue.closed) {
      try {
        await handler(event.issue)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] issue.closed handler error:', error)
      }
    }
  })

  emitter.on('issue.reopened', async (event: IssueReopenedEvent) => {
    for (const handler of handlers.issue.reopened) {
      try {
        await handler(event.issue)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] issue.reopened handler error:', error)
      }
    }
  })

  // Epic handlers
  emitter.on('epic.completed', async (event: EpicCompletedEvent) => {
    for (const handler of handlers.epic.completed) {
      try {
        await handler(event.issue)
      } catch (error) {
        if (verbose) console.error('[beads-workflows] epic.completed handler error:', error)
      }
    }
  })

  emitter.on('epic.progress', async (event: EpicProgressEvent) => {
    for (const handler of handlers.epic.progress) {
      try {
        await handler(event.issue, {
          completed: event.completed,
          total: event.total,
          percentage: event.percentage,
        })
      } catch (error) {
        if (verbose) console.error('[beads-workflows] epic.progress handler error:', error)
      }
    }
  })
}

/**
 * Create a workflow runtime
 */
export async function createRuntime(
  projectDir: string,
  options: RuntimeOptions = {}
): Promise<WorkflowRuntime> {
  const verbose = options.verbose ?? false
  const shouldLoadWorkflows = options.loadWorkflows ?? true

  // Find beads directory
  const beadsDir = options.beadsDir ?? (await findBeadsDir(projectDir))
  if (!beadsDir) {
    throw new Error(
      `No .beads directory found in ${projectDir} or parent directories`
    )
  }

  // Create emitter and handler registry
  const emitter = new WorkflowEventEmitter()
  const handlers = createHandlerRegistry()
  let compiledWorkflows: CompiledWorkflow[] = []

  // Create watcher
  const watcher = new BeadsWatcher(beadsDir, emitter, {
    debounceMs: options.debounceMs,
  })

  // Load and compile workflows
  async function loadAndCompileWorkflows(): Promise<void> {
    if (!shouldLoadWorkflows) return

    const workflowsDir = options.workflowsDir ?? await findWorkflowsDir(projectDir)
    if (!workflowsDir) {
      if (verbose) {
        console.log('[beads-workflows] No .workflows directory found')
      }
      return
    }

    try {
      const parsed = await loadWorkflows(workflowsDir)
      compiledWorkflows = compileWorkflows(parsed)

      // Clear existing handlers
      Object.assign(handlers.issue, createHandlerRegistry().issue)
      Object.assign(handlers.epic, createHandlerRegistry().epic)
      Object.assign(handlers.schedule, createHandlerRegistry().schedule)

      // Execute compiled workflows to register handlers
      for (const compiled of compiledWorkflows) {
        executeWorkflow(compiled, handlers, verbose)
      }

      if (verbose) {
        const total = compiledWorkflows.length
        const successful = compiledWorkflows.filter((w) => w.success).length
        console.log(
          `[beads-workflows] Loaded ${successful}/${total} workflows`
        )
      }
    } catch (error) {
      if (verbose) {
        console.error('[beads-workflows] Failed to load workflows:', error)
      }
    }
  }

  // Connect handlers to emitter
  connectHandlers(emitter, handlers, verbose)

  let running = false

  return {
    emitter,
    handlers,

    get workflows(): CompiledWorkflow[] {
      return compiledWorkflows
    },

    async start(): Promise<void> {
      if (running) return

      await loadAndCompileWorkflows()
      await watcher.start()
      running = true

      if (verbose) {
        console.log(`[beads-workflows] Runtime started, watching ${beadsDir}`)
      }
    },

    async stop(): Promise<void> {
      if (!running) return

      watcher.stop()
      running = false

      if (verbose) {
        console.log('[beads-workflows] Runtime stopped')
      }
    },

    isRunning(): boolean {
      return running
    },

    async reloadWorkflows(): Promise<void> {
      await loadAndCompileWorkflows()
    },
  }
}

/**
 * Create a minimal runtime with just the watcher and emitter
 * Useful when you want to register handlers programmatically
 */
export async function createMinimalRuntime(
  projectDir: string,
  options: Omit<RuntimeOptions, 'loadWorkflows' | 'workflowsDir'> = {}
): Promise<{
  emitter: WorkflowEventEmitter
  watcher: BeadsWatcher
  start: () => Promise<void>
  stop: () => void
}> {
  const beadsDir = options.beadsDir ?? (await findBeadsDir(projectDir))
  if (!beadsDir) {
    throw new Error(
      `No .beads directory found in ${projectDir} or parent directories`
    )
  }

  const emitter = new WorkflowEventEmitter()
  const watcher = new BeadsWatcher(beadsDir, emitter, {
    debounceMs: options.debounceMs,
  })

  return {
    emitter,
    watcher,
    start: () => watcher.start(),
    stop: () => watcher.stop(),
  }
}
