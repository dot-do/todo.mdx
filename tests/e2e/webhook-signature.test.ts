import { describe, test, expect } from 'vitest'

const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'http://localhost:8787'
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret'

/**
 * Generate GitHub webhook signature for testing
 */
async function generateGitHubSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `sha256=${hex}`
}

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

  test('accepts webhook with valid signature', async () => {
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
