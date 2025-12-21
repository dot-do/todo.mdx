import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createTestWorktree, type Worktree } from '../helpers/worktree'
import * as beads from '../helpers/beads'

// Track if bd CLI is available (checked once on startup)
let hasBd = false

describe('beads workflow', () => {
  let worktree: Worktree

  beforeAll(async () => {
    hasBd = await beads.hasBdCli()
    if (!hasBd) {
      console.log('Skipping beads workflow tests - bd CLI not installed')
    }
  })

  beforeEach(async (ctx) => {
    if (!hasBd) ctx.skip()
    worktree = await createTestWorktree('beads-workflow')
  })

  afterEach(async () => {
    if (worktree) await worktree.cleanup()
  })

  test('bd init creates .beads directory', async () => {
    // Initially no .beads directory
    expect(await beads.hasBeadsDir(worktree)).toBe(false)

    // Initialize beads
    await beads.init(worktree, 'test')

    // .beads directory should exist
    expect(await beads.hasBeadsDir(worktree)).toBe(true)
  })

  test('bd create creates an issue', async () => {
    await beads.init(worktree, 'test')

    const issueId = await beads.create(worktree, {
      title: 'Test issue creation',
      type: 'task',
      priority: 2,
    })

    expect(issueId).toBeTruthy()
    expect(issueId).toMatch(/^test-/)

    // Verify issue appears in list
    const listOutput = await beads.list(worktree)
    expect(listOutput).toContain('Test issue creation')
  })

  test('bd create with dependencies', async () => {
    await beads.init(worktree, 'test')

    // Create two issues
    const blockingIssueId = await beads.create(worktree, {
      title: 'Blocking issue',
      type: 'task',
    })

    const dependentIssueId = await beads.create(worktree, {
      title: 'Dependent issue',
      type: 'task',
    })

    // Add dependency
    await beads.dep(worktree, dependentIssueId, blockingIssueId, 'blocks')

    // Verify blocked status
    const blockedOutput = await beads.blocked(worktree)
    expect(blockedOutput).toContain(dependentIssueId)
  })

  test('bd ready filters blocked issues', async () => {
    await beads.init(worktree, 'test')

    // Create a blocker and a blocked issue
    const blockerId = await beads.create(worktree, {
      title: 'Blocker task',
      type: 'task',
    })

    const blockedId = await beads.create(worktree, {
      title: 'Blocked task',
      type: 'task',
    })

    // Create a standalone ready issue
    const readyId = await beads.create(worktree, {
      title: 'Ready task',
      type: 'task',
    })

    // Add dependency (blockedId depends on blockerId)
    await beads.dep(worktree, blockedId, blockerId, 'blocks')

    // Check ready list
    const readyOutput = await beads.ready(worktree)

    // Blocker should be ready
    expect(readyOutput).toContain('Blocker task')
    // Ready issue should be ready
    expect(readyOutput).toContain('Ready task')
    // Blocked issue should NOT be in ready list
    expect(readyOutput).not.toContain('Blocked task')
  })

  test('bd update changes issue status', async () => {
    await beads.init(worktree, 'test')

    const issueId = await beads.create(worktree, {
      title: 'Status test issue',
      type: 'task',
    })

    // Update to in_progress
    await beads.update(worktree, issueId, { status: 'in_progress' })

    // Verify status changed
    const showOutput = await beads.show(worktree, issueId)
    expect(showOutput).toContain('in_progress')
  })

  test('bd close marks issue as closed', async () => {
    await beads.init(worktree, 'test')

    const issueId = await beads.create(worktree, {
      title: 'Issue to close',
      type: 'task',
    })

    // Close the issue
    await beads.close(worktree, issueId, 'Completed in test')

    // Verify closed
    const listOutput = await beads.list(worktree, { status: 'closed' })
    expect(listOutput).toContain('Issue to close')
  })

  test('bd dep add creates blocking relationship', async () => {
    await beads.init(worktree, 'test')

    const parentId = await beads.create(worktree, {
      title: 'Parent epic',
      type: 'epic',
    })

    const childId = await beads.create(worktree, {
      title: 'Child task',
      type: 'task',
    })

    // Create parent-child relationship
    await beads.dep(worktree, childId, parentId, 'parent-child')

    // Show should display the relationship
    const showOutput = await beads.show(worktree, childId)
    expect(showOutput).toContain(parentId)
  })
})
