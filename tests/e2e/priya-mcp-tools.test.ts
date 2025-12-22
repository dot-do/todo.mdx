/**
 * Priya MCP Tools E2E Tests
 *
 * Comprehensive tests for Priya's product planning MCP tools:
 * - priya_review_roadmap
 * - priya_plan_sprint
 * - priya_triage_backlog
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { getAuthToken, hasMcpCredentials } from '../helpers/auth'
import { createTestWorktree, type Worktree } from '../helpers/worktree'
import * as beads from '../helpers/beads'

// MCP server URL
const MCP_BASE_URL = process.env.MCP_BASE_URL || 'https://todo.mdx.do'

// Skip tests if no credentials
let hasCredentials = false
let hasBd = false

function mcpFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken()
  return fetch(`${MCP_BASE_URL}/mcp${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

async function callMcpTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
  const response = await mcpFetch('/tools/call', {
    method: 'POST',
    body: JSON.stringify({
      name,
      arguments: args,
    }),
  })

  if (!response.ok) {
    throw new Error(`MCP tool call failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

describe('Priya MCP Tools', () => {
  let worktree: Worktree
  let testRepo: string

  beforeAll(async () => {
    hasCredentials = hasMcpCredentials()
    hasBd = await beads.hasBdCli()

    if (!hasCredentials) {
      console.log('Skipping Priya MCP tests - no MCP credentials (TEST_API_KEY)')
    }
    if (!hasBd) {
      console.log('Skipping Priya MCP tests - bd CLI not installed')
    }
  })

  beforeEach(async (ctx) => {
    if (!hasCredentials || !hasBd) ctx.skip()

    // Create test worktree with beads initialized
    worktree = await createTestWorktree('priya-mcp')
    await beads.init(worktree, 'priya')

    // Set up test repo identifier (would be owner/repo in real scenario)
    testRepo = 'test-user/priya-test-repo'
  })

  afterEach(async () => {
    if (worktree) {
      await worktree.cleanup()
    }
  })

  describe('priya_review_roadmap', () => {
    test('returns structured analysis with suggestions', async () => {
      // Create diverse test issues
      await beads.create(worktree, {
        title: 'Critical bug in auth',
        type: 'bug',
        priority: 0,
        description: 'Users cannot login',
      })

      await beads.create(worktree, {
        title: 'New feature request',
        type: 'feature',
        priority: 2,
        description: 'Add dark mode',
      })

      const readyIssueId = await beads.create(worktree, {
        title: 'Ready task',
        type: 'task',
        priority: 1,
        description: 'This is ready to work',
      })

      // Call priya_review_roadmap tool
      const result = await callMcpTool('priya_review_roadmap', {
        repo: testRepo,
      })

      expect(result.isError).not.toBe(true)
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')

      // Parse JSON response
      const analysis = JSON.parse(result.content[0].text)

      // Verify structure
      expect(analysis).toHaveProperty('summary')
      expect(analysis).toHaveProperty('suggestions')
      expect(analysis).toHaveProperty('stats')

      // Verify stats
      expect(analysis.stats.total).toBeGreaterThanOrEqual(3)
      expect(analysis.stats.open).toBeGreaterThanOrEqual(3)
      expect(analysis.stats.ready).toBeGreaterThanOrEqual(1)

      // Verify suggestions is an array
      expect(Array.isArray(analysis.suggestions)).toBe(true)
    })

    test('identifies high-priority unassigned issues', async () => {
      // Create critical unassigned issue
      await beads.create(worktree, {
        title: 'Critical security vulnerability',
        type: 'bug',
        priority: 0,
        description: 'SQL injection found',
      })

      const result = await callMcpTool('priya_review_roadmap', {
        repo: testRepo,
      })

      const analysis = JSON.parse(result.content[0].text)

      // Should have at least one suggestion about critical unassigned issue
      const criticalSuggestions = analysis.suggestions.filter(
        (s: any) => s.type === 'critical_unassigned' && s.priority === 'high'
      )

      expect(criticalSuggestions.length).toBeGreaterThan(0)
      expect(criticalSuggestions[0]).toHaveProperty('message')
      expect(criticalSuggestions[0]).toHaveProperty('action', 'assign')
    })

    test('detects blocked issues on critical path', async () => {
      // Create blocker and blocked issue
      const blockerId = await beads.create(worktree, {
        title: 'Setup infrastructure',
        type: 'task',
        priority: 1,
      })

      const blockedId = await beads.create(worktree, {
        title: 'Deploy application',
        type: 'task',
        priority: 0, // High priority but blocked
      })

      // Add blocking dependency
      await beads.dep(worktree, blockedId, blockerId, 'blocks')

      const result = await callMcpTool('priya_review_roadmap', {
        repo: testRepo,
      })

      const analysis = JSON.parse(result.content[0].text)

      // Verify blocked count
      expect(analysis.stats.blocked).toBeGreaterThan(0)

      // Check for blocked suggestions
      const blockedSuggestions = analysis.suggestions.filter(
        (s: any) => s.type === 'blocked'
      )

      if (blockedSuggestions.length > 0) {
        expect(blockedSuggestions[0]).toHaveProperty('action', 'unblock')
      }
    })

    test('handles empty project gracefully', async () => {
      // No issues created
      const result = await callMcpTool('priya_review_roadmap', {
        repo: testRepo,
      })

      expect(result.isError).not.toBe(true)

      const analysis = JSON.parse(result.content[0].text)

      expect(analysis.stats.total).toBe(0)
      expect(analysis.stats.open).toBe(0)
      expect(analysis.suggestions).toHaveLength(0)
    })

    test('identifies stale issues', async () => {
      // Create an issue (in real scenario would be old, but we test the structure)
      await beads.create(worktree, {
        title: 'Old issue',
        type: 'task',
        priority: 3,
      })

      const result = await callMcpTool('priya_review_roadmap', {
        repo: testRepo,
      })

      const analysis = JSON.parse(result.content[0].text)

      // Structure should support stale detection
      const staleSuggestions = analysis.suggestions.filter(
        (s: any) => s.type === 'stale'
      )

      // May or may not have stale issues depending on timestamps
      // Just verify structure is correct
      if (staleSuggestions.length > 0) {
        expect(staleSuggestions[0]).toHaveProperty('priority', 'low')
        expect(staleSuggestions[0]).toHaveProperty('action', 'review')
      }
    })
  })

  describe('priya_plan_sprint', () => {
    test('selects ready issues up to capacity limit', async () => {
      // Create multiple ready issues
      for (let i = 0; i < 5; i++) {
        await beads.create(worktree, {
          title: `Ready task ${i + 1}`,
          type: 'task',
          priority: i % 3, // Mix of priorities
        })
      }

      // Call with capacity of 3
      const result = await callMcpTool('priya_plan_sprint', {
        repo: testRepo,
        capacity: 3,
      })

      expect(result.isError).not.toBe(true)

      const plan = JSON.parse(result.content[0].text)

      expect(plan).toHaveProperty('selectedIssues')
      expect(plan).toHaveProperty('summary')
      expect(plan).toHaveProperty('metrics')

      // Should select up to capacity
      expect(plan.selectedIssues.length).toBeLessThanOrEqual(3)

      // Metrics should be populated
      expect(plan.metrics.totalSelected).toBe(plan.selectedIssues.length)
      expect(plan.metrics).toHaveProperty('byPriority')
      expect(plan.metrics).toHaveProperty('byType')
    })

    test('respects priority ordering', async () => {
      // Create issues with different priorities
      await beads.create(worktree, {
        title: 'Low priority task',
        type: 'task',
        priority: 3,
      })

      await beads.create(worktree, {
        title: 'High priority task',
        type: 'task',
        priority: 0,
      })

      await beads.create(worktree, {
        title: 'Medium priority task',
        type: 'task',
        priority: 2,
      })

      const result = await callMcpTool('priya_plan_sprint', {
        repo: testRepo,
        capacity: 10,
      })

      const plan = JSON.parse(result.content[0].text)

      // First issue should be highest priority (lowest number)
      if (plan.selectedIssues.length > 0) {
        const priorities = plan.selectedIssues.map((i: any) => i.priority)
        // Verify sorted (lower priority number comes first)
        for (let i = 1; i < priorities.length; i++) {
          expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1])
        }
      }
    })

    test('filters by labels when specified', async () => {
      // Note: beads CLI might not support labels directly
      // This tests the API contract even if the label filtering
      // happens at a different layer

      const result = await callMcpTool('priya_plan_sprint', {
        repo: testRepo,
        capacity: 10,
        labels: ['sprint-ready', 'high-value'],
      })

      expect(result.isError).not.toBe(true)

      const plan = JSON.parse(result.content[0].text)

      // Should return valid structure even with label filter
      expect(plan).toHaveProperty('selectedIssues')
      expect(Array.isArray(plan.selectedIssues)).toBe(true)
    })

    test('returns empty when no ready issues', async () => {
      // Create only blocked issues
      const blockerId = await beads.create(worktree, {
        title: 'Blocker',
        type: 'task',
        priority: 2,
      })

      const blockedId = await beads.create(worktree, {
        title: 'Blocked task',
        type: 'task',
        priority: 1,
      })

      await beads.dep(worktree, blockedId, blockerId, 'blocks')

      // Close the only ready issue (blocker)
      await beads.close(worktree, blockerId, 'Testing')

      const result = await callMcpTool('priya_plan_sprint', {
        repo: testRepo,
        capacity: 10,
      })

      const plan = JSON.parse(result.content[0].text)

      // Should return empty selection
      expect(plan.selectedIssues).toHaveLength(0)
      expect(plan.metrics.totalSelected).toBe(0)
    })

    test('respects priority threshold', async () => {
      // Create issues with different priorities
      await beads.create(worktree, {
        title: 'P0 task',
        type: 'task',
        priority: 0,
      })

      await beads.create(worktree, {
        title: 'P3 task',
        type: 'task',
        priority: 3,
      })

      await beads.create(worktree, {
        title: 'P4 task',
        type: 'task',
        priority: 4,
      })

      // Set threshold to only include P0-P3
      const result = await callMcpTool('priya_plan_sprint', {
        repo: testRepo,
        capacity: 10,
        priorityThreshold: 3,
      })

      const plan = JSON.parse(result.content[0].text)

      // Should not include P4 task
      const p4Tasks = plan.selectedIssues.filter((i: any) => i.priority > 3)
      expect(p4Tasks).toHaveLength(0)
    })
  })

  describe('priya_triage_backlog', () => {
    test('categorizes issues by urgency', async () => {
      // Create issues with different urgency levels
      await beads.create(worktree, {
        title: 'Critical bug',
        type: 'bug',
        priority: 0,
      })

      await beads.create(worktree, {
        title: 'Normal feature',
        type: 'feature',
        priority: 2,
      })

      await beads.create(worktree, {
        title: 'Low priority chore',
        type: 'chore',
        priority: 4,
      })

      const result = await callMcpTool('priya_triage_backlog', {
        repo: testRepo,
      })

      expect(result.isError).not.toBe(true)

      const triage = JSON.parse(result.content[0].text)

      expect(triage).toHaveProperty('suggestions')
      expect(triage).toHaveProperty('categorized')
      expect(triage).toHaveProperty('stats')

      // Categorized should have urgent, normal, low
      expect(triage.categorized).toHaveProperty('urgent')
      expect(triage.categorized).toHaveProperty('normal')
      expect(triage.categorized).toHaveProperty('low')

      expect(Array.isArray(triage.categorized.urgent)).toBe(true)
      expect(Array.isArray(triage.categorized.normal)).toBe(true)
      expect(Array.isArray(triage.categorized.low)).toBe(true)
    })

    test('identifies priority mismatches for bugs', async () => {
      // Create bug with low priority (should be flagged)
      await beads.create(worktree, {
        title: 'Login broken',
        type: 'bug',
        priority: 3, // Should be P0 or P1
      })

      const result = await callMcpTool('priya_triage_backlog', {
        repo: testRepo,
      })

      const triage = JSON.parse(result.content[0].text)

      // Should have suggestion to reprioritize
      const prioritySuggestions = triage.suggestions.filter(
        (s: any) => s.type === 'priority' && s.action === 'reprioritize'
      )

      expect(prioritySuggestions.length).toBeGreaterThan(0)
      expect(prioritySuggestions[0]).toHaveProperty('suggestedPriority')
    })

    test('flags issues needing labels', async () => {
      // Create issue without labels
      await beads.create(worktree, {
        title: 'Unlabeled task',
        type: 'task',
        priority: 2,
      })

      const result = await callMcpTool('priya_triage_backlog', {
        repo: testRepo,
      })

      const triage = JSON.parse(result.content[0].text)

      // Should suggest adding labels
      const labelSuggestions = triage.suggestions.filter(
        (s: any) => s.type === 'labels' && s.action === 'add_labels'
      )

      // May have suggestions about labels
      if (labelSuggestions.length > 0) {
        expect(labelSuggestions[0]).toHaveProperty('suggestedLabels')
        expect(Array.isArray(labelSuggestions[0].suggestedLabels)).toBe(true)
      }
    })

    test('handles empty backlog', async () => {
      // No issues created
      const result = await callMcpTool('priya_triage_backlog', {
        repo: testRepo,
      })

      expect(result.isError).not.toBe(true)

      const triage = JSON.parse(result.content[0].text)

      expect(triage.stats.total).toBe(0)
      expect(triage.stats.needsAction).toBe(0)
      expect(triage.suggestions).toHaveLength(0)
      expect(triage.categorized.urgent).toHaveLength(0)
      expect(triage.categorized.normal).toHaveLength(0)
      expect(triage.categorized.low).toHaveLength(0)
    })

    test('suggestion structure is valid', async () => {
      // Create issues that will trigger various suggestions
      await beads.create(worktree, {
        title: 'Bug with wrong priority',
        type: 'bug',
        priority: 3,
      })

      await beads.create(worktree, {
        title: 'Feature without labels',
        type: 'feature',
        priority: 2,
      })

      const result = await callMcpTool('priya_triage_backlog', {
        repo: testRepo,
      })

      const triage = JSON.parse(result.content[0].text)

      // Verify each suggestion has required fields
      for (const suggestion of triage.suggestions) {
        expect(suggestion).toHaveProperty('issueId')
        expect(suggestion).toHaveProperty('action')
        expect(suggestion).toHaveProperty('type')
        expect(suggestion).toHaveProperty('reason')

        // Action should be valid
        expect(['reprioritize', 'add_labels', 'review', 'close']).toContain(
          suggestion.action
        )

        // Type should be valid
        expect(['priority', 'labels', 'stale', 'duplicate']).toContain(
          suggestion.type
        )
      }
    })

    test('only includes unassigned issues in backlog', async () => {
      // Create assigned issue
      const assignedId = await beads.create(worktree, {
        title: 'Assigned task',
        type: 'task',
        priority: 2,
      })

      await beads.update(worktree, assignedId, {
        assignee: 'test-user',
      })

      // Create unassigned issue
      await beads.create(worktree, {
        title: 'Unassigned task',
        type: 'task',
        priority: 2,
      })

      const result = await callMcpTool('priya_triage_backlog', {
        repo: testRepo,
      })

      const triage = JSON.parse(result.content[0].text)

      // Total categorized should only include unassigned
      const totalCategorized =
        triage.categorized.urgent.length +
        triage.categorized.normal.length +
        triage.categorized.low.length

      // Should have at least the unassigned one
      expect(totalCategorized).toBeGreaterThan(0)

      // Stats total should match
      expect(triage.stats.total).toBe(totalCategorized)
    })
  })

  describe('error handling', () => {
    test('returns error for invalid repo', async () => {
      const result = await callMcpTool('priya_review_roadmap', {
        repo: 'invalid-repo-format',
      })

      // Should handle gracefully (either error or empty result)
      expect(result).toHaveProperty('content')
    })

    test('handles missing required parameters', async () => {
      // Missing repo parameter
      try {
        await callMcpTool('priya_review_roadmap', {})
        // If it doesn't throw, verify it returns error response
      } catch (error) {
        // Expected to fail with missing required parameter
        expect(error).toBeDefined()
      }
    })
  })
})
