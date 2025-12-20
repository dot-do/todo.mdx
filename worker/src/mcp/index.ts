/**
 * MCP Server with OAuth 2.1 Authorization
 *
 * Implements the Model Context Protocol with proper OAuth 2.1 flows
 * for remote MCP clients (like Claude Desktop, etc.)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '../index'
import { createAuth } from '../auth'

/** Render roadmap data to markdown (mirrors roadmap.mdx/render) */
function renderRoadmap(data: {
  milestones: Array<{ id: string; title: string; state: string; dueOn?: string; repo: string }>
  issues: Array<{ id: string; title: string; state: string; milestoneId?: string; repo: string }>
}): string {
  const { milestones, issues } = data
  const closed = issues.filter(i => i.state === 'closed').length
  const lines = [
    '# Roadmap',
    '',
    `${closed}/${issues.length} complete · ${milestones.filter(m => m.state === 'open').length} milestones`,
    '',
  ]

  for (const m of milestones) {
    const mIssues = issues.filter(i => i.milestoneId === m.id)
    const mClosed = mIssues.filter(i => i.state === 'closed').length
    const pct = mIssues.length ? Math.round((mClosed / mIssues.length) * 100) : 0

    lines.push(`## ${m.title} ${m.state === 'closed' ? '✓' : `(${pct}%)`}`)
    if (m.dueOn) lines.push(`Due: ${m.dueOn}`)
    lines.push('')
    for (const i of mIssues) lines.push(`- [${i.state === 'closed' ? 'x' : ' '}] ${i.title}`)
    lines.push('')
  }

  const backlog = issues.filter(i => !i.milestoneId)
  if (backlog.length) {
    lines.push('## Backlog', '')
    for (const i of backlog) lines.push(`- [${i.state === 'closed' ? 'x' : ' '}] ${i.title}`)
    lines.push('')
  }

  return lines.join('\n')
}

type McpVariables = {
  userId: string
  scope: string
}

const mcp = new Hono<{ Bindings: Env; Variables: McpVariables }>()

// CORS for MCP access
mcp.use('/*', cors({
  origin: '*',
  credentials: true,
}))

// ============================================
// OAuth 2.1 Authorization Server
// ============================================

// Authorization metadata (RFC 8414)
mcp.get('/.well-known/oauth-authorization-server', (c) => {
  const baseUrl = c.env.BETTER_AUTH_URL || 'https://todo.mdx.do'

  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/mcp/authorize`,
    token_endpoint: `${baseUrl}/mcp/token`,
    revocation_endpoint: `${baseUrl}/mcp/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['mcp:read', 'mcp:write', 'repos:read', 'repos:write'],
  })
})

// Store for authorization codes (in production, use D1)
const authCodes = new Map<string, {
  userId: string
  clientId: string
  redirectUri: string
  codeChallenge?: string
  codeChallengeMethod?: string
  scope: string
  expiresAt: number
}>()

// Store for access tokens
const accessTokens = new Map<string, {
  userId: string
  clientId: string
  scope: string
  expiresAt: number
}>()

// Authorization endpoint (OAuth 2.1 with PKCE)
mcp.get('/authorize', async (c) => {
  const clientId = c.req.query('client_id')
  const redirectUri = c.req.query('redirect_uri')
  const responseType = c.req.query('response_type')
  const scope = c.req.query('scope') || 'mcp:read'
  const state = c.req.query('state')
  const codeChallenge = c.req.query('code_challenge')
  const codeChallengeMethod = c.req.query('code_challenge_method')

  // Validate required parameters
  if (!clientId || !redirectUri || responseType !== 'code') {
    return c.json({ error: 'invalid_request' }, 400)
  }

  // PKCE is required for OAuth 2.1
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    return c.json({ error: 'invalid_request', error_description: 'PKCE required' }, 400)
  }

  // Check if user is authenticated
  const auth = createAuth({
    DB: c.env.DB,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
  })

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(c.req.url)
    return c.redirect(`/api/auth/signin/github?callbackURL=${returnUrl}`)
  }

  // Generate authorization code
  const code = crypto.randomUUID()

  authCodes.set(code, {
    userId: session.user.id,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  })

  // Redirect back with code
  const redirect = new URL(redirectUri)
  redirect.searchParams.set('code', code)
  if (state) {
    redirect.searchParams.set('state', state)
  }

  return c.redirect(redirect.toString())
})

// Token endpoint
mcp.post('/token', async (c) => {
  const body = await c.req.parseBody()
  const grantType = body.grant_type as string
  const code = body.code as string
  const redirectUri = body.redirect_uri as string
  const codeVerifier = body.code_verifier as string
  const clientId = body.client_id as string

  if (grantType === 'authorization_code') {
    // Validate authorization code
    const authCode = authCodes.get(code)

    if (!authCode) {
      return c.json({ error: 'invalid_grant' }, 400)
    }

    if (authCode.expiresAt < Date.now()) {
      authCodes.delete(code)
      return c.json({ error: 'invalid_grant', error_description: 'Code expired' }, 400)
    }

    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      return c.json({ error: 'invalid_grant' }, 400)
    }

    // Verify PKCE
    if (authCode.codeChallenge) {
      const encoder = new TextEncoder()
      const data = encoder.encode(codeVerifier)
      const hash = await crypto.subtle.digest('SHA-256', data)
      const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      if (challenge !== authCode.codeChallenge) {
        return c.json({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400)
      }
    }

    // Delete used code
    authCodes.delete(code)

    // Generate access token
    const accessToken = crypto.randomUUID()
    const refreshToken = crypto.randomUUID()
    const expiresIn = 3600 // 1 hour

    accessTokens.set(accessToken, {
      userId: authCode.userId,
      clientId: authCode.clientId,
      scope: authCode.scope,
      expiresAt: Date.now() + expiresIn * 1000,
    })

    return c.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: authCode.scope,
    })
  }

  return c.json({ error: 'unsupported_grant_type' }, 400)
})

// Token revocation
mcp.post('/revoke', async (c) => {
  const body = await c.req.parseBody()
  const token = body.token as string

  if (token) {
    accessTokens.delete(token)
  }

  return c.json({})
})

// ============================================
// MCP Protocol Endpoints
// ============================================

// Middleware to validate bearer token
const requireToken = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const tokenData = accessTokens.get(token)

  if (!tokenData || tokenData.expiresAt < Date.now()) {
    accessTokens.delete(token)
    return c.json({ error: 'invalid_token' }, 401)
  }

  c.set('userId', tokenData.userId)
  c.set('scope', tokenData.scope)
  await next()
}

// MCP Server Info
mcp.get('/info', requireToken, (c) => {
  return c.json({
    name: 'todo.mdx',
    version: '0.1.0',
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: { subscribe: true },
      prompts: {},
    },
  })
})

// List available tools
mcp.get('/tools', requireToken, async (c) => {
  return c.json({
    tools: [
      {
        name: 'list_todos',
        description: 'List todos from a repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo: {
              type: 'string',
              description: 'Repository in owner/name format',
            },
            status: {
              type: 'string',
              enum: ['open', 'closed', 'all'],
              description: 'Filter by status',
            },
          },
          required: ['repo'],
        },
      },
      {
        name: 'create_todo',
        description: 'Create a new todo in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo: {
              type: 'string',
              description: 'Repository in owner/name format',
            },
            title: {
              type: 'string',
              description: 'Todo title',
            },
            body: {
              type: 'string',
              description: 'Todo body/description',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels to apply',
            },
          },
          required: ['repo', 'title'],
        },
      },
      {
        name: 'update_todo',
        description: 'Update an existing todo',
        inputSchema: {
          type: 'object',
          properties: {
            repo: {
              type: 'string',
              description: 'Repository in owner/name format',
            },
            id: {
              type: 'string',
              description: 'Todo ID',
            },
            title: {
              type: 'string',
              description: 'New title',
            },
            body: {
              type: 'string',
              description: 'New body',
            },
            status: {
              type: 'string',
              enum: ['open', 'closed'],
              description: 'New status',
            },
          },
          required: ['repo', 'id'],
        },
      },
      {
        name: 'list_milestones',
        description: 'List milestones from a repository',
        inputSchema: {
          type: 'object',
          properties: {
            repo: {
              type: 'string',
              description: 'Repository in owner/name format',
            },
          },
          required: ['repo'],
        },
      },
      {
        name: 'search',
        description: 'Search across all your issues and projects. Returns matching items with id, title, and url.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (matches title, body, labels)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch',
        description: 'Fetch a single issue or milestone by ID. Returns the full document with title, text content, and metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Item ID from search results',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'roadmap',
        description: 'Get current roadmap state: all milestones, issues, and progress.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'do',
        description: 'Run JS. Globals: repos[], issues[], milestones[], projects[]',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
          required: ['code'],
        },
      },
    ],
  })
})

// Execute tool
mcp.post('/tools/call', requireToken, async (c) => {
  const userId = c.get('userId')
  const { name, arguments: args } = await c.req.json()

  // Verify user has access to the repo
  if (args.repo) {
    const [owner, repoName] = args.repo.split('/')

    // Check if user has installation access
    const result = await c.env.DB.prepare(`
      SELECT r.* FROM repos r
      JOIN user_installations ui ON ui.installation_id = r.installation_id
      WHERE ui.user_id = ? AND r.full_name = ?
    `).bind(userId, args.repo).first()

    if (!result) {
      return c.json({
        content: [{ type: 'text', text: 'Access denied: You do not have access to this repository' }],
        isError: true,
      })
    }
  }

  switch (name) {
    case 'list_todos': {
      const doId = c.env.REPO.idFromName(args.repo)
      const stub = c.env.REPO.get(doId)

      const response = await stub.fetch(new Request('http://do/issues', {
        method: 'GET',
      }))

      const issues = await response.json()

      return c.json({
        content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }],
      })
    }

    case 'create_todo': {
      const doId = c.env.REPO.idFromName(args.repo)
      const stub = c.env.REPO.get(doId)

      const response = await stub.fetch(new Request('http://do/issues/sync', {
        method: 'POST',
        body: JSON.stringify({
          source: 'mcp',
          issues: [{
            title: args.title,
            body: args.body || '',
            state: 'open',
            labels: args.labels || [],
          }],
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

      const result = await response.json()

      return c.json({
        content: [{ type: 'text', text: `Created todo: ${args.title}` }],
      })
    }

    case 'list_milestones': {
      const doId = c.env.REPO.idFromName(args.repo)
      const stub = c.env.REPO.get(doId)

      const response = await stub.fetch(new Request('http://do/milestones', {
        method: 'GET',
      }))

      const milestones = await response.json()

      return c.json({
        content: [{ type: 'text', text: JSON.stringify(milestones, null, 2) }],
      })
    }

    case 'search': {
      // ChatGPT deep research spec: single query string, returns [{id, title, url}, ...]
      const query = args.query.toLowerCase()

      try {
        // Get all repos the user has access to
        const reposResult = await c.env.DB.prepare(`
          SELECT r.full_name FROM repos r
          JOIN user_installations ui ON ui.installation_id = r.installation_id
          WHERE ui.user_id = ?
        `).bind(userId).all()

        const results: Array<{ id: string; title: string; url: string }> = []
        const limit = 50

        // Search each repo
        for (const repo of reposResult.results as any[]) {
          if (results.length >= limit) break

          const doId = c.env.REPO.idFromName(repo.full_name)
          const stub = c.env.REPO.get(doId)

          // Search issues
          const issuesResponse = await stub.fetch(new Request('http://do/issues'))
          const issues = await issuesResponse.json() as any[]

          for (const issue of issues) {
            if (results.length >= limit) break

            const matchesQuery =
              issue.title?.toLowerCase().includes(query) ||
              issue.body?.toLowerCase().includes(query) ||
              issue.labels?.some((l: string) => l.toLowerCase().includes(query))

            if (matchesQuery) {
              // ID format: issue:owner/repo:number
              results.push({
                id: `issue:${repo.full_name}:${issue.githubNumber || issue.id}`,
                title: `[${issue.state}] ${issue.title}`,
                url: `https://github.com/${repo.full_name}/issues/${issue.githubNumber || issue.id}`,
              })
            }
          }

          // Search milestones
          const milestonesResponse = await stub.fetch(new Request('http://do/milestones'))
          const milestones = await milestonesResponse.json() as any[]

          for (const milestone of milestones) {
            if (results.length >= limit) break

            const matchesQuery =
              milestone.title?.toLowerCase().includes(query) ||
              milestone.description?.toLowerCase().includes(query)

            if (matchesQuery) {
              // ID format: milestone:owner/repo:number
              results.push({
                id: `milestone:${repo.full_name}:${milestone.githubNumber || milestone.id}`,
                title: `[Milestone] ${milestone.title}`,
                url: `https://github.com/${repo.full_name}/milestone/${milestone.githubNumber || milestone.id}`,
              })
            }
          }
        }

        // ChatGPT expects: array of {id, title, url}
        return c.json({
          content: [{ type: 'text', text: JSON.stringify(results) }],
        })
      } catch (error: any) {
        return c.json({
          content: [{ type: 'text', text: `Search error: ${error.message}` }],
          isError: true,
        })
      }
    }

    case 'fetch': {
      // ChatGPT deep research spec: single id string, returns {id, title, text, url, metadata?}
      // ID format from search: "issue:owner/repo:number" or "milestone:owner/repo:number"
      const id = args.id

      try {
        const parts = id.split(':')
        if (parts.length < 3) {
          return c.json({
            content: [{ type: 'text', text: `Invalid ID format: ${id}` }],
            isError: true,
          })
        }

        const type = parts[0] // 'issue' or 'milestone'
        const repo = parts[1] // 'owner/repo'
        const number = parts[2] // issue/milestone number

        // Verify access
        const accessResult = await c.env.DB.prepare(`
          SELECT r.* FROM repos r
          JOIN user_installations ui ON ui.installation_id = r.installation_id
          WHERE ui.user_id = ? AND r.full_name = ?
        `).bind(userId, repo).first()

        if (!accessResult) {
          return c.json({
            content: [{ type: 'text', text: 'Access denied' }],
            isError: true,
          })
        }

        const doId = c.env.REPO.idFromName(repo)
        const stub = c.env.REPO.get(doId)

        if (type === 'issue') {
          const response = await stub.fetch(new Request(`http://do/issues/${number}`))
          if (!response.ok) {
            return c.json({
              content: [{ type: 'text', text: `Issue not found: ${number}` }],
              isError: true,
            })
          }
          const issue = await response.json() as any

          // ChatGPT expects: {id, title, text, url, metadata?}
          const doc = {
            id,
            title: issue.title,
            text: `# ${issue.title}\n\n${issue.body || ''}\n\n---\nStatus: ${issue.state}\nLabels: ${(issue.labels || []).join(', ') || 'none'}\nAssignees: ${(issue.assignees || []).join(', ') || 'unassigned'}`,
            url: `https://github.com/${repo}/issues/${number}`,
            metadata: {
              type: 'issue',
              repo,
              number,
              state: issue.state,
              labels: issue.labels,
              assignees: issue.assignees,
            },
          }

          return c.json({
            content: [{ type: 'text', text: JSON.stringify(doc) }],
          })
        }

        if (type === 'milestone') {
          const response = await stub.fetch(new Request(`http://do/milestones/${number}`))
          if (!response.ok) {
            return c.json({
              content: [{ type: 'text', text: `Milestone not found: ${number}` }],
              isError: true,
            })
          }
          const milestone = await response.json() as any

          // ChatGPT expects: {id, title, text, url, metadata?}
          const doc = {
            id,
            title: milestone.title,
            text: `# ${milestone.title}\n\n${milestone.description || ''}\n\n---\nStatus: ${milestone.state}\nDue: ${milestone.dueOn || 'no due date'}`,
            url: `https://github.com/${repo}/milestone/${number}`,
            metadata: {
              type: 'milestone',
              repo,
              number,
              state: milestone.state,
              dueOn: milestone.dueOn,
            },
          }

          return c.json({
            content: [{ type: 'text', text: JSON.stringify(doc) }],
          })
        }

        return c.json({
          content: [{ type: 'text', text: `Unknown type: ${type}` }],
          isError: true,
        })
      } catch (error: any) {
        return c.json({
          content: [{ type: 'text', text: `Fetch error: ${error.message}` }],
          isError: true,
        })
      }
    }

    case 'roadmap': {
      try {
        const reposResult = await c.env.DB.prepare(`
          SELECT r.* FROM repos r
          JOIN user_installations ui ON ui.installation_id = r.installation_id
          WHERE ui.user_id = ?
        `).bind(userId).all()

        const allIssues: any[] = []
        const allMilestones: any[] = []

        for (const repo of reposResult.results as any[]) {
          const doId = c.env.REPO.idFromName(repo.full_name)
          const stub = c.env.REPO.get(doId)

          const [issuesRes, milestonesRes] = await Promise.all([
            stub.fetch(new Request('http://do/issues')),
            stub.fetch(new Request('http://do/milestones')),
          ])

          const issues = await issuesRes.json() as any[]
          const milestones = await milestonesRes.json() as any[]

          allIssues.push(...issues.map(i => ({ ...i, repo: repo.full_name })))
          allMilestones.push(...milestones.map(m => ({ ...m, repo: repo.full_name })))
        }

        // Render using roadmap.mdx format
        const md = renderRoadmap({ milestones: allMilestones, issues: allIssues })

        return c.json({
          content: [{ type: 'text', text: md }],
        })
      } catch (error: any) {
        return c.json({
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        })
      }
    }

    case 'do': {
      const code = args.code

      try {
        // Pre-load all data for the user
        const reposResult = await c.env.DB.prepare(`
          SELECT r.* FROM repos r
          JOIN user_installations ui ON ui.installation_id = r.installation_id
          WHERE ui.user_id = ?
        `).bind(userId).all()

        const repos: any[] = []
        const allIssues: any[] = []
        const allMilestones: any[] = []

        for (const repo of reposResult.results as any[]) {
          const doId = c.env.REPO.idFromName(repo.full_name)
          const stub = c.env.REPO.get(doId)

          const [issuesRes, milestonesRes] = await Promise.all([
            stub.fetch(new Request('http://do/issues')),
            stub.fetch(new Request('http://do/milestones')),
          ])

          const issues = await issuesRes.json() as any[]
          const milestones = await milestonesRes.json() as any[]

          // Enrich issues with repo info
          const enrichedIssues = issues.map(i => ({ ...i, repo: repo.full_name }))
          const enrichedMilestones = milestones.map(m => ({ ...m, repo: repo.full_name, issues: issues.filter(i => i.milestoneId === m.id) }))

          repos.push({
            name: repo.name,
            fullName: repo.full_name,
            issues: enrichedIssues,
            milestones: enrichedMilestones,
          })

          allIssues.push(...enrichedIssues)
          allMilestones.push(...enrichedMilestones)
        }

        // Execute code with data in scope
        const wrappedCode = `
const repos = ${JSON.stringify(repos)};
const issues = ${JSON.stringify(allIssues)};
const milestones = ${JSON.stringify(allMilestones)};
const projects = [];

${code}
`
        // Use Function constructor for simple eval
        const fn = new Function('return (async () => { ' + wrappedCode + ' })()')
        const result = await fn()

        return c.json({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        })
      } catch (error: any) {
        return c.json({
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        })
      }
    }

    default:
      return c.json({
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      })
  }
})

// List resources (repos as resources)
mcp.get('/resources', requireToken, async (c) => {
  const userId = c.get('userId')

  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ?
  `).bind(userId).all()

  const resources = result.results.map((repo: any) => ({
    uri: `todo://${repo.full_name}`,
    name: repo.full_name,
    description: `Todos from ${repo.full_name}`,
    mimeType: 'application/json',
  }))

  return c.json({ resources })
})

// Read resource
mcp.get('/resources/read', requireToken, async (c) => {
  const userId = c.get('userId')
  const uri = c.req.query('uri')

  if (!uri?.startsWith('todo://')) {
    return c.json({ error: 'Invalid resource URI' }, 400)
  }

  const repoName = uri.slice(7) // Remove 'todo://'

  // Verify access
  const result = await c.env.DB.prepare(`
    SELECT r.* FROM repos r
    JOIN user_installations ui ON ui.installation_id = r.installation_id
    WHERE ui.user_id = ? AND r.full_name = ?
  `).bind(userId, repoName).first()

  if (!result) {
    return c.json({ error: 'Access denied' }, 403)
  }

  const doId = c.env.REPO.idFromName(repoName)
  const stub = c.env.REPO.get(doId)

  const response = await stub.fetch(new Request('http://do/issues', {
    method: 'GET',
  }))

  const issues = await response.json()

  return c.json({
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(issues, null, 2),
    }],
  })
})

export { mcp }
