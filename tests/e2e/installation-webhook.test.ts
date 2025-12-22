import { describe, test, expect, beforeAll } from 'vitest'
import { describeWithWebhookSecret, hasWorkerCredentials } from '../helpers'
import * as worker from '../helpers/worker'

/**
 * Check if we have the webhook secret configured for signature generation.
 * Without this, webhook tests will return 401 Invalid signature.
 */
function hasWebhookSecret(): boolean {
  return !!process.env.GITHUB_WEBHOOK_SECRET
}

/**
 * E2E: GitHub App Installation Webhook Tests
 *
 * Tests the installation webhook handler that creates/deletes
 * installations and repos in D1 via Drizzle ORM.
 */
describeWithWebhookSecret('GitHub App installation webhook', () => {
  beforeAll(() => {
    if (!worker.hasWorkerCredentials()) {
      console.log('Skipping installation webhook tests - no TEST_API_KEY configured')
    }
    if (!hasWebhookSecret()) {
      console.log('Skipping installation webhook tests - no GITHUB_WEBHOOK_SECRET configured')
    }
  })

  test('installation created webhook creates installation in D1', async () => {
    const installationId = Math.floor(Math.random() * 1000000) + 100000
    const accountId = Math.floor(Math.random() * 1000000) + 100000
    const accountLogin = `test-org-${Date.now()}`

    const response = await worker.webhooks.simulateInstallationEvent(
      'created',
      {
        id: installationId,
        account: {
          login: accountLogin,
          id: accountId,
          type: 'Organization',
          avatar_url: 'https://example.com/avatar.png',
        },
        permissions: {
          issues: 'write',
          pull_requests: 'write',
          contents: 'read',
        },
        events: ['issues', 'pull_request', 'push'],
        repository_selection: 'selected',
      },
      [
        {
          id: Math.floor(Math.random() * 1000000),
          name: 'test-repo',
          full_name: `${accountLogin}/test-repo`,
          private: false,
        },
      ]
    )

    // Should not return 500 (DB insert error)
    expect(response.status).not.toBe(500)

    // Should succeed or return appropriate status
    if (response.ok) {
      const result = await response.json()
      expect(result.status).toBe('installed')
      expect(result.installationId).toBeDefined()
      expect(result.repos).toBe(1)
    } else {
      // Log the error for debugging
      const errorText = await response.text()
      console.error('Installation webhook failed:', response.status, errorText)
      // Still fail the test if we got a server error
      expect(response.status).toBeLessThan(500)
    }
  })

  test('installation created webhook handles multiple repos', async () => {
    const installationId = Math.floor(Math.random() * 1000000) + 200000
    const accountId = Math.floor(Math.random() * 1000000) + 200000
    const accountLogin = `test-multi-${Date.now()}`

    const repos = [
      {
        id: Math.floor(Math.random() * 1000000),
        name: 'repo-1',
        full_name: `${accountLogin}/repo-1`,
        private: false,
      },
      {
        id: Math.floor(Math.random() * 1000000),
        name: 'repo-2',
        full_name: `${accountLogin}/repo-2`,
        private: true,
      },
      {
        id: Math.floor(Math.random() * 1000000),
        name: 'repo-3',
        full_name: `${accountLogin}/repo-3`,
        private: false,
      },
    ]

    const response = await worker.webhooks.simulateInstallationEvent(
      'created',
      {
        id: installationId,
        account: {
          login: accountLogin,
          id: accountId,
          type: 'Organization',
        },
        permissions: { issues: 'write' },
        events: ['issues'],
        repository_selection: 'selected',
      },
      repos
    )

    expect(response.status).not.toBe(500)

    if (response.ok) {
      const result = await response.json()
      expect(result.status).toBe('installed')
      expect(result.repos).toBe(3)
    }
  })

  test('installation created webhook is idempotent', async () => {
    const installationId = Math.floor(Math.random() * 1000000) + 300000
    const accountId = Math.floor(Math.random() * 1000000) + 300000
    const accountLogin = `test-idempotent-${Date.now()}`

    const installationData = {
      id: installationId,
      account: {
        login: accountLogin,
        id: accountId,
        type: 'User' as const,
      },
      permissions: { issues: 'write' },
      events: ['issues'],
      repository_selection: 'all' as const,
    }

    // First call
    const response1 = await worker.webhooks.simulateInstallationEvent(
      'created',
      installationData,
      []
    )
    expect(response1.status).not.toBe(500)

    // Second call with same installation ID should not fail
    const response2 = await worker.webhooks.simulateInstallationEvent(
      'created',
      installationData,
      []
    )
    expect(response2.status).not.toBe(500)

    if (response2.ok) {
      const result = await response2.json()
      // Should indicate it's using existing installation
      expect(result.status).toBe('installed')
    }
  })

  test('installation deleted webhook removes installation', async () => {
    const installationId = Math.floor(Math.random() * 1000000) + 400000
    const accountId = Math.floor(Math.random() * 1000000) + 400000
    const accountLogin = `test-delete-${Date.now()}`

    // First create the installation
    await worker.webhooks.simulateInstallationEvent(
      'created',
      {
        id: installationId,
        account: {
          login: accountLogin,
          id: accountId,
          type: 'Organization',
        },
        permissions: { issues: 'write' },
        events: ['issues'],
        repository_selection: 'all',
      },
      []
    )

    // Then delete it
    const response = await worker.webhooks.simulateInstallationEvent(
      'deleted',
      {
        id: installationId,
        account: {
          login: accountLogin,
          id: accountId,
          type: 'Organization',
        },
      },
      []
    )

    expect(response.status).not.toBe(500)

    if (response.ok) {
      const result = await response.json()
      expect(result.status).toBe('uninstalled')
    }
  })

  test('installation webhook handles User account type', async () => {
    const installationId = Math.floor(Math.random() * 1000000) + 500000
    const accountId = Math.floor(Math.random() * 1000000) + 500000
    const accountLogin = `test-user-${Date.now()}`

    const response = await worker.webhooks.simulateInstallationEvent(
      'created',
      {
        id: installationId,
        account: {
          login: accountLogin,
          id: accountId,
          type: 'User',
          avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        },
        permissions: {
          issues: 'write',
          metadata: 'read',
        },
        events: ['issues', 'push'],
        repository_selection: 'all',
      },
      []
    )

    expect(response.status).not.toBe(500)

    if (response.ok) {
      const result = await response.json()
      expect(result.status).toBe('installed')
    }
  })
})
