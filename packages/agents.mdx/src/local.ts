/**
 * Local Transport - CLI-based implementation for local development
 *
 * Routes API calls to local tools:
 * - claude.* -> claude CLI via Bun subprocess
 * - git.* -> git CLI via Bun subprocess
 * - issues.*, epics.* -> beads-workflows SDK
 * - pr.* -> Octokit
 * - todo.* -> todo.mdx package
 */

import type {
  Transport,
  Issue,
  PR,
  IssueFilter,
  DoOpts,
  DoResult,
  ResearchOpts,
  ResearchResult,
  ReviewOpts,
  ReviewResult,
  AskOpts,
  Repo,
} from './types'

// ============================================================================
// Shell Execution (Bun)
// ============================================================================

interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

async function exec(command: string, args: string[], cwd?: string): Promise<ExecResult> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

async function execOrThrow(command: string, args: string[], cwd?: string): Promise<string> {
  const result = await exec(command, args, cwd)
  if (result.exitCode !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

// ============================================================================
// Claude CLI Implementation
// ============================================================================

async function claudeDo(opts: DoOpts): Promise<DoResult> {
  const args = ['--print', opts.task]

  if (opts.context) {
    args.push('--context', opts.context)
  }

  // TODO: Add model selection when claude CLI supports it
  const output = await execOrThrow('claude', args)

  // Parse output - for now return raw output
  // In practice, claude CLI would return structured JSON
  return {
    diff: '', // Would be extracted from actual changes
    summary: output,
    filesChanged: [],
  }
}

async function claudeResearch(opts: ResearchOpts): Promise<ResearchResult> {
  const prompt = opts.depth === 'exhaustive'
    ? `Thoroughly research: ${opts.topic}`
    : opts.depth === 'thorough'
      ? `Research in depth: ${opts.topic}`
      : `Quickly research: ${opts.topic}`

  const args = ['--print', prompt]

  if (opts.context) {
    args.push('--context', opts.context)
  }

  const output = await execOrThrow('claude', args)

  return {
    findings: output,
    sources: [],
    confidence: 'medium',
  }
}

async function claudeReview(opts: ReviewOpts): Promise<ReviewResult> {
  const prompt = `Review this pull request: ${opts.pr.url}\n\nFocus: ${opts.focus?.join(', ') || 'general review'}`

  const output = await execOrThrow('claude', ['--print', prompt])

  // Parse review output - would be structured in practice
  return {
    approved: !output.toLowerCase().includes('request changes'),
    comments: [],
    summary: output,
  }
}

async function claudeAsk(opts: AskOpts): Promise<string> {
  const args = ['--print', opts.question]

  if (opts.context) {
    args.push('--context', opts.context)
  }

  return execOrThrow('claude', args)
}

// ============================================================================
// Git CLI Implementation
// ============================================================================

async function gitCommit(message: string): Promise<string> {
  await execOrThrow('git', ['add', '-A'])
  await execOrThrow('git', ['commit', '-m', message])
  return execOrThrow('git', ['rev-parse', 'HEAD'])
}

async function gitPush(branch?: string): Promise<void> {
  const args = ['push']
  if (branch) {
    args.push('-u', 'origin', branch)
  }
  await execOrThrow('git', args)
}

async function gitPull(): Promise<void> {
  await execOrThrow('git', ['pull'])
}

async function gitBranch(name: string): Promise<void> {
  await execOrThrow('git', ['checkout', '-b', name])
}

async function gitCheckout(ref: string): Promise<void> {
  await execOrThrow('git', ['checkout', ref])
}

async function gitStatus(): Promise<{ modified: string[]; staged: string[]; untracked: string[] }> {
  const output = await execOrThrow('git', ['status', '--porcelain'])
  const lines = output.split('\n').filter(Boolean)

  const modified: string[] = []
  const staged: string[] = []
  const untracked: string[] = []

  for (const line of lines) {
    const status = line.slice(0, 2)
    const file = line.slice(3)

    if (status.startsWith('?')) {
      untracked.push(file)
    } else if (status[0] !== ' ') {
      staged.push(file)
    } else {
      modified.push(file)
    }
  }

  return { modified, staged, untracked }
}

async function gitDiff(ref?: string): Promise<string> {
  const args = ['diff']
  if (ref) args.push(ref)
  return execOrThrow('git', args)
}

async function gitWorktreeCreate(name: string): Promise<string> {
  const path = `../${name}`
  await execOrThrow('git', ['worktree', 'add', path, '-b', name])
  return path
}

async function gitWorktreeRemove(name: string): Promise<void> {
  await execOrThrow('git', ['worktree', 'remove', `../${name}`])
}

async function gitWorktreeList(): Promise<Array<{ path: string; branch: string }>> {
  const output = await execOrThrow('git', ['worktree', 'list', '--porcelain'])
  const worktrees: Array<{ path: string; branch: string }> = []
  let current: { path?: string; branch?: string } = {}

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path && current.branch) {
        worktrees.push({ path: current.path, branch: current.branch })
      }
      current = { path: line.slice(9) }
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '')
    }
  }

  if (current.path && current.branch) {
    worktrees.push({ path: current.path, branch: current.branch })
  }

  return worktrees
}

// ============================================================================
// Beads CLI Implementation
// ============================================================================

async function beadsIssuesList(filter?: IssueFilter): Promise<Issue[]> {
  const args = ['list', '--json']

  if (filter?.status) args.push('--status', filter.status)
  if (filter?.priority !== undefined) args.push('--priority', String(filter.priority))
  if (filter?.type) args.push('--type', filter.type)
  if (filter?.assignee) args.push('--assignee', filter.assignee)

  const output = await execOrThrow('bd', args)
  return JSON.parse(output)
}

async function beadsIssuesReady(): Promise<Issue[]> {
  const output = await execOrThrow('bd', ['ready', '--json'])
  return JSON.parse(output)
}

async function beadsIssuesBlocked(): Promise<Issue[]> {
  const output = await execOrThrow('bd', ['blocked', '--json'])
  return JSON.parse(output)
}

async function beadsIssuesCreate(opts: { title: string; description?: string; type?: string; priority?: number }): Promise<Issue> {
  const args = ['create', '--title', opts.title, '--json']

  if (opts.description) args.push('--description', opts.description)
  if (opts.type) args.push('--type', opts.type)
  if (opts.priority !== undefined) args.push('--priority', String(opts.priority))

  const output = await execOrThrow('bd', args)
  return JSON.parse(output)
}

async function beadsIssuesUpdate(id: string, fields: Partial<Issue>): Promise<Issue> {
  const args = ['update', id, '--json']

  if (fields.status) args.push('--status', fields.status)
  if (fields.priority !== undefined) args.push('--priority', String(fields.priority))
  if (fields.assignee) args.push('--assignee', fields.assignee)
  if (fields.title) args.push('--title', fields.title)
  if (fields.description) args.push('--description', fields.description)

  const output = await execOrThrow('bd', args)
  return JSON.parse(output)
}

async function beadsIssuesClose(id: string, reason?: string): Promise<void> {
  const args = ['close', id]
  if (reason) args.push('--reason', reason)
  await execOrThrow('bd', args)
}

async function beadsIssuesShow(id: string): Promise<Issue> {
  const output = await execOrThrow('bd', ['show', id, '--json'])
  return JSON.parse(output)
}

async function beadsEpicsList(): Promise<Issue[]> {
  const output = await execOrThrow('bd', ['list', '--type', 'epic', '--json'])
  return JSON.parse(output)
}

async function beadsEpicsProgress(id: string): Promise<{ total: number; completed: number; percentage: number }> {
  const output = await execOrThrow('bd', ['epic', 'progress', id, '--json'])
  return JSON.parse(output)
}

async function beadsEpicsCreate(opts: { title: string; description?: string }): Promise<Issue> {
  const args = ['create', '--title', opts.title, '--type', 'epic', '--json']
  if (opts.description) args.push('--description', opts.description)
  const output = await execOrThrow('bd', args)
  return JSON.parse(output)
}

// ============================================================================
// GitHub (Octokit) Implementation
// ============================================================================

// Lazy-loaded Octokit instance
let octokit: Awaited<typeof import('@octokit/rest')>['Octokit'] extends new (...args: infer A) => infer R ? R : never

async function getOctokit() {
  if (!octokit) {
    const { Octokit } = await import('@octokit/rest')
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    if (!token) {
      throw new Error('GITHUB_TOKEN or GH_TOKEN environment variable required')
    }
    octokit = new Octokit({ auth: token })
  }
  return octokit
}

// Repo context - set by transport config
let repoContext: Repo

async function prCreate(opts: { branch: string; title: string; body: string }): Promise<PR> {
  const client = await getOctokit()
  const { data } = await client.pulls.create({
    owner: repoContext.owner,
    repo: repoContext.name,
    head: opts.branch,
    base: repoContext.defaultBranch,
    title: opts.title,
    body: opts.body,
  })

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    branch: data.head.ref,
    url: data.html_url,
    state: data.state as 'open' | 'closed' | 'merged',
  }
}

async function prMerge(pr: PR): Promise<void> {
  const client = await getOctokit()
  await client.pulls.merge({
    owner: repoContext.owner,
    repo: repoContext.name,
    pull_number: pr.number,
  })
}

async function prComment(pr: PR, message: string): Promise<void> {
  const client = await getOctokit()
  await client.issues.createComment({
    owner: repoContext.owner,
    repo: repoContext.name,
    issue_number: pr.number,
    body: message,
  })
}

async function prWaitForApproval(pr: PR, opts?: { timeout?: string }): Promise<void> {
  const client = await getOctokit()
  const timeoutMs = parseTimeout(opts?.timeout || '7d')
  const startTime = Date.now()
  const pollInterval = 60000 // 1 minute

  while (Date.now() - startTime < timeoutMs) {
    const { data: reviews } = await client.pulls.listReviews({
      owner: repoContext.owner,
      repo: repoContext.name,
      pull_number: pr.number,
    })

    const approved = reviews.some(r => r.state === 'APPROVED')
    if (approved) return

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  throw new Error(`PR #${pr.number} approval timed out after ${opts?.timeout || '7d'}`)
}

async function prList(filter?: { state?: 'open' | 'closed' | 'all' }): Promise<PR[]> {
  const client = await getOctokit()
  const { data } = await client.pulls.list({
    owner: repoContext.owner,
    repo: repoContext.name,
    state: filter?.state || 'open',
  })

  return data.map(pr => ({
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    branch: pr.head.ref,
    url: pr.html_url,
    state: pr.state as 'open' | 'closed' | 'merged',
  }))
}

function parseTimeout(timeout: string): number {
  const match = timeout.match(/^(\d+)(d|h|m|s)?$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000 // default 7 days

  const value = parseInt(match[1], 10)
  const unit = match[2] || 'd'

  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'm': return value * 60 * 1000
    case 's': return value * 1000
    default: return value * 24 * 60 * 60 * 1000
  }
}

// ============================================================================
// Todo Implementation
// ============================================================================

async function todoRender(): Promise<string> {
  // Read TODO.md from current directory
  const file = Bun.file('TODO.md')
  if (await file.exists()) {
    return file.text()
  }

  return ''
}

async function todoReady(limit?: number): Promise<string> {
  const issues = await beadsIssuesReady()
  const limited = limit ? issues.slice(0, limit) : issues

  return limited
    .map(i => `- [ ] **${i.id}** [P${i.priority}]: ${i.title}`)
    .join('\n')
}

async function todoBlocked(): Promise<string> {
  const issues = await beadsIssuesBlocked()

  return issues
    .map(i => `- [ ] **${i.id}** [BLOCKED]: ${i.title}`)
    .join('\n')
}

async function todoInProgress(): Promise<string> {
  const issues = await beadsIssuesList({ status: 'in_progress' })

  return issues
    .map(i => `- [ ] **${i.id}** [IN PROGRESS]: ${i.title}`)
    .join('\n')
}

// ============================================================================
// Local Transport Factory
// ============================================================================

export interface LocalTransportConfig {
  repo: Repo
  cwd?: string
}

/**
 * Create a local transport that routes to CLI tools
 */
export function localTransport(config: LocalTransportConfig): Transport {
  // Set repo context for GitHub calls
  repoContext = config.repo

  // Method dispatch table
  const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    // Claude
    'claude.do': (opts) => claudeDo(opts as DoOpts),
    'claude.research': (opts) => claudeResearch(opts as ResearchOpts),
    'claude.review': (opts) => claudeReview(opts as ReviewOpts),
    'claude.ask': (opts) => claudeAsk(opts as AskOpts),

    // Git
    'git.commit': (msg) => gitCommit(msg as string),
    'git.push': (branch) => gitPush(branch as string | undefined),
    'git.pull': () => gitPull(),
    'git.branch': (name) => gitBranch(name as string),
    'git.checkout': (ref) => gitCheckout(ref as string),
    'git.status': () => gitStatus(),
    'git.diff': (ref) => gitDiff(ref as string | undefined),
    'git.worktree.create': (name) => gitWorktreeCreate(name as string),
    'git.worktree.remove': (name) => gitWorktreeRemove(name as string),
    'git.worktree.list': () => gitWorktreeList(),

    // Issues (beads)
    'issues.list': (filter) => beadsIssuesList(filter as IssueFilter | undefined),
    'issues.ready': () => beadsIssuesReady(),
    'issues.blocked': () => beadsIssuesBlocked(),
    'issues.create': (opts) => beadsIssuesCreate(opts as { title: string; description?: string; type?: string; priority?: number }),
    'issues.update': (id, fields) => beadsIssuesUpdate(id as string, fields as Partial<Issue>),
    'issues.close': (id, reason) => beadsIssuesClose(id as string, reason as string | undefined),
    'issues.show': (id) => beadsIssuesShow(id as string),

    // Epics (beads)
    'epics.list': () => beadsEpicsList(),
    'epics.progress': (id) => beadsEpicsProgress(id as string),
    'epics.create': (opts) => beadsEpicsCreate(opts as { title: string; description?: string }),

    // PR (GitHub)
    'pr.create': (opts) => prCreate(opts as { branch: string; title: string; body: string }),
    'pr.merge': (pr) => prMerge(pr as PR),
    'pr.comment': (pr, msg) => prComment(pr as PR, msg as string),
    'pr.waitForApproval': (pr, opts) => prWaitForApproval(pr as PR, opts as { timeout?: string } | undefined),
    'pr.list': (filter) => prList(filter as { state?: 'open' | 'closed' | 'all' } | undefined),

    // Todo
    'todo.render': () => todoRender(),
    'todo.ready': (limit) => todoReady(limit as number | undefined),
    'todo.blocked': () => todoBlocked(),
    'todo.inProgress': () => todoInProgress(),
  }

  return {
    async call(method: string, args: unknown[]): Promise<unknown> {
      const handler = handlers[method]
      if (!handler) {
        throw new Error(`Unknown method: ${method}`)
      }
      return handler(...args)
    },
  }
}
