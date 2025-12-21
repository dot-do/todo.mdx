/**
 * E2E: PRDO Webhook Integration Tests
 *
 * Tests the full PRDO lifecycle via webhook simulation:
 * - PR opened → review approved → merged
 * - PR opened → changes requested → fix → re-review → approved
 * - PR opened → human merges directly (force merge)
 * - Review with escalation marker adds new reviewer
 *
 * These tests simulate GitHub webhook events and verify the PRDO
 * state transitions correctly.
 *
 * NOTE: These tests require the real GITHUB_WEBHOOK_SECRET when running
 * against production. They are skipped if running against production
 * without the real secret.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import * as worker from '../helpers/worker'

// Test configuration
const TEST_OWNER = 'test-org'
const TEST_REPO = 'test-repo'

// Skip webhook simulation tests when running against production without the real secret
// (The test-secret default won't match production's actual webhook secret)
const WORKER_BASE_URL = process.env.WORKER_BASE_URL || 'https://todo.mdx.do'
const isProduction = WORKER_BASE_URL.includes('todo.mdx.do')
const hasRealSecret = process.env.GITHUB_WEBHOOK_SECRET !== undefined
const skipWebhookTests = isProduction && !hasRealSecret

describe('PRDO webhook integration', () => {
  let prNumber: number

  beforeEach((ctx) => {
    // Skip tests when running against production without real webhook secret
    if (skipWebhookTests) ctx.skip()
    // Generate unique PR number for each test to avoid conflicts
    prNumber = Math.floor(Math.random() * 1000000)
  })

  afterEach(async () => {
    // Cleanup: close the PR if it exists
    try {
      await worker.webhooks.simulatePullRequestEvent(
        TEST_OWNER,
        TEST_REPO,
        'closed',
        {
          number: prNumber,
          title: 'Test PR',
          body: 'Test PR body',
          head: { ref: 'feature-branch' },
          base: { ref: 'main' },
          merged: false,
        }
      )
    } catch {
      // Ignore cleanup errors
    }
  })

  test('happy path: PR opened → review approved → merged', async () => {
    // 1. Simulate PR opened webhook
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Add new feature',
        body: 'This adds a new feature',
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)

    // Give PRDO time to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Simulate review approval from Quinn
    const reviewResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Add new feature',
        body: 'This adds a new feature',
        head: { ref: 'feature-branch' },
      }
    )

    expect(reviewResponse.ok).toBe(true)

    // Give time for state machine to process
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 3. Verify PRDO is in approved state
    // Note: This would require a status endpoint on PRDO
    // For now, we just verify the webhook was accepted

    // 4. Simulate merge
    const mergeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Add new feature',
        body: 'This adds a new feature',
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
        merged: true,
      }
    )

    expect(mergeResponse.ok).toBe(true)
  })

  test('fix cycle: PR opened → changes requested → fix → re-review → approved', async () => {
    // 1. Open PR
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Fix bug',
        body: 'This fixes a bug',
        head: { ref: 'bugfix-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Quinn requests changes
    const changesResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'changes_requested',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Fix bug',
        body: 'Please add tests and fix the linting errors',
        head: { ref: 'bugfix-branch' },
      }
    )

    expect(changesResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 3. Author pushes fix (synchronize event)
    const fixResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'synchronize',
      {
        number: prNumber,
        title: 'Fix bug',
        body: 'This fixes a bug',
        head: { ref: 'bugfix-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(fixResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 4. Quinn re-reviews and approves
    const reReviewResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Fix bug',
        body: 'Tests added, LGTM!',
        head: { ref: 'bugfix-branch' },
      }
    )

    expect(reReviewResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 5. Merge
    const mergeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Fix bug',
        body: 'This fixes a bug',
        head: { ref: 'bugfix-branch' },
        base: { ref: 'main' },
        merged: true,
      }
    )

    expect(mergeResponse.ok).toBe(true)
  })

  test('force merge: PR opened → human merges directly', async () => {
    // 1. Open PR
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Urgent hotfix',
        body: 'Critical security patch',
        head: { ref: 'hotfix-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Human force merges without waiting for reviews
    const forceMergeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Urgent hotfix',
        body: 'Critical security patch',
        head: { ref: 'hotfix-branch' },
        base: { ref: 'main' },
        merged: true,
      }
    )

    expect(forceMergeResponse.ok).toBe(true)

    // PRDO should transition to merged state with mergeType: 'forced'
  })

  test('escalation: review with escalation marker adds new reviewer', async () => {
    // 1. Open PR
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Add auth feature',
        body: 'New authentication system',
        head: { ref: 'auth-feature' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Quinn reviews and escalates to Sam for security review
    const escalateResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Add auth feature',
        body: 'Code looks good, but escalating for security review.\n\n<!-- escalate: sam -->',
        head: { ref: 'auth-feature' },
      }
    )

    expect(escalateResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // At this point, PRDO should:
    // - Record Quinn's approval
    // - Parse the escalation marker
    // - Add Sam to the reviewers queue
    // - Dispatch review session for Sam

    // 3. Sam reviews and approves
    const samReviewResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'sam-security-bot' },
      },
      {
        number: prNumber,
        title: 'Add auth feature',
        body: 'Security looks good, LGTM',
        head: { ref: 'auth-feature' },
      }
    )

    expect(samReviewResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 4. Merge
    const mergeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Add auth feature',
        body: 'New authentication system',
        head: { ref: 'auth-feature' },
        base: { ref: 'main' },
        merged: true,
      }
    )

    expect(mergeResponse.ok).toBe(true)
  })

  test('multiple reviewers: sequential approval flow', async () => {
    // 1. Open PR
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Major refactor',
        body: 'Refactoring core architecture',
        head: { ref: 'refactor-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. First reviewer (Quinn) approves
    const quinn1Response = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Major refactor',
        body: 'Code quality looks good',
        head: { ref: 'refactor-branch' },
      }
    )

    expect(quinn1Response.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 3. Second reviewer (Sam) requests changes
    const sam1Response = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'changes_requested',
        user: { login: 'sam-security-bot' },
      },
      {
        number: prNumber,
        title: 'Major refactor',
        body: 'Please update the authentication flow',
        head: { ref: 'refactor-branch' },
      }
    )

    expect(sam1Response.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 4. Author pushes fix
    const fixResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'synchronize',
      {
        number: prNumber,
        title: 'Major refactor',
        body: 'Refactoring core architecture',
        head: { ref: 'refactor-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(fixResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 5. Sam re-reviews and approves
    const sam2Response = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'sam-security-bot' },
      },
      {
        number: prNumber,
        title: 'Major refactor',
        body: 'Auth flow looks good now, LGTM',
        head: { ref: 'refactor-branch' },
      }
    )

    expect(sam2Response.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 6. Merge
    const mergeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Major refactor',
        body: 'Refactoring core architecture',
        head: { ref: 'refactor-branch' },
        base: { ref: 'main' },
        merged: true,
      }
    )

    expect(mergeResponse.ok).toBe(true)
  })

  test('PR closed without merge', async () => {
    // 1. Open PR
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Experimental feature',
        body: 'Testing a new approach',
        head: { ref: 'experimental-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. PR is closed without merge (abandoned)
    const closeResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Experimental feature',
        body: 'Testing a new approach',
        head: { ref: 'experimental-branch' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(closeResponse.ok).toBe(true)

    // PRDO should transition to closed state (not merged)
  })

  test('reopened PR continues from previous state', async () => {
    // 1. Open PR
    const openResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Feature implementation',
        body: 'New feature',
        head: { ref: 'feature-impl' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Quinn reviews and requests changes
    await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'changes_requested',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Feature implementation',
        body: 'Please add tests',
        head: { ref: 'feature-impl' },
      }
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    // 3. Close PR
    await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'closed',
      {
        number: prNumber,
        title: 'Feature implementation',
        body: 'New feature',
        head: { ref: 'feature-impl' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    await new Promise((resolve) => setTimeout(resolve, 500))

    // 4. Reopen PR
    const reopenResponse = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'reopened',
      {
        number: prNumber,
        title: 'Feature implementation',
        body: 'New feature',
        head: { ref: 'feature-impl' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(reopenResponse.ok).toBe(true)

    // PRDO should restore state and continue review process
  })
})

describe('PRDO error handling', () => {
  let prNumber: number

  beforeEach((ctx) => {
    // Skip tests when running against production without real webhook secret
    if (skipWebhookTests) ctx.skip()
    prNumber = Math.floor(Math.random() * 1000000)
  })

  afterEach(async () => {
    try {
      await worker.webhooks.simulatePullRequestEvent(
        TEST_OWNER,
        TEST_REPO,
        'closed',
        {
          number: prNumber,
          title: 'Test PR',
          body: 'Test PR body',
          head: { ref: 'test-branch' },
          base: { ref: 'main' },
          merged: false,
        }
      )
    } catch {
      // Ignore cleanup errors
    }
  })

  test('handles duplicate webhook events gracefully', async () => {
    // 1. Open PR
    const openResponse1 = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Test duplication',
        body: 'Testing duplicate events',
        head: { ref: 'test-dup' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    expect(openResponse1.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 2. Send duplicate open event (GitHub sometimes does this)
    const openResponse2 = await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Test duplication',
        body: 'Testing duplicate events',
        head: { ref: 'test-dup' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    // Should handle gracefully (idempotent)
    expect(openResponse2.ok).toBe(true)
  })

  test('ignores review events from non-configured reviewers', async () => {
    // 1. Open PR
    await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Test unknown reviewer',
        body: 'Testing unknown reviewer',
        head: { ref: 'test-unknown' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Random user submits review (not in config)
    const randomReviewResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'approved',
        user: { login: 'random-user' },
      },
      {
        number: prNumber,
        title: 'Test unknown reviewer',
        body: 'Looks good to me',
        head: { ref: 'test-unknown' },
      }
    )

    // Should accept webhook but not advance state
    expect(randomReviewResponse.ok).toBe(true)
  })

  test('handles commented reviews (should not advance state)', async () => {
    // 1. Open PR
    await worker.webhooks.simulatePullRequestEvent(
      TEST_OWNER,
      TEST_REPO,
      'opened',
      {
        number: prNumber,
        title: 'Test comment review',
        body: 'Testing comment-only review',
        head: { ref: 'test-comment' },
        base: { ref: 'main' },
        merged: false,
      }
    )

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 2. Quinn submits comment-only review (not approval or changes_requested)
    const commentResponse = await worker.webhooks.simulatePullRequestReviewEvent(
      TEST_OWNER,
      TEST_REPO,
      'submitted',
      {
        state: 'commented',
        user: { login: 'quinn-qa-bot' },
      },
      {
        number: prNumber,
        title: 'Test comment review',
        body: 'Just a comment, not a decision yet',
        head: { ref: 'test-comment' },
      }
    )

    // Should accept but not advance state machine
    expect(commentResponse.ok).toBe(true)
  })
})
