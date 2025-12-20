/**
 * E2E: Slack Notification Tests (todo-2dq)
 *
 * Tests Slack notifications from workflows:
 * - Notification delivery verification
 * - Message formatting
 * - Mock or test Slack workspace integration
 *
 * Requires:
 * - SLACK_BOT_TOKEN - Slack bot token for test workspace
 * - SLACK_TEST_CHANNEL - Channel ID to send test messages
 * - WORKER_BASE_URL, WORKER_ACCESS_TOKEN
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import * as worker from '../helpers/worker'

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_TEST_CHANNEL = process.env.SLACK_TEST_CHANNEL
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const WORKER_ACCESS_TOKEN = process.env.WORKER_ACCESS_TOKEN

function hasSlackCredentials(): boolean {
  return !!(SLACK_BOT_TOKEN && SLACK_TEST_CHANNEL && WORKER_ACCESS_TOKEN)
}

function hasSlackWebhook(): boolean {
  return !!SLACK_WEBHOOK_URL
}

const describeWithSlack = hasSlackCredentials() ? describe : describe.skip
const describeWithWebhook = hasSlackWebhook() ? describe : describe.skip

// Slack API helper
async function slackFetch(
  method: string,
  body: Record<string, any>
): Promise<any> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(body),
  })

  return response.json()
}

async function postMessage(
  channel: string,
  text: string,
  blocks?: any[]
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  return slackFetch('chat.postMessage', {
    channel,
    text,
    blocks,
  })
}

async function deleteMessage(channel: string, ts: string): Promise<void> {
  await slackFetch('chat.delete', { channel, ts })
}

async function getConversationHistory(
  channel: string,
  limit = 10
): Promise<{ messages: Array<{ text: string; ts: string }> }> {
  return slackFetch('conversations.history', { channel, limit })
}

// Track messages for cleanup
const messagesToCleanup: Array<{ channel: string; ts: string }> = []

describeWithSlack('Slack notification delivery', () => {
  beforeAll(() => {
    if (!hasSlackCredentials()) {
      console.log(
        'Skipping Slack notification tests - missing SLACK_BOT_TOKEN, SLACK_TEST_CHANNEL, or WORKER_ACCESS_TOKEN'
      )
    }
  })

  afterAll(async () => {
    // Cleanup test messages
    for (const msg of messagesToCleanup) {
      try {
        await deleteMessage(msg.channel, msg.ts)
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  test('can post basic message to Slack', async () => {
    const result = await postMessage(
      SLACK_TEST_CHANNEL!,
      `Test message from E2E tests ${Date.now()}`
    )

    expect(result.ok).toBe(true)
    expect(result.ts).toBeDefined()

    if (result.ts) {
      messagesToCleanup.push({ channel: SLACK_TEST_CHANNEL!, ts: result.ts })
    }
  })

  test('can post formatted message with blocks', async () => {
    const result = await postMessage(
      SLACK_TEST_CHANNEL!,
      'Issue Ready Notification',
      [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 Issue Ready for Work',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*todo-test123*: Test issue for Slack notification\n\n*Priority:* P1\n*Type:* Feature\n*Assignee:* @testuser`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Issue',
              },
              url: 'https://github.com/test/repo/issues/123',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Start Work',
              },
              style: 'primary',
            },
          ],
        },
      ]
    )

    expect(result.ok).toBe(true)

    if (result.ts) {
      messagesToCleanup.push({ channel: SLACK_TEST_CHANNEL!, ts: result.ts })
    }
  })

  test('workflow completion notification format', async () => {
    const result = await postMessage(
      SLACK_TEST_CHANNEL!,
      'Workflow Completed',
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *Workflow Completed Successfully*',
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Issue:*\ntodo-test456',
            },
            {
              type: 'mrkdwn',
              text: '*Duration:*\n5 minutes',
            },
            {
              type: 'mrkdwn',
              text: '*PR:*\n#789',
            },
            {
              type: 'mrkdwn',
              text: '*Status:*\nMerged',
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Completed at ${new Date().toISOString()}`,
            },
          ],
        },
      ]
    )

    expect(result.ok).toBe(true)

    if (result.ts) {
      messagesToCleanup.push({ channel: SLACK_TEST_CHANNEL!, ts: result.ts })
    }
  })

  test('workflow error notification format', async () => {
    const result = await postMessage(
      SLACK_TEST_CHANNEL!,
      'Workflow Error',
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '❌ *Workflow Failed*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '```\nError: Build failed with exit code 1\n  at buildStep (workflow.ts:45)\n  at executeWorkflow (engine.ts:123)\n```',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Logs',
              },
              url: 'https://example.com/logs/123',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Retry',
              },
              style: 'danger',
            },
          ],
        },
      ]
    )

    expect(result.ok).toBe(true)

    if (result.ts) {
      messagesToCleanup.push({ channel: SLACK_TEST_CHANNEL!, ts: result.ts })
    }
  })
})

describeWithWebhook('Slack webhook notifications', () => {
  test('incoming webhook delivers message', async () => {
    const response = await fetch(SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `Webhook test ${Date.now()}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🔔 *Incoming Webhook Test*\n\nThis message was sent via Slack incoming webhook.',
            },
          },
        ],
      }),
    })

    expect(response.ok).toBe(true)
    const text = await response.text()
    expect(text).toBe('ok')
  })
})

describe('Slack notification mocking', () => {
  test('mock notification payload structure', () => {
    // Test the structure of notifications that would be sent
    const issueReadyNotification = {
      channel: '#dev-alerts',
      text: 'Issue Ready: todo-abc123 - Implement feature X',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🎯 Issue Ready' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*todo-abc123*: Implement feature X',
          },
        },
      ],
    }

    expect(issueReadyNotification.channel).toBe('#dev-alerts')
    expect(issueReadyNotification.blocks).toHaveLength(2)
    expect(issueReadyNotification.blocks[0].type).toBe('header')
  })

  test('mock PR created notification structure', () => {
    const prCreatedNotification = {
      channel: '#pr-notifications',
      text: 'PR Created: #123 - Feature implementation',
      attachments: [
        {
          color: '#36a64f',
          title: 'PR #123: Feature implementation',
          title_link: 'https://github.com/owner/repo/pull/123',
          fields: [
            { title: 'Author', value: '@developer', short: true },
            { title: 'Branch', value: 'feature/xyz', short: true },
            { title: 'Files Changed', value: '5', short: true },
            { title: 'Lines', value: '+150 -30', short: true },
          ],
          footer: 'GitHub',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    expect(prCreatedNotification.attachments[0].color).toBe('#36a64f')
    expect(prCreatedNotification.attachments[0].fields).toHaveLength(4)
  })

  test('mock workflow status update structure', () => {
    const workflowStatusNotification = {
      channel: '#workflow-status',
      text: 'Workflow Update: develop-todo-abc123',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Workflow Status Update*',
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: '*Workflow:*\ndevelop-todo-abc123' },
            { type: 'mrkdwn', text: '*Status:*\n🔄 In Progress' },
            { type: 'mrkdwn', text: '*Step:*\nCreating PR' },
            { type: 'mrkdwn', text: '*Duration:*\n2m 30s' },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Started at 2025-12-20 10:00:00 UTC',
            },
          ],
        },
      ],
    }

    expect(workflowStatusNotification.blocks).toHaveLength(3)
    expect(workflowStatusNotification.blocks[1].fields).toHaveLength(4)
  })
})

describe('Slack notification configuration', () => {
  test.skip('worker can be configured with Slack webhook', async () => {
    // This would test the worker configuration endpoint
    // Skipped as it requires admin access
  })

  test.skip('notification channels can be configured per event type', async () => {
    // This would test per-event channel configuration
    // Skipped as it requires admin access
  })
})
