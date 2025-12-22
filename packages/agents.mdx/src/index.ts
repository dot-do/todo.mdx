/**
 * agents.mdx - Proxy Runtime for Workflow Orchestration
 *
 * Provides a unified runtime interface for workflow code that abstracts
 * local vs cloud execution. Workflows use the same API everywhere:
 *
 * @example
 * // In .workflows/develop.mdx
 * on.issue.ready(async (issue) => {
 *   const result = await claude.do`implement ${issue.description}`
 *   const pull = await pr.create({ branch: issue.id, title: issue.title, body: result.summary })
 *   await claude.review`${pull}`
 *   await pr.waitForApproval(pull)
 *   await pr.merge(pull)
 *   await issues.close(issue.id)
 * })
 *
 * @example
 * // Create runtime programmatically
 * import { createRuntime, localTransport } from 'agents.mdx'
 *
 * const runtime = createRuntime({
 *   repo: { owner: 'dot-do', name: 'todo.mdx', defaultBranch: 'main', url: '...' },
 *   transport: localTransport({ repo })
 * })
 *
 * const result = await runtime.claude.do({ task: 'fix the bug' })
 */

// Types
export type {
  // Domain types
  Repo,
  Issue,
  PR,
  IssueFilter,
  IssueStatus,
  IssueType,
  Priority,

  // Re-exports from beads-workflows (prefixed to avoid conflicts)
  BeadsIssue,
  BeadsIssueStatus,
  BeadsIssueType,
  BeadsPriority,
  BeadsEpic,
  BeadsChanges,
  BeadsIssueEvent,
  BeadsConfig,

  // Claude types
  DoOpts,
  DoResult,
  ResearchOpts,
  ResearchResult,
  ReviewOpts,
  ReviewResult,
  AskOpts,
  ClaudeMethod,
  Claude,

  // Namespace types
  PRNamespace,
  IssuesNamespace,
  EpicsNamespace,
  GitNamespace,
  TodoNamespace,

  // Runtime types
  WorkflowRuntime,
  RuntimeConfig,
  Transport,
  TransportFactory,
  CreateRuntime,
} from './types'

// Type guards from beads-workflows
export {
  isValidStatus,
  isValidType,
  isValidPriority,
  isBeadsIssue,
  isBeadsEpic,
} from './types'

// Runtime factory
export { createRuntime, installGlobals, initRuntime } from './runtime'

// Parser - Extract TypeScript from .workflows/*.mdx files
export {
  parseWorkflowFile,
  loadWorkflows,
  findWorkflowsDir,
  type ParsedWorkflow,
  type WorkflowMetadata,
  type CodeBlock,
} from './parser'

// Compiler - Compile parsed workflows to executable modules
export {
  compileWorkflow,
  compileWorkflows,
  executeWorkflow,
  wrapWorkflowSource,
  type CompiledWorkflow,
  type CompilationError,
  type WorkflowRegistration,
  type WorkflowRegistrar,
  type IssueHandler,
  type ScheduleHandler,
} from './compiler'

// Daemon - Workflow daemon for watching and executing workflows
export {
  WorkflowDaemon,
  startDaemon,
  runDaemonUntilInterrupted,
  type DaemonConfig,
} from './daemon'

// Cloudflare Workflows integration
export {
  durableTransport,
  prApprovalEvent,
  issueReadyEvent,
  epicCompletedEvent,
  type WorkflowStep,
  type WorkflowEvent,
  type DurableTransportConfig,
} from './cloudflare-workflows'
