/**
 * ClaudeSandbox Durable Object
 *
 * Manages Claude Code execution in a sandboxed container environment.
 * Supports both headless workflow execution and interactive browser terminals.
 *
 * @see https://developers.cloudflare.com/sandbox/
 */

import { Sandbox, getSandbox, parseSSEStream } from '@cloudflare/sandbox'
import type { Env } from '../types'
import { getGitHubToken } from '../auth/vault'

// Re-export Sandbox for wrangler binding
export { Sandbox }

// ============================================================================
// Types
// ============================================================================

export interface ExecuteOptions {
  /** GitHub repository URL or owner/repo */
  repo: string
  /** Task description for Claude */
  task: string
  /** Additional context (e.g., TODO.mdx output) */
  context?: string
  /** GitHub installation ID for API access (optional for public repos) */
  installationId?: number
  /** Branch to work on (default: main) */
  branch?: string
  /** Push changes to remote after execution */
  push?: boolean
  /** Target branch to push to (creates new branch if different from base) */
  targetBranch?: string
  /** Commit message for pushed changes */
  commitMessage?: string
}

export interface ExecuteResult {
  /** Git diff of changes */
  diff: string
  /** Summary of what was done */
  summary: string
  /** List of files that were changed */
  filesChanged: string[]
  /** Exit code from Claude Code */
  exitCode: number
  /** Branch the changes were pushed to (if push was enabled) */
  pushedToBranch?: string
  /** Commit SHA (if push was enabled) */
  commitSha?: string
}

export interface StreamEvent {
  type: 'stdout' | 'stderr' | 'complete' | 'error'
  data?: string
  exitCode?: number
  error?: string
}

export interface Session {
  id: string
  repo: string
  task: string
  status: 'running' | 'complete' | 'error' | 'aborted'
  startedAt: string
  completedAt?: string
}

// ============================================================================
// ClaudeSandbox Worker
// ============================================================================

/**
 * Worker that handles Claude Code sandbox requests
 * Uses getSandbox() to interact with the Sandbox Durable Object
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Get sandbox instance
    const sandboxId = url.searchParams.get('sandboxId') || 'default'
    const sandbox = getSandbox(env.CLAUDE_SANDBOX as unknown as DurableObjectNamespace<Sandbox>, sandboxId)

    // WebSocket upgrade for interactive terminal
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env, sandbox)
    }

    // API routes
    if (path === '/execute' && request.method === 'POST') {
      return handleExecute(request, env, sandbox)
    }

    if (path === '/stream' && request.method === 'POST') {
      return handleStream(request, env, sandbox)
    }

    return new Response('Not Found', { status: 404 })
  }
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Execute Claude Code headlessly and return results
 */
async function handleExecute(
  request: Request,
  env: Env,
  sandbox: ReturnType<typeof getSandbox>
): Promise<Response> {
  try {
    const opts = await request.json() as ExecuteOptions
    const result = await executeClaudeCode(env, sandbox, opts)
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[ClaudeSandbox] Execute error:', error)
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * Execute with streaming output
 */
async function handleStream(
  request: Request,
  env: Env,
  sandbox: ReturnType<typeof getSandbox>
): Promise<Response> {
  const opts = await request.json() as ExecuteOptions

  // Create SSE stream
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Start execution in background
  executeClaudeCodeWithStreaming(env, sandbox, opts, writer, encoder)
    .catch((error) => {
      const event: StreamEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    })
    .finally(() => {
      writer.close()
    })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * Handle WebSocket connection for interactive terminal
 */
async function handleWebSocket(
  request: Request,
  env: Env,
  sandbox: ReturnType<typeof getSandbox>
): Promise<Response> {
  const { 0: client, 1: server } = new WebSocketPair()

  server.accept()

  const url = new URL(request.url)
  const repo = url.searchParams.get('repo')
  const task = url.searchParams.get('task')
  const installationId = url.searchParams.get('installationId')

  if (!repo || !task || !installationId) {
    server.send(JSON.stringify({
      type: 'error',
      error: 'Missing required params: repo, task, installationId',
    }))
    server.close(1008, 'Missing params')
    return new Response(null, { status: 101, webSocket: client })
  }

  // Start interactive session
  runInteractiveSession(server, env, sandbox, {
    repo,
    task,
    installationId: parseInt(installationId, 10),
  })

  return new Response(null, { status: 101, webSocket: client })
}

// ============================================================================
// Core Execution Logic
// ============================================================================

/**
 * Execute Claude Code in the sandbox
 */
async function executeClaudeCode(
  env: Env,
  sandbox: ReturnType<typeof getSandbox>,
  opts: ExecuteOptions
): Promise<ExecuteResult> {
  const { repo, task, context, installationId, branch = 'main', push, targetBranch, commitMessage } = opts

  // Validate sandbox is available
  if (!sandbox) {
    throw new Error('Cloudflare Sandbox SDK is not available')
  }

  // Validate required environment variables
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  // Parse repo URL to get owner/repo
  const repoPath = parseRepoPath(repo)

  // Get GitHub token from vault if installationId provided
  let cloneUrl: string
  let token: string | null = null
  if (installationId) {
    try {
      token = await getGitHubToken(
        env,
        installationId.toString(),
        'installation'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve GitHub token'
      throw new Error(`Authentication failed: ${message}`)
    }
    if (!token) {
      throw new Error(`Authentication failed: No GitHub token found for installation ${installationId}`)
    }
    cloneUrl = `https://x-access-token:${token}@github.com/${repoPath}.git`
  } else {
    // Public repo - clone without auth
    cloneUrl = `https://github.com/${repoPath}.git`
  }

  // Clone the repository using git command
  console.log(`[ClaudeSandbox] Cloning ${repoPath}...`)
  let cloneResult
  try {
    cloneResult = await sandbox.exec(
      `git clone --depth 1 --branch ${branch} ${cloneUrl} /workspace`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sandbox execution failed'
    throw new Error(`Failed to execute git clone: ${message}`)
  }

  if (!cloneResult.success) {
    const errorMsg = cloneResult.stderr || 'Unknown git clone error'
    throw new Error(`Failed to clone repository: ${errorMsg}`)
  }

  // Configure git user for commits
  await sandbox.exec('cd /workspace && git config user.email "bot@todo.mdx.do"')
  await sandbox.exec('cd /workspace && git config user.name "todo.mdx bot"')

  // Build the prompt with context
  const systemPrompt = push
    ? `You are an automatic feature-implementer/bug-fixer. Apply all necessary changes to achieve the user request. Make changes but DO NOT commit - the pipeline will handle commits.`
    : `You are an automatic feature-implementer/bug-fixer. You apply all necessary changes to achieve the user request. You must ensure you DO NOT commit the changes, so the pipeline can read the local git diff and apply the change upstream.`

  const fullTask = context
    ? `${task}\n\n## Context\n\n${context}`
    : task

  // Run Claude Code in the workspace
  console.log(`[ClaudeSandbox] Running Claude Code for task: ${task.slice(0, 100)}...`)

  let claudeResult
  try {
    claudeResult = await sandbox.exec(
      `cd /workspace && ANTHROPIC_API_KEY="${env.ANTHROPIC_API_KEY}" claude-code --print "${escapeShell(fullTask)}" --system "${escapeShell(systemPrompt)}"`,
      { timeout: 600000 } // 10 minute timeout
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sandbox execution failed'
    throw new Error(`Failed to execute Claude Code: ${message}`)
  }

  // Check if execution failed
  if (!claudeResult.success && claudeResult.stderr) {
    console.error('[ClaudeSandbox] Claude Code execution failed:', claudeResult.stderr)
    // Don't throw - we still want to return the diff even if Claude Code had issues
  }

  // Capture the git diff
  const diffResult = await sandbox.exec('cd /workspace && git diff')
  const diff = diffResult.stdout || ''

  // Get list of changed files
  const statusResult = await sandbox.exec('cd /workspace && git status --porcelain')
  const filesChanged = (statusResult.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line: string) => line.slice(3)) // Remove status prefix

  let pushedToBranch: string | undefined
  let commitSha: string | undefined

  // Push changes if requested
  if (push && filesChanged.length > 0 && token) {
    const pushBranch = targetBranch || `auto/${Date.now()}`
    const message = commitMessage || `feat: ${task.slice(0, 50)}`

    console.log(`[ClaudeSandbox] Pushing changes to branch ${pushBranch}...`)

    // Create and checkout target branch
    const checkoutResult = await sandbox.exec(
      `cd /workspace && git checkout -b ${escapeShell(pushBranch)}`
    )
    if (!checkoutResult.success) {
      console.error(`[ClaudeSandbox] Failed to create branch: ${checkoutResult.stderr}`)
    }

    // Stage all changes
    await sandbox.exec('cd /workspace && git add -A')

    // Commit
    const commitResult = await sandbox.exec(
      `cd /workspace && git commit -m "${escapeShell(message)}"`
    )
    if (!commitResult.success) {
      console.error(`[ClaudeSandbox] Failed to commit: ${commitResult.stderr}`)
    }

    // Get commit SHA
    const shaResult = await sandbox.exec('cd /workspace && git rev-parse HEAD')
    commitSha = shaResult.stdout?.trim()

    // Push to remote
    const pushResult = await sandbox.exec(
      `cd /workspace && git push origin ${escapeShell(pushBranch)}`
    )
    if (!pushResult.success) {
      console.error(`[ClaudeSandbox] Failed to push: ${pushResult.stderr}`)
    } else {
      pushedToBranch = pushBranch
      console.log(`[ClaudeSandbox] Pushed to ${pushBranch} (${commitSha})`)
    }
  }

  return {
    diff,
    summary: claudeResult.stdout || '',
    filesChanged,
    exitCode: claudeResult.success ? 0 : 1,
    pushedToBranch,
    commitSha,
  }
}

/**
 * Execute with streaming output to SSE
 */
async function executeClaudeCodeWithStreaming(
  env: Env,
  sandbox: ReturnType<typeof getSandbox>,
  opts: ExecuteOptions,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder
): Promise<void> {
  const { repo, task, context, installationId, branch = 'main' } = opts

  const sendEvent = (event: StreamEvent) => {
    writer.write(encoder.encode(`event: ${event.type}\ndata: ${event.data || ''}\n\n`))
  }

  // Validate sandbox is available
  if (!sandbox) {
    throw new Error('Cloudflare Sandbox SDK is not available')
  }

  // Validate required environment variables
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const repoPath = parseRepoPath(repo)

  // Get GitHub token if installationId provided
  let cloneUrl: string
  if (installationId) {
    let token: string | null
    try {
      token = await getGitHubToken(
        env,
        installationId.toString(),
        'installation'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve GitHub token'
      throw new Error(`Authentication failed: ${message}`)
    }
    if (!token) {
      throw new Error(`Authentication failed: No GitHub token found for installation ${installationId}`)
    }
    cloneUrl = `https://x-access-token:${token}@github.com/${repoPath}.git`
  } else {
    // Public repo - clone without auth
    cloneUrl = `https://github.com/${repoPath}.git`
  }

  // Clone repository
  sendEvent({ type: 'stdout', data: `Cloning ${repoPath}...\n` })

  let cloneResult
  try {
    cloneResult = await sandbox.exec(
      `git clone --depth 1 --branch ${branch} ${cloneUrl} /workspace`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sandbox execution failed'
    throw new Error(`Failed to execute git clone: ${message}`)
  }

  if (!cloneResult.success) {
    const errorMsg = cloneResult.stderr || 'Unknown git clone error'
    throw new Error(`Failed to clone repository: ${errorMsg}`)
  }

  // Build prompt
  const systemPrompt = `You are an automatic feature-implementer/bug-fixer. You apply all necessary changes to achieve the user request. You must ensure you DO NOT commit the changes, so the pipeline can read the local git diff and apply the change upstream.`

  const fullTask = context
    ? `${task}\n\n## Context\n\n${context}`
    : task

  // Run Claude Code with streaming
  sendEvent({ type: 'stdout', data: `Running Claude Code...\n` })

  const stream = await sandbox.execStream(
    `cd /workspace && ANTHROPIC_API_KEY="${env.ANTHROPIC_API_KEY}" claude-code --print "${escapeShell(fullTask)}" --system "${escapeShell(systemPrompt)}"`,
    { timeout: 600000 }
  )

  // Parse and forward stream events
  for await (const event of parseSSEStream<{ type: string; data?: string }>(stream)) {
    if (event.type === 'stdout' && event.data) {
      sendEvent({ type: 'stdout', data: event.data })
    } else if (event.type === 'stderr' && event.data) {
      sendEvent({ type: 'stderr', data: event.data })
    }
  }

  // Get diff
  const diffResult = await sandbox.exec('cd /workspace && git diff')
  const statusResult = await sandbox.exec('cd /workspace && git status --porcelain')
  const filesChanged = (statusResult.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line: string) => line.slice(3))

  // Send completion event
  sendEvent({
    type: 'complete',
    data: JSON.stringify({
      diff: diffResult.stdout || '',
      filesChanged,
    }),
    exitCode: 0,
  })
}

/**
 * Run interactive Claude Code session over WebSocket
 */
async function runInteractiveSession(
  ws: WebSocket,
  env: Env,
  sandbox: ReturnType<typeof getSandbox>,
  opts: { repo: string; task: string; installationId: number }
): Promise<void> {
  const { repo, task, installationId } = opts

  try {
    // Validate sandbox is available
    if (!sandbox) {
      ws.send(JSON.stringify({ type: 'error', error: 'Cloudflare Sandbox SDK is not available' }))
      ws.close(1011, 'Sandbox unavailable')
      return
    }

    // Validate required environment variables
    if (!env.ANTHROPIC_API_KEY) {
      ws.send(JSON.stringify({ type: 'error', error: 'ANTHROPIC_API_KEY is not configured' }))
      ws.close(1011, 'Missing API key')
      return
    }

    // Get GitHub token
    let token: string | null
    try {
      token = await getGitHubToken(
        env,
        installationId.toString(),
        'installation'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve GitHub token'
      ws.send(JSON.stringify({ type: 'error', error: `Authentication failed: ${message}` }))
      ws.close(1008, 'Auth failed')
      return
    }
    if (!token) {
      ws.send(JSON.stringify({ type: 'error', error: `Authentication failed: No GitHub token found for installation ${installationId}` }))
      ws.close(1008, 'No token')
      return
    }

    const repoPath = parseRepoPath(repo)

    // Clone repo
    ws.send(JSON.stringify({ type: 'stdout', data: `\x1b[34mCloning ${repoPath}...\x1b[0m\r\n` }))

    const cloneResult = await sandbox.exec(
      `git clone --depth 1 https://x-access-token:${token}@github.com/${repoPath}.git /workspace`
    )

    if (!cloneResult.success) {
      ws.send(JSON.stringify({ type: 'error', error: `Clone failed: ${cloneResult.stderr}` }))
      ws.close(1011, 'Clone failed')
      return
    }

    // Start Claude Code with streaming
    ws.send(JSON.stringify({ type: 'stdout', data: `\x1b[34mStarting Claude Code...\x1b[0m\r\n` }))

    const systemPrompt = `You are an automatic feature-implementer/bug-fixer. You apply all necessary changes to achieve the user request. You must ensure you DO NOT commit the changes, so the pipeline can read the local git diff and apply the change upstream.`

    const stream = await sandbox.execStream(
      `cd /workspace && ANTHROPIC_API_KEY="${env.ANTHROPIC_API_KEY}" claude-code --print "${escapeShell(task)}" --system "${escapeShell(systemPrompt)}"`,
      { timeout: 600000 }
    )

    // Parse and forward stream events to WebSocket
    for await (const event of parseSSEStream<{ type: string; data?: string }>(stream)) {
      if ((event.type === 'stdout' || event.type === 'stderr') && event.data) {
        ws.send(JSON.stringify({ type: event.type, data: event.data }))
      }
    }

    // Send completion
    ws.send(JSON.stringify({ type: 'complete', exitCode: 0 }))
    ws.close(1000, 'Complete')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    ws.send(JSON.stringify({ type: 'error', error: message }))
    ws.close(1011, message)
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse repository path from URL or owner/repo format
 */
function parseRepoPath(repo: string): string {
  if (repo.startsWith('https://github.com/')) {
    return repo.replace('https://github.com/', '').replace('.git', '')
  }
  if (repo.startsWith('git@github.com:')) {
    return repo.replace('git@github.com:', '').replace('.git', '')
  }
  return repo
}

/**
 * Escape shell arguments
 */
function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}
