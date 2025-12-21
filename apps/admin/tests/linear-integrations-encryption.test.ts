import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload } from 'payload'
import config from '../src/payload.config'

describe('LinearIntegrations webhook secret encryption', () => {
  let payload: any
  let testUserId: number
  let testIntegrationId: number

  beforeAll(async () => {
    // Set PAYLOAD_SECRET for testing
    process.env.PAYLOAD_SECRET = 'test-secret-for-encryption-testing-12345678901234567890'

    payload = await getPayload({ config })

    // Create a test user
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'test-password',
      },
    })
    testUserId = user.id
  })

  afterAll(async () => {
    // Clean up test data
    if (testIntegrationId) {
      await payload.delete({
        collection: 'linear-integrations',
        id: testIntegrationId,
      })
    }
    if (testUserId) {
      await payload.delete({
        collection: 'users',
        id: testUserId,
      })
    }
  })

  it('should encrypt webhook secret when creating a Linear integration', async () => {
    const plainTextSecret = 'my-super-secret-webhook-key-12345'

    // Create integration with webhook secret
    const integration = await payload.create({
      collection: 'linear-integrations',
      data: {
        user: testUserId,
        linearData: {
          organizationId: 'test-org-123',
          organizationName: 'Test Organization',
        },
        webhookSecret: plainTextSecret,
        active: true,
      },
    })

    testIntegrationId = integration.id

    // Verify the secret is encrypted in the response (should be decrypted by afterRead hook)
    expect(integration.webhookSecret).toBe(plainTextSecret)

    // Query the database directly to verify it's actually encrypted
    const rawResult = await payload.db.collections['linear-integrations'].findOne({
      where: { id: { equals: testIntegrationId } },
    })

    // The raw database value should contain encryption metadata (iv:authTag:encrypted)
    expect(rawResult.webhookSecret).toContain(':')
    expect(rawResult.webhookSecret).not.toBe(plainTextSecret)

    // Should have three parts: iv, authTag, and encrypted data
    const parts = rawResult.webhookSecret.split(':')
    expect(parts).toHaveLength(3)
  })

  it('should decrypt webhook secret when reading a Linear integration', async () => {
    const plainTextSecret = 'another-secret-webhook-key-67890'

    // Create integration
    const created = await payload.create({
      collection: 'linear-integrations',
      data: {
        user: testUserId,
        linearData: {
          organizationId: 'test-org-456',
          organizationName: 'Another Test Org',
        },
        webhookSecret: plainTextSecret,
        active: true,
      },
    })

    // Read it back
    const integration = await payload.findByID({
      collection: 'linear-integrations',
      id: created.id,
    })

    // Verify the secret is decrypted
    expect(integration.webhookSecret).toBe(plainTextSecret)

    // Clean up
    await payload.delete({
      collection: 'linear-integrations',
      id: created.id,
    })
  })

  it('should update webhook secret with encryption', async () => {
    const originalSecret = 'original-secret-123'
    const updatedSecret = 'updated-secret-456'

    // Create integration
    const created = await payload.create({
      collection: 'linear-integrations',
      data: {
        user: testUserId,
        linearData: {
          organizationId: 'test-org-789',
          organizationName: 'Update Test Org',
        },
        webhookSecret: originalSecret,
        active: true,
      },
    })

    // Update the secret
    const updated = await payload.update({
      collection: 'linear-integrations',
      id: created.id,
      data: {
        webhookSecret: updatedSecret,
      },
    })

    // Verify the new secret is decrypted correctly
    expect(updated.webhookSecret).toBe(updatedSecret)

    // Read it back to double-check
    const integration = await payload.findByID({
      collection: 'linear-integrations',
      id: created.id,
    })

    expect(integration.webhookSecret).toBe(updatedSecret)

    // Clean up
    await payload.delete({
      collection: 'linear-integrations',
      id: created.id,
    })
  })

  it('should handle integrations without webhook secrets', async () => {
    // Create integration without webhook secret
    const integration = await payload.create({
      collection: 'linear-integrations',
      data: {
        user: testUserId,
        linearData: {
          organizationId: 'test-org-no-secret',
          organizationName: 'No Secret Org',
        },
        active: true,
      },
    })

    // Should not error
    expect(integration.webhookSecret).toBeUndefined()

    // Clean up
    await payload.delete({
      collection: 'linear-integrations',
      id: integration.id,
    })
  })
})
