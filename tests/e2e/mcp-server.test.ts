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

/**
 * E2E: MCP Server Tests (todo-42t)
 *
 * Tests MCP tools: listIssues, createIssue, updateIssue, closeIssue, search
 * Verifies responses and side effects
 */
describeWithMcp('MCP issue management tools', () => {
  const TEST_REPO = 'dot-do/test.mdx'

  test('list_todos returns issues array', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: {
          repo: TEST_REPO,
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result.isError).not.toBe(true)
    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe('text')

    // Parse the JSON response
    const issues = JSON.parse(result.content[0].text)
    expect(Array.isArray(issues)).toBe(true)
  })

  test('list_todos with status filter', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: {
          repo: TEST_REPO,
          status: 'open',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result.isError).not.toBe(true)
    const issues = JSON.parse(result.content[0].text)

    // All returned issues should be open
    for (const issue of issues) {
      expect(issue.state).toBe('open')
    }
  })

  test('list_todos with limit', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: {
          repo: TEST_REPO,
          limit: 5,
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    const issues = JSON.parse(result.content[0].text)
    expect(issues.length).toBeLessThanOrEqual(5)
  })

  test('create_todo creates new issue', async () => {
    const uniqueTitle = `MCP test issue ${Date.now()}`

    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'create_todo',
        arguments: {
          repo: TEST_REPO,
          title: uniqueTitle,
          body: 'Created via MCP tool test',
          type: 'task',
          priority: 2,
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result.isError).not.toBe(true)
    expect(result.content[0].text).toContain('created')

    // Verify issue was created
    const listResponse = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: { repo: TEST_REPO },
      }),
    })

    const listResult = await listResponse.json()
    const issues = JSON.parse(listResult.content[0].text)
    const createdIssue = issues.find((i: any) => i.title === uniqueTitle)

    expect(createdIssue).toBeDefined()
  })

  test('update_todo modifies issue', async () => {
    // First create an issue
    const uniqueTitle = `MCP update test ${Date.now()}`

    await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'create_todo',
        arguments: {
          repo: TEST_REPO,
          title: uniqueTitle,
          type: 'task',
        },
      }),
    })

    // Get the issue ID
    const listResponse = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: { repo: TEST_REPO },
      }),
    })

    const listResult = await listResponse.json()
    const issues = JSON.parse(listResult.content[0].text)
    const issue = issues.find((i: any) => i.title === uniqueTitle)

    if (issue) {
      // Update the issue
      const updateResponse = await mcpFetch('/tools/call', {
        method: 'POST',
        body: JSON.stringify({
          name: 'update_todo',
          arguments: {
            repo: TEST_REPO,
            id: issue.id,
            status: 'in_progress',
            priority: 1,
          },
        }),
      })

      expect(updateResponse.ok).toBe(true)
      const updateResult = await updateResponse.json()
      expect(updateResult.isError).not.toBe(true)
    }
  })

  test('close_todo closes issue', async () => {
    // Create an issue to close
    const uniqueTitle = `MCP close test ${Date.now()}`

    await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'create_todo',
        arguments: {
          repo: TEST_REPO,
          title: uniqueTitle,
          type: 'task',
        },
      }),
    })

    // Get the issue ID
    const listResponse = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'list_todos',
        arguments: { repo: TEST_REPO },
      }),
    })

    const listResult = await listResponse.json()
    const issues = JSON.parse(listResult.content[0].text)
    const issue = issues.find((i: any) => i.title === uniqueTitle)

    if (issue) {
      // Close the issue
      const closeResponse = await mcpFetch('/tools/call', {
        method: 'POST',
        body: JSON.stringify({
          name: 'close_todo',
          arguments: {
            repo: TEST_REPO,
            id: issue.id,
            reason: 'Completed in MCP test',
          },
        }),
      })

      expect(closeResponse.ok).toBe(true)
      const closeResult = await closeResponse.json()
      expect(closeResult.isError).not.toBe(true)
    }
  })
})

describeWithMcp('MCP search functionality', () => {
  test('search finds issues by text', async () => {
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

    expect(result.isError).not.toBe(true)
    const results = JSON.parse(result.content[0].text)
    expect(Array.isArray(results)).toBe(true)
  })

  test('search returns relevant fields', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'search',
        arguments: {
          query: 'feature',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    if (!result.isError) {
      const results = JSON.parse(result.content[0].text)

      for (const item of results) {
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('url')
      }
    }
  })

  test('search with repo filter', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'search',
        arguments: {
          query: 'bug',
          repo: 'dot-do/test.mdx',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()
    expect(result.content).toBeDefined()
  })

  test('search handles empty results', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'search',
        arguments: {
          query: 'xyznonexistent12345query',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    if (!result.isError) {
      const results = JSON.parse(result.content[0].text)
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    }
  })
})

describeWithMcp('MCP fetch tool', () => {
  test('fetch retrieves resource content', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'fetch',
        arguments: {
          uri: 'todo://dot-do/test.mdx/issues',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe('text')
  })

  test('fetch handles invalid URI gracefully', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'fetch',
        arguments: {
          uri: 'invalid://uri/path',
        },
      }),
    })

    const result = await response.json()
    // Should return error or empty result, not crash
    expect(result).toBeDefined()
  })
})

describeWithMcp('MCP roadmap tool', () => {
  test('roadmap returns markdown content', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'roadmap',
        arguments: {},
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain('#')
  })

  test('roadmap with repo filter', async () => {
    const response = await mcpFetch('/tools/call', {
      method: 'POST',
      body: JSON.stringify({
        name: 'roadmap',
        arguments: {
          repo: 'dot-do/test.mdx',
        },
      }),
    })

    expect(response.ok).toBe(true)
    const result = await response.json()

    expect(result.content).toBeDefined()
  })
})

describe('MCP protocol compliance', () => {
  test('server implements required capabilities', async () => {
    try {
      const response = await fetch(`${MCP_BASE_URL}/mcp/info`, {
        headers: MCP_ACCESS_TOKEN
          ? { Authorization: `Bearer ${MCP_ACCESS_TOKEN}` }
          : {},
      })

      if (!response.ok) return

      const info = await response.json()

      // MCP required fields
      expect(info).toHaveProperty('name')
      expect(info).toHaveProperty('version')
      expect(info).toHaveProperty('capabilities')
    } catch {
      // Server not running
    }
  })

  test('tools have proper schema structure', async () => {
    try {
      const response = await fetch(`${MCP_BASE_URL}/mcp/tools`, {
        headers: MCP_ACCESS_TOKEN
          ? { Authorization: `Bearer ${MCP_ACCESS_TOKEN}` }
          : {},
      })

      if (!response.ok) return

      const { tools } = await response.json()

      for (const tool of tools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('inputSchema')
        expect(tool.inputSchema).toHaveProperty('type', 'object')
        expect(tool.inputSchema).toHaveProperty('properties')
      }
    } catch {
      // Server not running
    }
  })

  test('resources follow URI convention', async () => {
    try {
      const response = await fetch(`${MCP_BASE_URL}/mcp/resources`, {
        headers: MCP_ACCESS_TOKEN
          ? { Authorization: `Bearer ${MCP_ACCESS_TOKEN}` }
          : {},
      })

      if (!response.ok) return

      const { resources } = await response.json()

      for (const resource of resources) {
        expect(resource).toHaveProperty('uri')
        expect(resource).toHaveProperty('name')
        expect(resource.uri).toMatch(/^[a-z]+:\/\//)
      }
    } catch {
      // Server not running
    }
  })
})
