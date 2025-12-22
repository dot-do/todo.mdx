import { describe, test, expect } from 'vitest'
import { generateGitHubSignature, getWorkerBaseUrl, getWebhookSecret } from '../helpers/auth'

const WORKER_BASE_URL = getWorkerBaseUrl()
const GITHUB_WEBHOOK_SECRET = getWebhookSecret()

// Skip signature verification tests when running against production without the real secret
// (The test-secret default won't match production's actual webhook secret)
const isProduction = WORKER_BASE_URL.includes('todo.mdx.do')
const hasRealSecret = process.env.GITHUB_WEBHOOK_SECRET !== undefined
const skipValidSignatureTest = isProduction && !hasRealSecret

describe('GitHub webhook signature verification', () => {
  const testPayload = {
    action: 'opened',
    issue: {
      number: 123,
      title: 'Test Issue',
      body: 'Test body',
      state: 'open',
      labels: [],
    },
    repository: {
      full_name: 'test-owner/test-repo',
      owner: { login: 'test-owner' },
      name: 'test-repo',
    },
  }

  test.skipIf(skipValidSignatureTest)('accepts webhook with valid signature', async () => {
    const body = JSON.stringify(testPayload)
    const signature = await generateGitHubSignature(body, GITHUB_WEBHOOK_SECRET)

    const response = await fetch(`${WORKER_BASE_URL}/github/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body,
    })

    // Should not be 401 (valid signature)
    expect(response.status).not.toBe(401)
  })

  test('rejects webhook with missing signature', async () => {
    const body = JSON.stringify(testPayload)

    const response = await fetch(`${WORKER_BASE_URL}/github/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        // No X-Hub-Signature-256 header
      },
      body,
    })

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })

  test('rejects webhook with invalid signature', async () => {
    const body = JSON.stringify(testPayload)
    const invalidSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000'

    const response = await fetch(`${WORKER_BASE_URL}/github/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': invalidSignature,
      },
      body,
    })

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })

  test('rejects webhook with wrong secret', async () => {
    const body = JSON.stringify(testPayload)
    const wrongSignature = await generateGitHubSignature(body, 'wrong-secret')

    const response = await fetch(`${WORKER_BASE_URL}/github/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': wrongSignature,
      },
      body,
    })

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })

  test('rejects webhook with malformed signature format', async () => {
    const body = JSON.stringify(testPayload)

    const response = await fetch(`${WORKER_BASE_URL}/github/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': 'not-a-valid-format',
      },
      body,
    })

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })

  test('rejects webhook with modified payload (signature mismatch)', async () => {
    const originalBody = JSON.stringify(testPayload)
    const signature = await generateGitHubSignature(originalBody, GITHUB_WEBHOOK_SECRET)

    // Modify the payload after signing
    const modifiedPayload = { ...testPayload, action: 'edited' }
    const modifiedBody = JSON.stringify(modifiedPayload)

    const response = await fetch(`${WORKER_BASE_URL}/github/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': signature,
      },
      body: modifiedBody,
    })

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe('Invalid signature')
  })
})
