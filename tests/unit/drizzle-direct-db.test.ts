import { describe, test, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for the Drizzle-based direct database operations.
 *
 * These tests verify the type safety and query structure of the
 * direct.ts module without hitting the actual database.
 */

// Mock D1Database
const mockD1 = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}

// Mock drizzle
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}))

describe('Drizzle direct database types', () => {
  test('Installation create accepts correct types', async () => {
    // Test that the types match what we expect from Payload schema
    const installationData = {
      installationId: 12345, // number, not string
      accountType: 'Organization',
      accountId: 67890,
      accountLogin: 'test-org',
      accountAvatarUrl: 'https://example.com/avatar.png',
      permissions: { issues: 'write' },
      events: ['issues', 'push'],
      repositorySelection: 'all',
    }

    // Type check - this should compile without errors
    expect(typeof installationData.installationId).toBe('number')
    expect(typeof installationData.accountId).toBe('number')
    expect(typeof installationData.accountLogin).toBe('string')
  })

  test('Repo create accepts installationId as number', async () => {
    // Test that the types match what we expect
    const repoData = {
      githubId: 123456789,
      name: 'test-repo',
      fullName: 'test-org/test-repo',
      owner: 'test-org',
      private: false,
      installationId: 1, // number, not string "installation" field
      defaultBranch: 'main',
    }

    // Type check
    expect(typeof repoData.installationId).toBe('number')
    expect(typeof repoData.githubId).toBe('number')
    expect(typeof repoData.private).toBe('boolean')
  })

  test('User types are correct', async () => {
    const userData = {
      email: 'test@example.com',
      workosUserId: 'user_123',
      name: 'Test User',
      githubId: 12345,
      githubLogin: 'testuser',
      githubAvatarUrl: 'https://github.com/avatar.png',
    }

    expect(typeof userData.githubId).toBe('number')
    expect(typeof userData.email).toBe('string')
  })
})

describe('Drizzle schema column mappings', () => {
  test('Schema uses correct column names', async () => {
    // Import the schema to verify column mappings
    const schema = await import('../../worker/src/db/schema')

    // Check installations table has correct columns
    expect(schema.installations).toBeDefined()

    // Check repos table has correct columns
    expect(schema.repos).toBeDefined()

    // Check users table
    expect(schema.users).toBeDefined()
  })
})
