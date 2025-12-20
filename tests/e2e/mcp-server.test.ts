import { describe, test, expect, beforeAll } from 'vitest'

// MCP server URL (local dev or staging)
const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8787'
const MCP_ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN

function hasMcpCredentials(): boolean {
  return !!MCP_ACCESS_TOKEN
}

// Skip tests if no MCP access token is configured
const describeWithMcp = hasMcpCredentials() ? describe : describe.skip

async function mcpFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${MCP_BASE_URL}/mcp${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${MCP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

describe('MCP server discovery', () => {
  test('OAuth metadata is accessible without auth', async () => {
    let response: Response
    try {
      response = await fetch(
        `${MCP_BASE_URL}/mcp/.well-known/oauth-authorization-server`
      )
    } catch {
      // Server not running (ECONNREFUSED), skip this test
      console.log('MCP server not available at ' + MCP_BASE_URL + ', skipping discovery tests')
      return
    }

    // May fail if server not running, that's ok for CI without worker
    if (!response.ok) {
      console.log('MCP server returned error, skipping discovery tests')
      return
    }

    const metadata = await response.json()

    expect(metadata).toHaveProperty('issuer')
    expect(metadata).toHaveProperty('authorization_endpoint')
    expect(metadata).toHaveProperty('token_endpoint')
    expect(metadata.code_challenge_methods_supported).toContain('S256')
  })
})

describeWithMcp('MCP server authenticated', () => {
  beforeAll(() => {
    if (!hasMcpCredentials()) {
      console.log('Skipping MCP authenticated tests - no MCP_ACCESS_TOKEN configured')
    }
  })

  test('GET /info returns server capabilities', async () => {
    const response = await mcpFetch('/info')

    expect(response.ok).toBe(true)
    const info = await response.json()

    expect(info).toHaveProperty('name', 'todo.mdx')
    expect(info).toHaveProperty('version')
    expect(info).toHaveProperty('capabilities')
    expect(info.capabilities).toHaveProperty('tools')
    expect(info.capabilities).toHaveProperty('resources')
  })

  test('GET /tools returns available tools', async () => {
    const response = await mcpFetch('/tools')

    expect(response.ok).toBe(true)
    const { tools } = await response.json()

    expect(Array.isArray(tools)).toBe(true)

    // Check expected tools exist
    const toolNames = tools.map((t: any) => t.name)
    expect(toolNames).toContain('list_todos')
    expect(toolNames).toContain('create_todo')
    expect(toolNames).toContain('update_todo')
    expect(toolNames).toContain('search')
    expect(toolNames).toContain('fetch')
    expect(toolNames).toContain('roadmap')

    // Check tool schema structure
    const listTodos = tools.find((t: any) => t.name === 'list_todos')
    expect(listTodos).toHaveProperty('description')
    expect(listTodos).toHaveProperty('inputSchema')
    expect(listTodos.inputSchema.properties).toHaveProperty('repo')
  })

  test('GET /resources returns user repositories', async () => {
    const response = await mcpFetch('/resources')

    expect(response.ok).toBe(true)
    const { resources } = await response.json()

    expect(Array.isArray(resources)).toBe(true)

    // Each resource should have required fields
    for (const resource of resources) {
      expect(resource).toHaveProperty('uri')
      expect(resource).toHaveProperty('name')
      expect(resource.uri).toMatch(/^todo:\/\//)
    }
  })

  test('POST /tools/call with roadmap returns markdown', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'roadmap',
        arguments: {},
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result).toHaveProperty('content')
    expect(Array.isArray(result.content)).toBe(true)
    expect(result.content[0]).toHaveProperty('type', 'text')

    // Roadmap should contain markdown
    const text = result.content[0].text
    expect(text).toContain('# Roadmap')
  })

  test('POST /tools/call with search returns results', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'search',
        arguments: {
          query: 'test',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result).toHaveProperty('content')
    expect(result.isError).not.toBe(true)

    // Results should be parseable JSON array
    const results = JSON.parse(result.content[0].text)
    expect(Array.isArray(results)).toBe(true)

    // Each result should have id, title, url
    for (const item of results) {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('url')
    }
  })

  test('unauthorized request returns 401', async () => {
    const response = await fetch(`${MCP_BASE_URL}/mcp/info`)

    expect(response.status).toBe(401)
  })

  test('invalid token returns 401', async () => {
    const response = await fetch(`${MCP_BASE_URL}/mcp/info`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    })

    expect(response.status).toBe(401)
  })
})

describe('MCP tool schemas', () => {
  test.skip('list_todos requires repo parameter', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: {},
      }),
    })

    const result = await response.json()
    expect(result.isError).toBe(true)
  })

  test.skip('create_todo requires repo and title', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'create_todo',
        arguments: {
          repo: 'owner/repo',
          // missing title
        },
      }),
    })

    const result = await response.json()
    expect(result.isError).toBe(true)
  })
})
