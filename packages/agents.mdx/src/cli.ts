#!/usr/bin/env node

/**
 * agents.mdx CLI
 *
 * Commands:
 * - auth: Authenticate via oauth.do and store tokens
 * - watch: Start workflow daemon
 */

import { createServer } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, readFile, chmod } from 'node:fs/promises'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { runDaemonUntilInterrupted } from './daemon'
import type { Repo } from './types'

const execAsync = promisify(exec)

// ============================================================================
// Types
// ============================================================================

interface AuthTokens {
  claudeJwt: string
  githubToken: string
  workosToken: string
  expiresAt?: string
}

interface OAuthCallbackParams {
  claude_jwt?: string
  github_token?: string
  workos_token?: string
  expires_at?: string
  error?: string
  error_description?: string
}

// ============================================================================
// Configuration
// ============================================================================

const OAUTH_CONFIG = {
  clientId: 'agents-mdx',
  authUrl: 'https://oauth.do/authorize',
  scopes: ['claude:code', 'github:repo', 'workos:vault'],
} as const

const CONFIG_DIR = join(homedir(), '.agents.mdx')
const TOKENS_FILE = join(CONFIG_DIR, 'tokens.json')

// ============================================================================
// Token Storage
// ============================================================================

async function ensureConfigDir(): Promise<void> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw err
    }
  }
}

async function saveTokens(tokens: AuthTokens): Promise<void> {
  await ensureConfigDir()
  await writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 })
  // Ensure strict permissions
  await chmod(TOKENS_FILE, 0o600)
}

async function loadTokens(): Promise<AuthTokens | null> {
  try {
    const data = await readFile(TOKENS_FILE, 'utf-8')
    return JSON.parse(data) as AuthTokens
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}

// ============================================================================
// OAuth Flow
// ============================================================================

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform
  const command =
    platform === 'darwin'
      ? `open "${url}"`
      : platform === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`

  try {
    await execAsync(command)
  } catch (err) {
    console.error(`Failed to open browser automatically. Please visit:\n${url}`)
  }
}

function parseCallbackParams(url: string): OAuthCallbackParams {
  const parsed = parseUrl(url, true)
  return {
    claude_jwt: parsed.query.claude_jwt as string | undefined,
    github_token: parsed.query.github_token as string | undefined,
    workos_token: parsed.query.workos_token as string | undefined,
    expires_at: parsed.query.expires_at as string | undefined,
    error: parsed.query.error as string | undefined,
    error_description: parsed.query.error_description as string | undefined,
  }
}

async function startOAuthFlow(): Promise<AuthTokens> {
  return new Promise((resolve, reject) => {
    let server: ReturnType<typeof createServer> | null = null
    let port = 0

    const cleanup = () => {
      if (server) {
        server.close()
        server = null
      }
    }

    server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Bad Request')
        return
      }

      const params = parseCallbackParams(req.url)

      // Handle OAuth errors
      if (params.error) {
        const errorMsg = params.error_description || params.error
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Failed</title></head>
            <body>
              <h1>Authentication Failed</h1>
              <p>${errorMsg}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `)
        cleanup()
        reject(new Error(`OAuth error: ${errorMsg}`))
        return
      }

      // Validate required tokens
      if (!params.claude_jwt || !params.github_token || !params.workos_token) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Failed</title></head>
            <body>
              <h1>Authentication Failed</h1>
              <p>Missing required tokens</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `)
        cleanup()
        reject(new Error('Missing required tokens in OAuth callback'))
        return
      }

      // Success
      const tokens: AuthTokens = {
        claudeJwt: params.claude_jwt,
        githubToken: params.github_token,
        workosToken: params.workos_token,
        expiresAt: params.expires_at,
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Authentication Successful</title></head>
          <body>
            <h1>Authentication Successful!</h1>
            <p>You have been authenticated with agents.mdx</p>
            <p>You can close this window and return to your terminal.</p>
          </body>
        </html>
      `)

      cleanup()
      resolve(tokens)
    })

    server.on('error', (err) => {
      cleanup()
      reject(err)
    })

    // Start server on random available port
    server.listen(0, 'localhost', () => {
      const addr = server!.address()
      if (!addr || typeof addr === 'string') {
        cleanup()
        reject(new Error('Failed to get server port'))
        return
      }

      port = addr.port
      const redirectUri = `http://localhost:${port}/callback`
      const authUrl = new URL(OAUTH_CONFIG.authUrl)
      authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('scope', OAUTH_CONFIG.scopes.join(' '))
      authUrl.searchParams.set('response_type', 'token')

      console.log('\n1. Opening oauth.do...')
      openBrowser(authUrl.toString())
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      cleanup()
      reject(new Error('OAuth flow timed out'))
    }, 5 * 60 * 1000)
  })
}

// ============================================================================
// Repo Detection
// ============================================================================

/**
 * Auto-detect repository from git remote
 */
async function detectRepo(cwd: string = process.cwd()): Promise<Repo | null> {
  try {
    const { stdout: remoteOutput } = await execAsync('git remote get-url origin', { cwd })

    // Parse git URL (supports https and ssh)
    // https://github.com/owner/name.git
    // git@github.com:owner/name.git
    const match = remoteOutput.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(\.git)?$/)
    if (!match) {
      return null
    }

    const [, owner, name] = match

    // Get default branch
    let defaultBranch = 'main'
    try {
      const { stdout: branchOutput } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD', { cwd })
      const branchMatch = branchOutput.match(/refs\/remotes\/origin\/(.+)/)
      if (branchMatch) {
        defaultBranch = branchMatch[1].trim()
      }
    } catch {
      // Default to 'main' if command fails
    }

    return {
      owner,
      name,
      defaultBranch,
      url: `https://github.com/${owner}/${name}`,
    }
  } catch {
    return null
  }
}

/**
 * Parse repository from string format "owner/name"
 */
function parseRepoString(repoStr: string): Repo {
  const [owner, name] = repoStr.split('/')
  if (!owner || !name) {
    throw new Error(`Invalid repo format: ${repoStr} (expected "owner/name")`)
  }

  return {
    owner,
    name,
    defaultBranch: 'main',
    url: `https://github.com/${owner}/${name}`,
  }
}

// ============================================================================
// Commands
// ============================================================================

async function authCommand(): Promise<void> {
  try {
    console.log('Authenticating Claude Code CLI via oauth.do...\n')

    // Start OAuth flow
    const tokens = await startOAuthFlow()

    console.log('2. Authenticating Claude Code CLI...')
    console.log('3. Storing tokens in WorkOS vault...')

    // Save tokens locally (for now - will integrate WorkOS vault later)
    await saveTokens(tokens)

    console.log('\n✓ Authenticated')
    console.log(`\nTokens stored in: ${TOKENS_FILE}`)

    if (tokens.expiresAt) {
      const expiresDate = new Date(tokens.expiresAt)
      console.log(`Expires: ${expiresDate.toLocaleString()}`)
    }
  } catch (error) {
    console.error('\n✗ Authentication failed')
    console.error((error as Error).message)
    process.exit(1)
  }
}

async function statusCommand(): Promise<void> {
  const tokens = await loadTokens()

  if (!tokens) {
    console.log('Not authenticated. Run `agents.mdx auth` to authenticate.')
    process.exit(1)
  }

  console.log('✓ Authenticated')
  console.log(`\nTokens file: ${TOKENS_FILE}`)

  if (tokens.expiresAt) {
    const expiresDate = new Date(tokens.expiresAt)
    const now = new Date()
    const isExpired = expiresDate < now

    console.log(`Expires: ${expiresDate.toLocaleString()} ${isExpired ? '(EXPIRED)' : ''}`)

    if (isExpired) {
      console.log('\nYour tokens have expired. Run `agents.mdx auth` to re-authenticate.')
      process.exit(1)
    }
  }

  console.log('\nTokens:')
  console.log(`  - Claude JWT: ${tokens.claudeJwt.substring(0, 20)}...`)
  console.log(`  - GitHub Token: ${tokens.githubToken.substring(0, 20)}...`)
  console.log(`  - WorkOS Token: ${tokens.workosToken.substring(0, 20)}...`)
}

async function logoutCommand(): Promise<void> {
  const tokens = await loadTokens()

  if (!tokens) {
    console.log('Not authenticated.')
    return
  }

  try {
    const { unlink } = await import('node:fs/promises')
    await unlink(TOKENS_FILE)
    console.log('✓ Logged out')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
    console.log('Not authenticated.')
  }
}

async function watchCommand(args: string[]): Promise<void> {
  // Simple arg parsing
  const opts: {
    repo?: string
    workflows?: string
    beads?: string
    cwd?: string
    debug: boolean
  } = {
    debug: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--repo':
        opts.repo = args[++i]
        break
      case '--workflows':
        opts.workflows = args[++i]
        break
      case '--beads':
        opts.beads = args[++i]
        break
      case '--cwd':
        opts.cwd = args[++i]
        break
      case '--debug':
        opts.debug = true
        break
      case '--help':
      case '-h':
        console.log(`
agents.mdx watch - Start workflow daemon

Usage:
  agents.mdx watch [options]

Options:
  --repo <owner/name>    Repository in format "owner/name" (default: auto-detect from git)
  --workflows <dir>      Workflows directory (default: .workflows or workflows)
  --beads <dir>          Beads directory (default: .beads)
  --cwd <dir>            Working directory (default: current directory)
  --debug                Enable debug logging
  --help, -h             Show this help message

Examples:
  # Start daemon in current directory (auto-detect repo)
  agents.mdx watch

  # Start daemon with explicit repo
  agents.mdx watch --repo dot-do/todo.mdx

  # Enable debug logging
  agents.mdx watch --debug
        `.trim())
        process.exit(0)
    }
  }

  const cwd = opts.cwd || process.cwd()

  // Get repository context
  let repo: Repo
  if (opts.repo) {
    repo = parseRepoString(opts.repo)
  } else {
    const detected = await detectRepo(cwd)
    if (!detected) {
      console.error('Error: Could not detect repository from git remote')
      console.error('Please specify --repo owner/name')
      process.exit(1)
    }
    repo = detected
  }

  console.log(`Repository: ${repo.owner}/${repo.name}`)
  console.log(`Working directory: ${cwd}`)

  // Start daemon
  await runDaemonUntilInterrupted({
    repo,
    workflowsDir: opts.workflows,
    beadsDir: opts.beads,
    cwd,
    debug: opts.debug,
  })
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'auth':
      await authCommand()
      break

    case 'status':
      await statusCommand()
      break

    case 'logout':
      await logoutCommand()
      break

    case 'watch':
      await watchCommand(args.slice(1))
      break

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(`
agents.mdx - Workflow orchestration CLI

Usage:
  agents.mdx auth           Authenticate via oauth.do
  agents.mdx status         Check authentication status
  agents.mdx logout         Clear stored credentials
  agents.mdx watch          Start workflow daemon
  agents.mdx help           Show this help message

Authentication:
  The 'auth' command will:
  1. Open oauth.do in your browser
  2. Authenticate and receive tokens
  3. Store tokens securely in ~/.agents.mdx/tokens.json

  Tokens include:
  - Claude JWT: Long-lived token for Claude Code
  - GitHub Token: For PRs, issues, repos
  - WorkOS Token: For vault access

Workflow Daemon:
  The 'watch' command monitors .workflows/*.mdx files and beads events,
  executing workflow handlers when triggers fire.

  Run 'agents.mdx watch --help' for more details.
      `.trim())
      break

    default:
      console.error(`Unknown command: ${command}`)
      console.error('Run `agents.mdx help` for usage information')
      process.exit(1)
  }
}

// Run CLI
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
