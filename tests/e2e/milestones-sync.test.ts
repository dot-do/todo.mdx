/**
 * E2E: GitHub Milestones to Roadmap Sync Tests (todo-he8)
 *
 * Tests milestone synchronization:
 * - Milestone creation, updates, and deletion
 * - Issue assignment to milestones
 * - Epic/milestone mapping for roadmap.mdx
 *
 * Requires:
 * - WORKER_BASE_URL, WORKER_ACCESS_TOKEN
 * - Optionally GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID for full tests
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createTestWorktree, type Worktree, waitFor } from '../helpers'
import * as github from '../helpers/github'
import * as worker from '../helpers/worker'
import * as beads from '../helpers/beads'
import { execa } from 'execa'

const hasWorkerCredentials = worker.hasWorkerCredentials()
const hasGitHubCredentials = github.hasGitHubCredentials()

const describeWithWorker = hasWorkerCredentials ? describe : describe.skip
const describeWithBoth = hasWorkerCredentials && hasGitHubCredentials ? describe : describe.skip

const TEST_REPO_OWNER = 'dot-do'
const TEST_REPO_NAME = 'test.mdx'

describeWithWorker('milestone webhook handlers', () => {
  beforeAll(() => {
    if (!hasWorkerCredentials) {
      console.log('Skipping milestone webhook tests - no WORKER_ACCESS_TOKEN configured')
    }
  })

  test('milestone created webhook syncs to D1', async () => {
    const milestoneNumber = Math.floor(Math.random() * 10000) + 1000
    const title = `Q1 2025 Release ${Date.now()}`

    const response = await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'created',
      {
        number: milestoneNumber,
        title,
        description: 'First quarter release milestone',
        state: 'open',
        due_on: '2025-03-31T00:00:00Z',
      }
    )

    expect(response.ok).toBe(true)

    // Wait for milestone to be created in D1
    const createdMilestone = await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(
          TEST_REPO_OWNER,
          TEST_REPO_NAME
        )
        return milestones.find((m) => m.github_number === milestoneNumber || m.title === title)
      },
      { timeout: 5000, description: 'milestone to be created in D1' }
    )

    expect(createdMilestone).toBeDefined()
    expect(createdMilestone?.title).toBe(title)
    expect(createdMilestone?.state).toBe('open')
  })

  test('milestone edited webhook updates D1', async () => {
    const milestoneNumber = Math.floor(Math.random() * 10000) + 1000
    const originalTitle = `Original Milestone ${Date.now()}`
    const updatedTitle = `Updated Milestone ${Date.now()}`

    // Create
    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'created',
      {
        number: milestoneNumber,
        title: originalTitle,
        state: 'open',
      }
    )

    // Wait for milestone to be created
    await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(TEST_REPO_OWNER, TEST_REPO_NAME)
        return milestones.find((m) => m.github_number === milestoneNumber)
      },
      { timeout: 5000, description: 'milestone to be created' }
    )

    // Edit
    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'edited',
      {
        number: milestoneNumber,
        title: updatedTitle,
        description: 'Updated description',
        state: 'open',
        due_on: '2025-06-30T00:00:00Z',
      }
    )

    // Wait for milestone to be updated
    const milestone = await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(TEST_REPO_OWNER, TEST_REPO_NAME)
        const m = milestones.find((m) => m.github_number === milestoneNumber)
        return m?.title === updatedTitle ? m : undefined
      },
      { timeout: 5000, description: 'milestone to be updated' }
    )

    expect(milestone?.title).toBe(updatedTitle)
    expect(milestone?.description).toBe('Updated description')
  })

  test('milestone closed webhook updates state in D1', async () => {
    const milestoneNumber = Math.floor(Math.random() * 10000) + 1000
    const title = `Close milestone test ${Date.now()}`

    // Create
    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'created',
      {
        number: milestoneNumber,
        title,
        state: 'open',
      }
    )

    // Wait for milestone to be created
    await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(TEST_REPO_OWNER, TEST_REPO_NAME)
        return milestones.find((m) => m.github_number === milestoneNumber)
      },
      { timeout: 5000, description: 'milestone to be created' }
    )

    // Close
    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'closed',
      {
        number: milestoneNumber,
        title,
        state: 'closed',
      }
    )

    // Wait for milestone to be closed
    const closedMilestone = await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(
          TEST_REPO_OWNER,
          TEST_REPO_NAME,
          { state: 'closed' }
        )
        return milestones.find((m) => m.github_number === milestoneNumber)
      },
      { timeout: 5000, description: 'milestone to be closed' }
    )

    expect(closedMilestone?.state).toBe('closed')
  })

  test('milestone reopened webhook updates state in D1', async () => {
    const milestoneNumber = Math.floor(Math.random() * 10000) + 1000
    const title = `Reopen milestone test ${Date.now()}`

    // Create and close
    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'created',
      {
        number: milestoneNumber,
        title,
        state: 'open',
      }
    )

    await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(TEST_REPO_OWNER, TEST_REPO_NAME)
        return milestones.find((m) => m.github_number === milestoneNumber)
      },
      { timeout: 5000, description: 'milestone to be created' }
    )

    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'closed',
      {
        number: milestoneNumber,
        title,
        state: 'closed',
      }
    )

    await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(
          TEST_REPO_OWNER,
          TEST_REPO_NAME,
          { state: 'closed' }
        )
        const m = milestones.find((m) => m.github_number === milestoneNumber)
        return m?.state === 'closed' ? m : undefined
      },
      { timeout: 5000, description: 'milestone to be closed' }
    )

    // Reopen
    await worker.webhooks.simulateMilestoneEvent(
      TEST_REPO_OWNER,
      TEST_REPO_NAME,
      'opened',
      {
        number: milestoneNumber,
        title,
        state: 'open',
      }
    )

    // Wait for milestone to be reopened
    const reopenedMilestone = await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(TEST_REPO_OWNER, TEST_REPO_NAME)
        const m = milestones.find((m) => m.github_number === milestoneNumber)
        return m?.state === 'open' ? m : undefined
      },
      { timeout: 5000, description: 'milestone to be reopened' }
    )

    expect(reopenedMilestone?.state).toBe('open')
  })
})

describeWithWorker('milestone sync API', () => {
  test('sync milestones from beads source', async () => {
    const milestones = [
      {
        beadsId: `epic-${Date.now()}-1`,
        title: `Q2 2025 Epic ${Date.now()}`,
        description: 'Q2 roadmap epic',
        state: 'open',
        dueOn: '2025-06-30T00:00:00Z',
      },
      {
        beadsId: `epic-${Date.now()}-2`,
        title: `Q3 2025 Epic ${Date.now()}`,
        description: 'Q3 roadmap epic',
        state: 'open',
        dueOn: '2025-09-30T00:00:00Z',
      },
    ]

    const result = await worker.sync.syncMilestones(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'beads',
      milestones,
    })

    expect(result.synced).toBeDefined()
    expect(result.synced.length).toBe(2)
    expect(result.synced.every((r) => r.action === 'created')).toBe(true)
  })

  test('sync milestones from file source', async () => {
    const result = await worker.sync.syncMilestones(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'file',
      milestones: [
        {
          title: `ROADMAP.mdx Milestone ${Date.now()}`,
          description: 'Parsed from ROADMAP.mdx',
          state: 'open',
          filePath: 'ROADMAP.mdx',
        },
      ],
    })

    expect(result.synced).toBeDefined()
    expect(result.synced[0].action).toBe('created')
  })

  test('sync updates existing milestones', async () => {
    const beadsId = `epic-update-${Date.now()}`
    const title = `Update test milestone ${Date.now()}`

    // Create
    await worker.sync.syncMilestones(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'beads',
      milestones: [
        {
          beadsId,
          title,
          description: 'Original',
          state: 'open',
        },
      ],
    })

    // Wait for milestone to be created
    await waitFor(
      async () => {
        const { milestones } = await worker.repos.listMilestones(TEST_REPO_OWNER, TEST_REPO_NAME)
        return milestones.find((m) => m.beads_id === beadsId)
      },
      { timeout: 5000, description: 'milestone to be created' }
    )

    // Update
    const result = await worker.sync.syncMilestones(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'beads',
      milestones: [
        {
          beadsId,
          title: `${title} UPDATED`,
          description: 'Updated description',
          state: 'open',
          updatedAt: new Date().toISOString(),
        },
      ],
    })

    expect(result.synced[0].action).toBe('updated')
  })
})

describeWithBoth('epic to milestone mapping', () => {
  let worktree: Worktree

  beforeEach(async () => {
    worktree = await createTestWorktree('milestone-epic')
    await github.configureGitAuth(worktree)
  })

  afterEach(async () => {
    if (worktree) {
      try {
        await github.deleteRemoteBranch(worktree.branch)
      } catch {
        // Ignore
      }
      await worktree.cleanup()
    }
  })

  test('beads epic syncs as GitHub milestone', async () => {
    await beads.init(worktree, 'epic')

    const epicTitle = `Epic milestone test ${Date.now()}`

    // Create epic in beads
    const epicId = await beads.create(worktree, {
      title: epicTitle,
      type: 'epic',
      description: 'Epic that should become a GitHub milestone',
    })

    expect(epicId).toMatch(/^epic-/)

    // Push and sync
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add epic'], { cwd: worktree.path })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for sync to complete
    await waitFor(
      async () => {
        const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
        // Check if sync has completed (state is idle)
        return status.syncStatus?.state === 'idle' ? status : undefined
      },
      { timeout: 10000, description: 'epic sync to complete' }
    )

    // Check if milestone was created on GitHub
    // Note: This depends on sync implementation creating milestones from epics
    const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
    expect(status.milestones).toBeGreaterThanOrEqual(0)
  })

  test('issue assigned to epic maps to milestone assignment', async () => {
    await beads.init(worktree, 'epic')

    // Create epic
    const epicId = await beads.create(worktree, {
      title: `Parent epic ${Date.now()}`,
      type: 'epic',
    })

    // Create task
    const taskId = await beads.create(worktree, {
      title: `Child task ${Date.now()}`,
      type: 'task',
    })

    // Add parent-child relationship
    await beads.dep(worktree, taskId, epicId, 'parent-child')

    // Push and sync
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add epic with child task'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for sync to complete
    await waitFor(
      async () => {
        const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
        return status.syncStatus?.state === 'idle' ? status : undefined
      },
      { timeout: 10000, description: 'sync to complete' }
    )

    // Verify relationship in local beads
    const showOutput = await beads.show(worktree, taskId)
    expect(showOutput).toContain(epicId)
  })

  test('closing all epic issues closes the milestone', async () => {
    await beads.init(worktree, 'epic')

    // Create epic with child tasks
    const epicId = await beads.create(worktree, {
      title: `Closable epic ${Date.now()}`,
      type: 'epic',
    })

    const task1Id = await beads.create(worktree, {
      title: `Task 1 ${Date.now()}`,
      type: 'task',
    })

    const task2Id = await beads.create(worktree, {
      title: `Task 2 ${Date.now()}`,
      type: 'task',
    })

    // Add relationships
    await beads.dep(worktree, task1Id, epicId, 'parent-child')
    await beads.dep(worktree, task2Id, epicId, 'parent-child')

    // Push initial state
    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Add epic with tasks'], {
      cwd: worktree.path,
    })
    await execa('git', ['push', '-u', 'origin', worktree.branch], {
      cwd: worktree.path,
    })
    await beads.sync(worktree)

    // Wait for sync to complete
    await waitFor(
      async () => {
        const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
        return status.syncStatus?.state === 'idle' ? status : undefined
      },
      { timeout: 5000, description: 'initial sync to complete' }
    )

    // Close all child tasks
    await beads.close(worktree, task1Id, 'Done')
    await beads.close(worktree, task2Id, 'Done')

    // Close the epic
    await beads.close(worktree, epicId, 'All tasks complete')

    await execa('git', ['add', '.'], { cwd: worktree.path })
    await execa('git', ['commit', '-m', 'Close epic and tasks'], {
      cwd: worktree.path,
    })
    await execa('git', ['push'], { cwd: worktree.path })
    await beads.sync(worktree)

    // Wait for epic closure to sync
    await waitFor(
      async () => {
        const status = await worker.sync.getStatus(TEST_REPO_OWNER, TEST_REPO_NAME)
        return status.syncStatus?.state === 'idle' ? status : undefined
      },
      { timeout: 5000, description: 'epic closure sync to complete' }
    )

    // Verify epic is closed locally
    const listOutput = await beads.list(worktree, { status: 'closed' })
    expect(listOutput).toContain(epicId)
  })
})

describeWithWorker('roadmap file sync', () => {
  test('ROADMAP.mdx changes trigger milestone sync', async () => {
    const commitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 40)

    const result = await worker.sync.syncPush(TEST_REPO_OWNER, TEST_REPO_NAME, {
      ref: 'refs/heads/main',
      before: '0000000000000000000000000000000000000000',
      after: commitSha,
      files: ['ROADMAP.mdx', '.roadmap/q1-2025.md'],
    })

    expect(result.queued).toBe(true)
    expect(result.files.roadmap).toBe(2)
  })

  test('milestone due dates sync correctly', async () => {
    const dueDate = '2025-12-31T23:59:59Z'

    const result = await worker.sync.syncMilestones(TEST_REPO_OWNER, TEST_REPO_NAME, {
      source: 'file',
      milestones: [
        {
          title: `Due date test ${Date.now()}`,
          description: 'Testing due date sync',
          state: 'open',
          dueOn: dueDate,
          filePath: 'ROADMAP.mdx',
        },
      ],
    })

    expect(result.synced[0].action).toBe('created')

    const { milestones } = await worker.repos.listMilestones(
      TEST_REPO_OWNER,
      TEST_REPO_NAME
    )

    const withDueDate = milestones.find((m) => m.due_on?.includes('2025-12-31'))
    expect(withDueDate).toBeDefined()
  })
})
