/**
 * beads-workflows
 *
 * Event system for beads issue tracking - triggers workflows on issue state changes.
 * Includes MDX parser for extracting TypeScript code from .workflows/*.mdx files.
 *
 * @example
 * ```typescript
 * import { createBeadsWorkflow } from 'beads-workflows'
 *
 * const workflow = await createBeadsWorkflow()
 *
 * workflow.on.issue.ready(async (issue) => {
 *   console.log(`Issue ${issue.id} is ready to work!`)
 * })
 *
 * await workflow.start()
 * ```
 */

// Types
export * from './types.js'

// Core beads reading functions
export {
  findBeadsDir,
  readIssuesFromJsonl,
  readDependenciesFromJsonl,
  getIssuesWithReadyState,
  getReadyIssues,
  getBlockedIssues,
  getEpicProgress,
  isEpicCompleted,
} from './beads.js'

// Event system
export {
  WorkflowEventEmitter,
  detectChanges,
  createEventFactories,
} from './events.js'

// Workflow API
export {
  createWorkflowTriggers,
  createScheduledTriggers,
  type IssueHandlers,
  type EpicHandlers,
  type WorkflowTriggers,
  type ScheduledTriggers,
  type IssueHandler,
  type SimpleIssueHandler,
} from './workflow.js'

// Watcher
export {
  BeadsWatcher,
  createWatcher,
  type WatcherOptions,
} from './watcher.js'

// Parser - Extract TypeScript from workflow MDX files
export {
  parseWorkflowFile,
  loadWorkflows,
  findWorkflowsDir,
  type ParsedWorkflow,
  type WorkflowMetadata,
  type CodeBlock,
} from './parser.js'

// Compiler - Compile parsed workflows to executable modules
export {
  compileWorkflow,
  compileWorkflows,
  createHandlerRegistry,
  wrapWorkflowSource,
  type CompiledWorkflow,
  type CompilationError,
  type WorkflowHandlers,
} from './compiler.js'

// Runtime - unified runtime for .workflows/ MDX files
export {
  createRuntime,
  createMinimalRuntime,
  type RuntimeOptions,
  type WorkflowRuntime,
} from './runtime.js'

// Proxy API types - Global objects available in workflow code
export type {
  ClaudeApi,
  ClaudeSpawnOptions,
  ClaudeSpawnResult,
  GitHubApi,
  GitHubPrApi,
  GitHubIssuesApi,
  GitHubIssue,
  PullRequest,
  CreatePROptions,
  ReviewResult,
  CreateIssueOptions,
  GitApi,
  GitWorktreeApi,
  BeadsApi,
  BeadsIssuesApi,
  BeadsEpicsApi,
  BeadsListFilter,
  BeadsCreateOptions,
  TodoApi,
  SlackApi,
  OnTriggers,
  OnIssueHandlers,
  OnEpicHandlers,
  EverySchedule,
  WorkflowContext,
} from './proxy-api.js'

// =============================================================================
// High-level API
// =============================================================================

import { findBeadsDir } from './beads.js'
import { WorkflowEventEmitter } from './events.js'
import { createWorkflowTriggers, createScheduledTriggers, type WorkflowTriggers, type ScheduledTriggers } from './workflow.js'
import { BeadsWatcher, type WatcherOptions } from './watcher.js'

/**
 * Beads workflow instance
 */
export interface BeadsWorkflow {
  /** Event triggers - on.issue.ready(), on.issue.closed(), etc. */
  on: WorkflowTriggers

  /** Scheduled triggers - every.day(), every.hour() */
  every: ScheduledTriggers

  /** The underlying event emitter */
  emitter: WorkflowEventEmitter

  /** The file watcher (null until started) */
  watcher: BeadsWatcher | null

  /** The beads directory path */
  beadsDir: string

  /** Start watching for changes */
  start(): Promise<void>

  /** Stop watching */
  stop(): void
}

/**
 * Options for creating a beads workflow
 */
export interface CreateWorkflowOptions extends WatcherOptions {
  /** Path to start searching for .beads directory */
  cwd?: string

  /** Explicit path to .beads directory */
  beadsDir?: string
}

/**
 * Create a beads workflow instance
 *
 * @example
 * ```typescript
 * const workflow = await createBeadsWorkflow()
 *
 * workflow.on.issue.ready(async (issue) => {
 *   // Spawn Claude to work on the issue
 *   await claude.spawn({ task: issue.description })
 * })
 *
 * await workflow.start()
 * ```
 */
export async function createBeadsWorkflow(
  options: CreateWorkflowOptions = {}
): Promise<BeadsWorkflow> {
  const { cwd = process.cwd(), beadsDir: explicitBeadsDir, ...watcherOptions } = options

  // Find beads directory
  const beadsDir = explicitBeadsDir ?? await findBeadsDir(cwd)
  if (!beadsDir) {
    throw new Error(
      `Could not find .beads directory. Run 'bd init' to initialize beads tracking.`
    )
  }

  // Create event emitter
  const emitter = new WorkflowEventEmitter()

  // Create workflow triggers
  const on = createWorkflowTriggers(emitter)
  const every = createScheduledTriggers()

  let watcher: BeadsWatcher | null = null

  return {
    on,
    every,
    emitter,
    beadsDir,
    get watcher() {
      return watcher
    },

    async start() {
      if (watcher) {
        return // Already started
      }
      watcher = new BeadsWatcher(beadsDir, emitter, watcherOptions)
      await watcher.start()
    },

    stop() {
      if (watcher) {
        watcher.stop()
        watcher = null
      }
    },
  }
}

/**
 * Create a workflow instance for testing (doesn't require .beads directory)
 */
export function createTestWorkflow(): {
  on: WorkflowTriggers
  every: ScheduledTriggers
  emitter: WorkflowEventEmitter
} {
  const emitter = new WorkflowEventEmitter()
  return {
    on: createWorkflowTriggers(emitter),
    every: createScheduledTriggers(),
    emitter,
  }
}
