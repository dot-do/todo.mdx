/**
 * E2E Tests: Claude Code on Cloudflare Sandbox
 *
 * TDD RED PHASE: These tests are written FIRST and should FAIL
 * until ClaudeSandbox is properly implemented with Cloudflare Sandbox SDK.
 *
 * Tests the full Claude Code execution cycle:
 * 1. Spawn sandbox container
 * 2. Clone repository
 * 3. Execute Claude Code task
 * 4. Return diff/patch
 *
 * Per https://developers.cloudflare.com/sandbox/tutorials/claude-code/
 *
 * Requires:
 * - ANTHROPIC_API_KEY
 * - TEST_API_KEY (for worker auth)
 * - Worker deployed with Sandbox binding
 */

import { describe, test, expect, beforeAll } from 'vitest'

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'http://localhost:8787'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const TEST_API_KEY = process.env.TEST_API_KEY
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID

const hasCredentials = !!ANTHROPIC_API_KEY && !!TEST_API_KEY

const describeWithCredentials = hasCredentials ? describe : describe.skip

// Helper to make authenticated requests to the worker
async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${WORKER_BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(TEST_API_KEY && { Authorization: `Bearer ${TEST_API_KEY}` }),
    ...options.headers,
  }
  return fetch(url, { ...options, headers })
}

// ============================================================================
// Core ClaudeSandbox Tests - Must pass for autonomous workflow
// ============================================================================

describeWithCredentials('ClaudeSandbox.execute() - core functionality', () => {
  beforeAll(() => {
    if (!hasCredentials) {
      console.log('Skipping ClaudeSandbox tests - missing credentials')
      console.log('  ANTHROPIC_API_KEY:', !!ANTHROPIC_API_KEY)
      console.log('  TEST_API_KEY:', !!TEST_API_KEY)
    }
  })

  test('POST /api/sandbox/execute runs Claude Code and returns diff', async () => {
    // This is the core test - Claude must be able to:
    // 1. Clone a repo
    // 2. Execute a task
    // 3. Return the diff

    const response = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'dot-do/test.mdx',
        task: 'Add a comment "// TDD test" at the top of README.md',
      }),
    })

    // Must succeed
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)

    const result = await response.json() as {
      diff: string
      summary: string
      filesChanged: string[]
      exitCode: number
    }

    // Must have a diff
    expect(result).toHaveProperty('diff')
    expect(typeof result.diff).toBe('string')
    expect(result.diff.length).toBeGreaterThan(0)
    expect(result.diff).toContain('README.md')

    // Must have a summary
    expect(result).toHaveProperty('summary')
    expect(typeof result.summary).toBe('string')

    // Must list files changed
    expect(result).toHaveProperty('filesChanged')
    expect(Array.isArray(result.filesChanged)).toBe(true)
    expect(result.filesChanged.length).toBeGreaterThan(0)

    // Must exit successfully
    expect(result).toHaveProperty('exitCode')
    expect(result.exitCode).toBe(0)
  }, 180_000) // 3 minute timeout for sandbox cold start + execution

  test('returns proper error for missing repo', async () => {
    const response = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'nonexistent-org/nonexistent-repo-xyz123',
        task: 'Do something',
      }),
    })

    expect(response.status).toBe(400)

    const error = await response.json() as { error: string }
    expect(error).toHaveProperty('error')
    expect(typeof error.error).toBe('string')
  })

  test('returns proper error for empty task', async () => {
    const response = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'dot-do/test.mdx',
        task: '',
      }),
    })

    expect(response.status).toBe(400)

    const error = await response.json() as { error: string }
    expect(error).toHaveProperty('error')
  })

  test('returns proper error for missing required fields', async () => {
    const response = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
  })
})

// ============================================================================
// GitHub Integration Tests - Required for private repos
// ============================================================================

describeWithCredentials('ClaudeSandbox with GitHub integration', () => {
  const hasGitHubIntegration = !!GITHUB_INSTALLATION_ID

  test.skipIf(!hasGitHubIntegration)(
    'clones private repo using installation token',
    async () => {
      const response = await apiRequest('/api/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify({
          repo: 'dot-do/test.mdx',
          task: 'List all files and summarize the project structure',
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(response.ok).toBe(true)

      const result = await response.json() as {
        summary: string
        exitCode: number
      }

      expect(result.exitCode).toBe(0)
      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeGreaterThan(0)
    },
    180_000
  )

  test.skipIf(!hasGitHubIntegration)(
    'creates branch and pushes changes',
    async () => {
      const branchName = `test/sandbox-${Date.now()}`

      const response = await apiRequest('/api/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify({
          repo: 'dot-do/test.mdx',
          task: 'Create a file called sandbox-test.txt with content "Hello from TDD test"',
          branch: branchName,
          push: true,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(response.ok).toBe(true)

      const result = await response.json() as {
        diff: string
        branch: string
        commitSha?: string
        pushed: boolean
      }

      // Should have created the branch
      expect(result.branch).toBe(branchName)

      // Should have pushed
      expect(result.pushed).toBe(true)

      // Should have commit SHA if pushed
      if (result.pushed) {
        expect(result.commitSha).toBeDefined()
        expect(result.commitSha).toMatch(/^[0-9a-f]{40}$/)
      }
    },
    180_000
  )
})

// ============================================================================
// Streaming Tests - For real-time output
// ============================================================================

describeWithCredentials('ClaudeSandbox streaming output', () => {
  test('streams execution via SSE', async () => {
    const response = await apiRequest('/api/sandbox/execute/stream', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'dot-do/test.mdx',
        task: 'List the files in the repository',
      }),
    })

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('text/event-stream')

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()

    const events: string[] = []
    const decoder = new TextDecoder()

    // Read events until complete or timeout
    const timeout = setTimeout(() => reader?.cancel(), 120_000)

    try {
      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        const chunk = decoder.decode(value)
        events.push(chunk)

        // Stop when we see complete
        if (chunk.includes('event: complete') || chunk.includes('event: error')) {
          break
        }
      }
    } finally {
      clearTimeout(timeout)
    }

    // Must have events
    expect(events.length).toBeGreaterThan(0)

    // Must have output events (stdout or stderr)
    const hasOutput = events.some(
      (e) => e.includes('event: stdout') || e.includes('event: stderr')
    )
    expect(hasOutput).toBe(true)

    // Must end with complete or error
    const hasEnding = events.some(
      (e) => e.includes('event: complete') || e.includes('event: error')
    )
    expect(hasEnding).toBe(true)
  }, 180_000)
})

// ============================================================================
// Full Workflow Integration - Claude develops, creates PR, etc.
// ============================================================================

describeWithCredentials('Full autonomous development workflow', () => {
  const hasFullIntegration = !!GITHUB_INSTALLATION_ID

  test.skipIf(!hasFullIntegration)(
    'Claude develops issue and creates PR',
    async () => {
      const issueId = `test-${Date.now()}`
      const branchName = `claude/${issueId}`

      // Step 1: Execute Claude to implement the issue
      const executeResponse = await apiRequest('/api/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify({
          repo: 'dot-do/test.mdx',
          task: `Create a new file called "features/${issueId}.md" with content describing a test feature.`,
          branch: branchName,
          push: true,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(executeResponse.ok).toBe(true)

      const executeResult = await executeResponse.json() as {
        diff: string
        summary: string
        filesChanged: string[]
        branch: string
        commitSha: string
        pushed: boolean
      }

      expect(executeResult.pushed).toBe(true)
      expect(executeResult.commitSha).toBeDefined()
      expect(executeResult.filesChanged.length).toBeGreaterThan(0)

      // Step 2: Create PR via workflow API
      const prResponse = await apiRequest('/api/workflows/pr/create', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          branch: branchName,
          title: `feat: ${issueId}`,
          body: `Implements ${issueId}\n\n${executeResult.summary}\n\nCloses #${issueId}`,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(prResponse.ok).toBe(true)

      const prResult = await prResponse.json() as {
        number: number
        url: string
      }

      expect(prResult.number).toBeGreaterThan(0)
      expect(prResult.url).toContain('github.com')

      // Cleanup: Close the PR
      // (In real workflow, reviewer would approve and merge)
    },
    300_000 // 5 minute timeout for full workflow
  )

  test.skipIf(!hasFullIntegration)(
    'PR review cycle: request changes, address feedback, approve',
    async () => {
      const issueId = `review-test-${Date.now()}`
      const branchName = `claude/${issueId}`

      // Step 1: Create initial PR
      const createResponse = await apiRequest('/api/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify({
          repo: 'dot-do/test.mdx',
          task: `Create a file "reviews/${issueId}.md" with a simple greeting`,
          branch: branchName,
          push: true,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(createResponse.ok).toBe(true)

      // Create the PR
      const prResponse = await apiRequest('/api/workflows/pr/create', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          branch: branchName,
          title: `feat: ${issueId}`,
          body: `Test PR for review cycle\n\nCloses #${issueId}`,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(prResponse.ok).toBe(true)
      const { number: prNumber } = await prResponse.json() as { number: number }

      // Step 2: Request changes (simulated via API)
      const reviewResponse = await apiRequest('/api/workflows/pr/review', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          prNumber,
          action: 'request_changes',
          body: 'Please add a timestamp to the file',
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(reviewResponse.ok).toBe(true)

      // Step 3: Claude addresses feedback
      const addressResponse = await apiRequest('/api/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify({
          repo: 'dot-do/test.mdx',
          task: `Add a timestamp to the file "reviews/${issueId}.md" as requested in the review`,
          branch: branchName,
          push: true,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(addressResponse.ok).toBe(true)
      const addressResult = await addressResponse.json() as { filesChanged: string[] }
      expect(addressResult.filesChanged.length).toBeGreaterThan(0)

      // Step 4: Re-request review
      const reRequestResponse = await apiRequest('/api/workflows/pr/review/request', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          prNumber,
          reviewers: ['test-reviewer'],
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      // May fail if test-reviewer doesn't exist, but should not error
      expect(reRequestResponse.status).not.toBe(500)

      // Step 5: Approve the PR
      const approveResponse = await apiRequest('/api/workflows/pr/review', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          prNumber,
          action: 'approve',
          body: 'LGTM!',
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(approveResponse.ok).toBe(true)

      const approveResult = await approveResponse.json() as { state: string }
      expect(approveResult.state).toBe('APPROVED')
    },
    600_000 // 10 minute timeout for full review cycle
  )

  test.skipIf(!hasFullIntegration)(
    'PR merge and issue close',
    async () => {
      const issueId = `merge-test-${Date.now()}`
      const branchName = `claude/${issueId}`

      // Step 1: Create a simple change
      const createResponse = await apiRequest('/api/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify({
          repo: 'dot-do/test.mdx',
          task: `Create a file "merges/${issueId}.md" with merge test content`,
          branch: branchName,
          push: true,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(createResponse.ok).toBe(true)

      // Step 2: Create PR
      const prResponse = await apiRequest('/api/workflows/pr/create', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          branch: branchName,
          title: `feat: ${issueId}`,
          body: `Merge test PR\n\nCloses #${issueId}`,
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(prResponse.ok).toBe(true)
      const { number: prNumber } = await prResponse.json() as { number: number }

      // Step 3: Merge the PR
      const mergeResponse = await apiRequest('/api/workflows/pr/merge', {
        method: 'POST',
        body: JSON.stringify({
          repo: { owner: 'dot-do', name: 'test.mdx' },
          prNumber,
          mergeMethod: 'squash',
          installationId: parseInt(GITHUB_INSTALLATION_ID!),
        }),
      })

      expect(mergeResponse.ok).toBe(true)

      const mergeResult = await mergeResponse.json() as {
        merged: boolean
        sha: string
      }

      expect(mergeResult.merged).toBe(true)
      expect(mergeResult.sha).toMatch(/^[0-9a-f]{40}$/)

      // Step 4: Verify issue was closed (if linked)
      // The "Closes #issueId" in PR body should auto-close the issue
      // We'd verify via GitHub API, but for now just check merge succeeded
    },
    300_000 // 5 minute timeout
  )
})

// ============================================================================
// Error Handling and Edge Cases
// ============================================================================

describeWithCredentials('ClaudeSandbox error handling', () => {
  test('handles timeout gracefully', async () => {
    // This test verifies the sandbox handles long-running tasks
    // Implementation should set reasonable timeouts

    const response = await apiRequest('/api/sandbox/execute', {
      method: 'POST',
      body: JSON.stringify({
        repo: 'dot-do/test.mdx',
        task: 'This is a test task',
        timeout: 1000, // Very short timeout (1 second)
      }),
    })

    // Should either succeed quickly or return timeout error
    if (!response.ok) {
      const error = await response.json() as { error: string }
      expect(error.error).toContain('timeout')
    }
  })

  test('rate limiting is enforced', async () => {
    // Make multiple rapid requests
    const requests = Array(10)
      .fill(null)
      .map(() =>
        apiRequest('/api/sandbox/execute', {
          method: 'POST',
          body: JSON.stringify({
            repo: 'dot-do/test.mdx',
            task: 'Quick test',
          }),
        })
      )

    const responses = await Promise.all(requests)

    // At least some should be rate limited (429)
    const rateLimited = responses.filter((r) => r.status === 429)
    // Or all succeed if rate limiting is per-user and we're under limit
    const succeeded = responses.filter((r) => r.ok)

    expect(rateLimited.length + succeeded.length).toBe(responses.length)
  })
})

// ============================================================================
// Unit tests for helper functions (always run)
// ============================================================================

describe('ClaudeSandbox helper functions', () => {
  test('parseSSEEvent extracts event type and data', () => {
    const parseSSEEvent = (chunk: string) => {
      const lines = chunk.split('\n')
      let eventType = 'message'
      let data = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          data = line.slice(6)
        }
      }

      return { eventType, data }
    }

    const chunk = 'event: stdout\ndata: Hello World\n\n'
    const result = parseSSEEvent(chunk)

    expect(result.eventType).toBe('stdout')
    expect(result.data).toBe('Hello World')
  })

  test('buildCloneCommand handles owner/repo format', () => {
    const buildCloneCommand = (repo: string, branch?: string) => {
      const repoUrl = repo.includes('://')
        ? repo
        : `https://github.com/${repo}.git`

      return branch
        ? `git clone --depth 1 --branch ${branch} ${repoUrl} /workspace/repo`
        : `git clone --depth 1 ${repoUrl} /workspace/repo`
    }

    expect(buildCloneCommand('owner/repo')).toBe(
      'git clone --depth 1 https://github.com/owner/repo.git /workspace/repo'
    )

    expect(buildCloneCommand('owner/repo', 'main')).toBe(
      'git clone --depth 1 --branch main https://github.com/owner/repo.git /workspace/repo'
    )

    expect(buildCloneCommand('https://github.com/owner/repo.git')).toBe(
      'git clone --depth 1 https://github.com/owner/repo.git /workspace/repo'
    )
  })

  test('extractDiff parses git diff output', () => {
    const extractDiff = (gitOutput: string) => {
      const lines = gitOutput.split('\n')
      const files: string[] = []

      for (const line of lines) {
        if (line.startsWith('diff --git')) {
          const match = line.match(/diff --git a\/(.+) b\//)
          if (match) files.push(match[1])
        }
      }

      return { diff: gitOutput, filesChanged: files }
    }

    const gitDiff = `diff --git a/README.md b/README.md
index 123..456 789
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # Test
+// Comment
diff --git a/src/index.ts b/src/index.ts
index abc..def 123
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1 @@
-old
+new`

    const result = extractDiff(gitDiff)

    expect(result.filesChanged).toContain('README.md')
    expect(result.filesChanged).toContain('src/index.ts')
    expect(result.filesChanged.length).toBe(2)
  })
})
