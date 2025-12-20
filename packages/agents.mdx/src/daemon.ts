/**
 * Workflow Daemon - Watches .workflows/*.mdx and beads events
 *
 * Monitors:
 * 1. File changes in .workflows/ directory (hot reload)
 * 2. Beads issue events (via beads-workflows watcher)
 * 3. Executes matching workflow handlers
 */

import { watch } from 'node:fs'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { FSWatcher } from 'node:fs'

import { loadWorkflows, findWorkflowsDir } from './parser'
import { compileWorkflows, executeWorkflow, type CompiledWorkflow, type WorkflowRegistration } from './compiler'
import { createRuntime } from './runtime'
import { localTransport } from './local'
import type { Repo, Issue, WorkflowRuntime } from './types'

// Lazy-load beads-workflows (optional peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeadsWorkflows = any
let beadsWorkflows: BeadsWorkflows | null = null

async function loadBeadsWorkflows(): Promise<BeadsWorkflows | null> {
  if (beadsWorkflows) return beadsWorkflows

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    beadsWorkflows = await import('beads-workflows')
    return beadsWorkflows
  } catch {
    // beads-workflows not installed - daemon will run without event triggers
    return null
  }
}

// Type for beads watcher event (since beads-workflows is optional)
interface BeadsWatcherEvent {
  type: 'created' | 'updated' | 'closed' | 'reopened'
  issue: Issue
  previousIssue?: Issue
}

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Repository context */
  repo: Repo
  /** Workflows directory (defaults to .workflows or workflows) */
  workflowsDir?: string
  /** Beads directory (defaults to .beads) */
  beadsDir?: string
  /** Working directory for CLI commands */
  cwd?: string
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Active workflow registration with compiled handlers
 */
interface ActiveWorkflow {
  name: string
  path: string
  compiled: CompiledWorkflow
  registration: WorkflowRegistration
}

/**
 * Daemon state
 */
interface DaemonState {
  config: DaemonConfig
  runtime: WorkflowRuntime
  workflows: Map<string, ActiveWorkflow>
  workflowsDir: string | null
  fileWatcher: FSWatcher | null
  beadsWatcher: any | null // beads-workflows Watcher type
  running: boolean
}

/**
 * Workflow Daemon
 */
export class WorkflowDaemon {
  private state: DaemonState

  constructor(config: DaemonConfig) {
    this.state = {
      config,
      runtime: createRuntime({
        repo: config.repo,
        transport: localTransport({
          repo: config.repo,
          cwd: config.cwd,
        }),
      }),
      workflows: new Map(),
      workflowsDir: null,
      fileWatcher: null,
      beadsWatcher: null,
      running: false,
    }
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.state.running) {
      throw new Error('Daemon already running')
    }

    this.log('Starting workflow daemon...')

    // Find workflows directory
    const cwd = this.state.config.cwd || process.cwd()
    const workflowsDir = this.state.config.workflowsDir || await findWorkflowsDir(cwd)

    if (!workflowsDir) {
      throw new Error(`No .workflows or workflows directory found in ${cwd}`)
    }

    this.state.workflowsDir = workflowsDir
    this.log(`Watching workflows in: ${workflowsDir}`)

    // Load and compile initial workflows
    await this.reloadWorkflows()

    // Start file watcher
    this.startFileWatcher()

    // Start beads event watcher (if available)
    await this.startBeadsWatcher()

    this.state.running = true
    this.log('Daemon started successfully')
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.state.running) {
      return
    }

    this.log('Stopping workflow daemon...')

    // Stop file watcher
    if (this.state.fileWatcher) {
      this.state.fileWatcher.close()
      this.state.fileWatcher = null
    }

    // Stop beads watcher
    if (this.state.beadsWatcher) {
      await this.state.beadsWatcher.stop()
      this.state.beadsWatcher = null
    }

    this.state.running = false
    this.state.workflows.clear()
    this.log('Daemon stopped')
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return this.state.running
  }

  /**
   * Get list of active workflows
   */
  getWorkflows(): ActiveWorkflow[] {
    return Array.from(this.state.workflows.values())
  }

  /**
   * Reload all workflows from disk
   */
  private async reloadWorkflows(): Promise<void> {
    if (!this.state.workflowsDir) return

    try {
      this.log('Loading workflows...')

      // Parse workflows
      const parsed = await loadWorkflows(this.state.workflowsDir)
      this.log(`Found ${parsed.length} workflow files`)

      // Compile workflows
      const compiled = compileWorkflows(parsed)

      // Clear old workflows
      this.state.workflows.clear()

      // Execute each workflow to get registrations
      for (const comp of compiled) {
        if (!comp.success) {
          console.error(`Compilation failed for ${comp.name}:`)
          for (const error of comp.errors) {
            console.error(`  - ${error.message}`)
          }
          continue
        }

        // Execute workflow to get registration
        const registration = executeWorkflow(comp, this.state.runtime)
        if (!registration) {
          console.error(`Failed to execute workflow ${comp.name}`)
          continue
        }

        // Store active workflow
        this.state.workflows.set(comp.path, {
          name: comp.name,
          path: comp.path,
          compiled: comp,
          registration,
        })

        // Log registered handlers
        this.logWorkflowRegistration(comp.name, registration)
      }

      this.log(`Loaded ${this.state.workflows.size} workflows`)
    } catch (error) {
      console.error('Failed to reload workflows:', error)
    }
  }

  /**
   * Start file watcher for .workflows/*.mdx
   */
  private startFileWatcher(): void {
    if (!this.state.workflowsDir) return

    this.log(`Starting file watcher for ${this.state.workflowsDir}`)

    this.state.fileWatcher = watch(
      this.state.workflowsDir,
      { recursive: false },
      async (eventType, filename) => {
        if (!filename) return
        if (!filename.endsWith('.mdx') && !filename.endsWith('.md')) return

        this.log(`File ${eventType}: ${filename}`)

        // Debounce rapid changes
        await new Promise(resolve => setTimeout(resolve, 100))

        // Reload all workflows
        await this.reloadWorkflows()
      }
    )
  }

  /**
   * Start beads watcher for issue events
   */
  private async startBeadsWatcher(): Promise<void> {
    const beads = await loadBeadsWorkflows()
    if (!beads) {
      this.log('beads-workflows not available - skipping event watcher')
      return
    }

    const beadsDir = this.state.config.beadsDir || join(this.state.config.cwd || process.cwd(), '.beads')
    if (!existsSync(beadsDir)) {
      this.log(`Beads directory not found: ${beadsDir}`)
      return
    }

    this.log(`Starting beads watcher for ${beadsDir}`)

    const watcher = beads.createWatcher(beadsDir, { debounceMs: 500 })

    // Listen for issue events
    watcher.on('issue', async (event: BeadsWatcherEvent) => {
      await this.handleBeadsEvent(event)
    })

    watcher.on('error', (error: Error) => {
      console.error('Beads watcher error:', error)
    })

    await watcher.start()
    this.state.beadsWatcher = watcher

    this.log('Beads watcher started')
  }

  /**
   * Handle beads issue event
   */
  private async handleBeadsEvent(event: BeadsWatcherEvent): Promise<void> {
    const { type, issue, previousIssue } = event

    this.log(`Beads event: ${type} - ${issue.id}`)

    // Map watcher event types to handler keys
    const eventMap: Record<string, keyof WorkflowRegistration['handlers']> = {
      'created': 'issue.created',
      'updated': 'issue.updated',
      'closed': 'issue.closed',
      'reopened': 'issue.updated', // Treat reopen as update
    }

    const handlerKey = eventMap[type]
    if (!handlerKey) {
      this.log(`No handler mapping for event type: ${type}`)
      return
    }

    // Special handling for 'ready' event (when issue becomes unblocked)
    const isReady = type === 'updated' &&
                    previousIssue?.status === 'blocked' &&
                    issue.status === 'open'

    // Execute matching handlers from all workflows
    for (const workflow of this.state.workflows.values()) {
      const handlers = workflow.registration.handlers[handlerKey] || []

      // Also execute 'ready' handlers if applicable
      const readyHandlers = isReady ? (workflow.registration.handlers['issue.ready'] || []) : []
      const allHandlers = [...handlers, ...readyHandlers]

      for (const handler of allHandlers) {
        try {
          this.log(`Executing ${workflow.name}.${handlerKey}`)

          // Update runtime context with current issue
          const runtime = {
            ...this.state.runtime,
            issue,
          }

          await handler(issue, runtime)

          this.log(`Handler completed: ${workflow.name}.${handlerKey}`)
        } catch (error) {
          console.error(`Handler failed: ${workflow.name}.${handlerKey}`, error)
        }
      }
    }
  }

  /**
   * Log workflow registration details
   */
  private logWorkflowRegistration(name: string, registration: WorkflowRegistration): void {
    const handlerCounts = Object.entries(registration.handlers)
      .filter(([_, handlers]) => handlers.length > 0)
      .map(([event, handlers]) => `${event}(${handlers.length})`)

    const scheduleCounts = registration.schedules.length > 0
      ? [`schedules(${registration.schedules.length})`]
      : []

    const all = [...handlerCounts, ...scheduleCounts]

    if (all.length > 0) {
      this.log(`  ${name}: ${all.join(', ')}`)
    }
  }

  /**
   * Debug logging
   */
  private log(message: string): void {
    if (this.state.config.debug) {
      console.log(`[daemon] ${message}`)
    }
  }
}

/**
 * Create and start a workflow daemon
 */
export async function startDaemon(config: DaemonConfig): Promise<WorkflowDaemon> {
  const daemon = new WorkflowDaemon(config)
  await daemon.start()
  return daemon
}

/**
 * Run daemon until interrupted (for CLI usage)
 */
export async function runDaemonUntilInterrupted(config: DaemonConfig): Promise<void> {
  const daemon = await startDaemon(config)

  console.log('\nWorkflow daemon running. Press Ctrl+C to stop.\n')

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    await daemon.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Keep process alive
  await new Promise(() => {})
}
