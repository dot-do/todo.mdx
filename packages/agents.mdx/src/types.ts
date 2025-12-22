/**
 * agents.mdx - Workflow Runtime Types
 *
 * This interface defines the globalThis contract for workflow code.
 * Two implementations exist:
 * - Local: CLI + miniflare (shells out to git, bd, claude CLI)
 * - Cloud: Worker + capnweb (API calls to services)
 */

// ============================================================================
// Re-exports from beads-workflows (canonical types)
// ============================================================================

// Import for local use
import type {
  Issue as BeadsIssue,
  IssueStatus,
  IssueType,
  Priority,
  Epic,
  Changes,
  IssueEvent,
  BeadsConfig,
} from 'beads-workflows'

// Re-export everything
export type { IssueStatus, IssueType, Priority, Epic, Changes, IssueEvent, BeadsConfig }
export type { BeadsIssue as Issue }

export {
  isValidStatus,
  isValidType,
  isValidPriority,
  isIssue,
  isEpic,
} from 'beads-workflows'

// Local alias for use in this file
type Issue = BeadsIssue

// ============================================================================
// Core Domain Types
// ============================================================================

export interface Repo {
  owner: string
  name: string
  defaultBranch: string
  url: string
}

export interface PR {
  number: number
  title: string
  body: string
  branch: string
  url: string
  state: 'open' | 'closed' | 'merged'
}

export interface IssueFilter {
  status?: Issue['status']
  priority?: number
  type?: Issue['type']
  assignee?: string
  labels?: string[]
}

// ============================================================================
// Claude Result Types
// ============================================================================

export interface DoResult {
  diff: string
  summary: string
  filesChanged: string[]
  /** Branch the changes were pushed to (if push was enabled) */
  pushedToBranch?: string
  /** Commit SHA (if push was enabled) */
  commitSha?: string
}

export interface ResearchResult {
  findings: string
  sources: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ReviewResult {
  approved: boolean
  comments: Array<{
    file: string
    line: number
    body: string
    severity: 'critical' | 'warning' | 'suggestion'
  }>
  summary: string
}

// ============================================================================
// Claude Options Types
// ============================================================================

export interface DoOpts {
  task: string
  context?: string
  model?: 'opus' | 'sonnet' | 'haiku'
  /** Push changes to a branch (enables commit and push from sandbox) */
  push?: boolean
  /** Target branch name (default: auto-generated) */
  targetBranch?: string
  /** Commit message (default: generated from task) */
  commitMessage?: string
}

export interface ResearchOpts {
  topic: string
  depth?: 'quick' | 'thorough' | 'exhaustive'
  context?: string
}

export interface ReviewOpts {
  pr: PR
  focus?: Array<'security' | 'performance' | 'correctness' | 'style'>
}

export interface AskOpts {
  question: string
  context?: string
}

// ============================================================================
// Template Literal + Callable Method Type
// ============================================================================

/**
 * A method that supports both template literal and structured call styles:
 *
 * @example
 * // Template literal style
 * await claude.do`implement ${feature}`
 *
 * @example
 * // Structured style
 * await claude.do({ task: 'implement feature', context: '...' })
 */
export interface ClaudeMethod<TOpts, TResult> {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<TResult>
  (opts: TOpts): Promise<TResult>
}

// ============================================================================
// Claude Interface
// ============================================================================

export interface Claude {
  /**
   * Root template tag - defaults to .do behavior
   * @example await claude`implement ${feature}`
   */
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<DoResult>

  /**
   * Execute a task (write code, fix bug, implement feature)
   * @example await claude.do`implement ${issue.title}`
   * @example await claude.do({ task: 'fix the bug', context: '...' })
   */
  do: ClaudeMethod<DoOpts, DoResult>

  /**
   * Research a topic (investigate, gather info, analyze - no code changes)
   * @example await claude.research`best approach for ${problem}`
   * @example await claude.research({ topic: 'auth patterns', depth: 'thorough' })
   */
  research: ClaudeMethod<ResearchOpts, ResearchResult>

  /**
   * Review a pull request
   * @example await claude.review`${pull} focusing on security`
   * @example await claude.review({ pr: pull, focus: ['security', 'perf'] })
   */
  review: ClaudeMethod<ReviewOpts, ReviewResult>

  /**
   * Ask a quick question
   * @example await claude.ask`how should I handle ${edgeCase}?`
   * @example await claude.ask({ question: 'what pattern should I use?' })
   */
  ask: ClaudeMethod<AskOpts, string>
}

// ============================================================================
// PR Interface
// ============================================================================

export interface PRNamespace {
  create(opts: { branch: string; title: string; body: string }): Promise<PR>
  merge(pr: PR): Promise<void>
  comment(pr: PR, message: string): Promise<void>
  waitForApproval(pr: PR, opts?: { timeout?: string }): Promise<void>
  list(filter?: { state?: 'open' | 'closed' | 'all' }): Promise<PR[]>
}

// ============================================================================
// Issues Interface
// ============================================================================

export interface IssuesNamespace {
  list(filter?: IssueFilter): Promise<Issue[]>
  ready(): Promise<Issue[]>
  blocked(): Promise<Issue[]>
  create(opts: { title: string; description?: string; type?: Issue['type']; priority?: number }): Promise<Issue>
  update(id: string, fields: Partial<Issue>): Promise<Issue>
  close(id: string, reason?: string): Promise<void>
  show(id: string): Promise<Issue>
}

// ============================================================================
// Epics Interface
// ============================================================================

export interface EpicsNamespace {
  list(): Promise<Issue[]>
  progress(id: string): Promise<{ total: number; completed: number; percentage: number }>
  create(opts: { title: string; description?: string }): Promise<Issue>
}

// ============================================================================
// Git Interface
// ============================================================================

export interface GitNamespace {
  commit(message: string): Promise<string> // returns sha
  push(branch?: string): Promise<void>
  pull(): Promise<void>
  branch(name: string): Promise<void>
  checkout(ref: string): Promise<void>
  status(): Promise<{ modified: string[]; staged: string[]; untracked: string[] }>
  diff(ref?: string): Promise<string>
  worktree: {
    create(name: string): Promise<string> // returns path
    remove(name: string): Promise<void>
    list(): Promise<Array<{ path: string; branch: string }>>
  }
}

// ============================================================================
// Todo Interface (Context Rendering)
// ============================================================================

export interface TodoNamespace {
  render(): Promise<string>
  ready(limit?: number): Promise<string>
  blocked(): Promise<string>
  inProgress(): Promise<string>
}

// ============================================================================
// DAG Interface (Dependency Analysis)
// ============================================================================

export interface DAGNamespace {
  /**
   * Get all ready issues (status=open AND all dependencies closed)
   */
  ready(): Promise<Issue[]>

  /**
   * Find the critical path - longest chain of open/in_progress issues to completion
   */
  criticalPath(): Promise<Issue[]>

  /**
   * Get all open issues blocking this issue (transitive)
   */
  blockedBy(issueId: string): Promise<Issue[]>

  /**
   * Get all issues that this issue unblocks (transitive)
   */
  unblocks(issueId: string): Promise<Issue[]>
}

// ============================================================================
// Complete Workflow Runtime Interface
// ============================================================================

export interface WorkflowRuntime {
  // Context - injected per workflow execution
  repo: Repo
  issue?: Issue // The triggering issue (if applicable)

  // Claude - AI agent operations
  claude: Claude

  // PR - Pull request operations
  pr: PRNamespace

  // Issues - Issue tracking (unified beads + GitHub)
  issues: IssuesNamespace

  // Epics - Epic management
  epics: EpicsNamespace

  // Git - Local git operations
  git: GitNamespace

  // Todo - Context rendering for agents
  todo: TodoNamespace

  // DAG - Dependency graph analysis
  dag: DAGNamespace
}

// ============================================================================
// Transport Abstraction
// ============================================================================

/**
 * Transport interface - how the runtime communicates with backends
 */
export interface Transport {
  call(method: string, args: unknown[]): Promise<unknown>
  close?(): void
}

/**
 * Transport factory - creates transport based on environment
 */
export type TransportFactory = () => Transport | Promise<Transport>

// ============================================================================
// Runtime Factory
// ============================================================================

export interface RuntimeConfig {
  repo: Repo
  issue?: Issue
  transport: Transport | TransportFactory
}

/**
 * Create a workflow runtime with the given configuration
 */
export type CreateRuntime = (config: RuntimeConfig) => WorkflowRuntime

// ============================================================================
// Agent Configuration Types (MDX Components)
// ============================================================================

/**
 * Agent autonomy levels
 */
export type AgentAutonomy = 'full' | 'supervised' | 'manual'

/**
 * Tool/capability access configuration
 */
export interface CapabilityConfig {
  /** Capability name (e.g., 'git', 'github', 'claude') */
  name: string
  /** Allowed operations (e.g., ['commit', 'push'] or ['*'] for all) */
  operations?: string[]
  /** Optional description */
  description?: string
  /** Rate limits or constraints */
  constraints?: Record<string, unknown>
}

/**
 * Event trigger configuration
 */
export interface TriggerConfig {
  /** Event type (e.g., 'issue.ready', 'issue.closed', 'schedule') */
  event: string
  /** Optional condition/filter (e.g., 'priority >= 3') */
  condition?: string
  /** Optional cron expression for schedule triggers */
  cron?: string
  /** Handler function or reference */
  handler?: string | ((event: unknown, runtime: WorkflowRuntime) => Promise<void>)
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Agent name/identifier */
  name: string
  /** Capabilities/tools the agent can use */
  capabilities?: CapabilityConfig[]
  /** Areas of focus/expertise */
  focus?: string[]
  /** Autonomy level */
  autonomy?: AgentAutonomy
  /** Event triggers */
  triggers?: TriggerConfig[]
  /** Description */
  description?: string
  /** Whether to extend a pre-built cloud agent */
  extends?: string
  /** Model to use (e.g., 'opus', 'sonnet', 'haiku') */
  model?: 'opus' | 'sonnet' | 'haiku'
  /** Custom system prompt or instructions */
  instructions?: string
}

/**
 * Agent registry entry (compiled output for cloud sync)
 * Same structure as AgentConfig, used for semantic clarity
 */
export type AgentRegistryEntry = AgentConfig
