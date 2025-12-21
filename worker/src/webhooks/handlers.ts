/**
 * GitHub webhook handler types
 */

import type { Context } from 'hono'
import type { Env } from '../types'
import { createDirectDb } from '../db/direct'
import type {
  InstallationEvent,
  IssuesEvent,
  MilestoneEvent,
  PushEvent,
  ProjectsV2Event,
  ProjectsV2ItemEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
} from '../types/github'

export type HonoContext = Context<{ Bindings: Env }>

// Installation webhook handler
export async function handleInstallation(
  c: HonoContext,
  payload: InstallationEvent
): Promise<Response> {
  const t0 = Date.now()
  const timing: Record<string, number> = {}

  console.log(`[Installation] action=${payload.action} account=${payload.installation?.account?.login}`)

  if (payload.action === 'created') {
    try {
      const installation = payload.installation
      timing.setup = Date.now() - t0

      const installData = {
        installationId: installation.id,
        accountType: installation.account.type,
        accountId: installation.account.id,
        accountLogin: installation.account.login,
        accountAvatarUrl: installation.account.avatar_url,
        permissions: installation.permissions,
        events: installation.events,
        repositorySelection: installation.repository_selection,
      }

      // Try to find existing installation first
      const t1 = Date.now()
      const db = createDirectDb(c.env)
      const existing = await db.installations.findByInstallationId(installation.id)
      timing.findExisting = Date.now() - t1

      let installResult: { id: number }
      const t2 = Date.now()
      if (existing) {
        // Installation already exists, just use it
        installResult = existing
        timing.installSkip = Date.now() - t2
        console.log(`[Installation] Using existing installation id=${installResult.id} (${timing.installSkip}ms)`)
      } else {
        // Create new installation
        installResult = await db.installations.create(installData)
        timing.installCreate = Date.now() - t2
        console.log(`[Installation] Created new installation id=${installResult.id} (${timing.installCreate}ms)`)
      }

      // Upsert repos via direct D1
      const repos = payload.repositories || []
      if (repos.length > 0) {
        const t3 = Date.now()
        let created = 0, updated = 0
        for (const repo of repos) {
          const existingRepo = await db.repos.findByGithubId(repo.id)
          const repoData = {
            githubId: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.full_name.split('/')[0],
            private: repo.private,
            installationId: installResult.id,
          }
          if (existingRepo) {
            // Repo already exists, skip
            updated++
          } else {
            await db.repos.create(repoData)
            created++
          }
        }
        timing.reposSync = Date.now() - t3
        console.log(`[Installation] Synced ${repos.length} repos (${created} created, ${updated} skipped existing) (${timing.reposSync}ms)`)
      }

      timing.total = Date.now() - t0
      console.log(`[Installation] Complete: ${JSON.stringify(timing)}`)
      return c.json({ status: 'installed', installationId: installResult.id, repos: repos.length, timing })
    } catch (error) {
      const err = error as Error
      timing.total = Date.now() - t0
      console.error(`[Installation] Error after ${timing.total}ms:`, err.message, err.stack)
      return c.json({ error: 'Failed to process installation', message: err.message, timing }, 500)
    }
  }

  if (payload.action === 'deleted') {
    try {
      // Delete installation via direct D1
      const db = createDirectDb(c.env)
      await db.installations.delete(payload.installation.id)

      return c.json({ status: 'uninstalled' })
    } catch (error) {
      const err = error as Error
      console.error(`[Installation] Delete error:`, err.message)
      return c.json({ error: 'Failed to delete installation', message: err.message }, 500)
    }
  }

  return c.json({ status: 'ok' })
}

// Issues webhook handler
export async function handleIssues(
  c: HonoContext,
  payload: IssuesEvent
): Promise<Response> {
  const repo = payload.repository
  const issue = payload.issue
  const action = payload.action
  const installationId = payload.installation?.id

  // Handle delete - remove from Vectorize
  if (action === 'deleted') {
    try {
      await c.env.VECTORIZE.deleteByIds([
        `issue:${repo.full_name}:${issue.number}`
      ])
    } catch (e) {
      console.error('Failed to delete vector:', e)
    }
    return c.json({ status: 'deleted', action })
  }

  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  // First, ensure repo context is set (needed for bidirectional sync)
  if (installationId) {
    await stub.fetch(new Request('http://do/context', {
      method: 'POST',
      body: JSON.stringify({
        repoFullName: repo.full_name,
        installationId,
      }),
      headers: { 'Content-Type': 'application/json' },
    }))
  }

  // Call the webhook/github endpoint with the correct payload format
  const response = await stub.fetch(new Request('http://do/webhook/github', {
    method: 'POST',
    body: JSON.stringify({
      action,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels || [],
        assignee: issue.assignee,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()

  // Trigger embedding workflow for create/update events
  if (['opened', 'edited', 'closed', 'reopened'].includes(action)) {
    try {
      await c.env.EMBED_WORKFLOW.create({
        id: `embed-issue-${repo.full_name}-${issue.number}-${Date.now()}`,
        params: {
          type: 'issue' as const,
          id: `issue:${repo.full_name}:${issue.number}`,
          repo: repo.full_name,
          title: issue.title,
          body: issue.body || '',
          status: issue.state,
          url: issue.html_url,
          labels: issue.labels?.map((l) => l.name),
        },
      })
      console.log(`Dispatched embedding workflow for issue ${issue.number}`)
    } catch (e) {
      console.error('Failed to dispatch embedding workflow:', e)
    }
  }

  return c.json({ status: 'synced', action, result })
}

// Milestone webhook handler
export async function handleMilestone(
  c: HonoContext,
  payload: MilestoneEvent
): Promise<Response> {
  const repo = payload.repository
  const milestone = payload.milestone
  const action = payload.action

  // Handle delete - remove from Vectorize
  if (action === 'deleted') {
    try {
      await c.env.VECTORIZE.deleteByIds([
        `milestone:${repo.full_name}:${milestone.number}`
      ])
    } catch (e) {
      console.error('Failed to delete milestone vector:', e)
    }
    return c.json({ status: 'deleted', action })
  }

  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  const response = await stub.fetch(new Request('http://do/milestones/sync', {
    method: 'POST',
    body: JSON.stringify({
      source: 'github',
      milestones: [{
        githubId: milestone.id,
        githubNumber: milestone.number,
        title: milestone.title,
        description: milestone.description,
        state: milestone.state,
        dueOn: milestone.due_on,
        updatedAt: milestone.updated_at,
      }],
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()

  // Trigger embedding workflow for create/update events
  if (['created', 'edited', 'closed', 'opened'].includes(action)) {
    try {
      await c.env.EMBED_WORKFLOW.create({
        id: `embed-milestone-${repo.full_name}-${milestone.number}-${Date.now()}`,
        params: {
          type: 'milestone' as const,
          id: `milestone:${repo.full_name}:${milestone.number}`,
          repo: repo.full_name,
          title: milestone.title,
          body: milestone.description || '',
          status: milestone.state,
          url: milestone.html_url,
        },
      })
      console.log(`Dispatched embedding workflow for milestone ${milestone.number}`)
    } catch (e) {
      console.error('Failed to dispatch embedding workflow:', e)
    }
  }

  return c.json({ status: 'synced', action, result })
}

// Push webhook handler
export async function handlePush(
  c: HonoContext,
  payload: PushEvent
): Promise<Response> {
  const repo = payload.repository
  const installationId = payload.installation?.id

  if (!installationId) {
    return c.json({ status: 'ignored', reason: 'no installation id' })
  }

  const changedFiles: string[] = []
  let hasBeadsChanges = false

  for (const commit of payload.commits || []) {
    const allFiles = [
      ...(commit.added || []),
      ...(commit.modified || []),
      ...(commit.removed || []),
    ]
    for (const file of allFiles) {
      // Track beads changes
      if (file.startsWith('.beads/')) {
        changedFiles.push(file)
        hasBeadsChanges = true
      }
      // Track todo/roadmap changes
      if (file.startsWith('.todo/') || file === 'TODO.md' || file === 'TODO.mdx') {
        changedFiles.push(file)
      }
      if (file.startsWith('.roadmap/') || file === 'ROADMAP.md' || file === 'ROADMAP.mdx') {
        changedFiles.push(file)
      }
    }
  }

  if (changedFiles.length === 0) {
    return c.json({ status: 'ignored', reason: 'no tracked files changed' })
  }

  const doId = c.env.REPO.idFromName(repo.full_name)
  const stub = c.env.REPO.get(doId)

  // If beads files changed, trigger sync to GitHub
  if (hasBeadsChanges) {
    const headCommit = payload.head_commit?.id || payload.after
    await stub.fetch(
      new Request('http://do/webhook/beads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit: headCommit,
          files: changedFiles.filter((f) => f.startsWith('.beads/')),
          repoFullName: repo.full_name,
          installationId,
        }),
      })
    )
  }

  return c.json({ status: 'synced', files: changedFiles })
}

// GitHub Projects v2 webhook handler
export async function handleProject(
  c: HonoContext,
  payload: ProjectsV2Event
): Promise<Response> {
  const project = payload.projects_v2

  if (!project?.node_id) {
    return c.json({ status: 'ignored', reason: 'no project node_id' })
  }

  const doId = c.env.PROJECT.idFromName(project.node_id)
  const stub = c.env.PROJECT.get(doId)

  const response = await stub.fetch(new Request('http://do/project/sync', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      project: {
        nodeId: project.node_id,
        number: project.number,
        title: project.title,
        shortDescription: project.short_description,
        public: project.public,
        closed: project.closed,
        owner: payload.organization?.login || payload.sender?.login,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()
  return c.json({ status: 'synced', action: payload.action, result })
}

// GitHub Projects v2 item webhook handler
export async function handleProjectItem(
  c: HonoContext,
  payload: ProjectsV2ItemEvent
): Promise<Response> {
  const projectNodeId = payload.projects_v2_item?.project_node_id

  if (!projectNodeId) {
    return c.json({ status: 'ignored', reason: 'no project id' })
  }

  const doId = c.env.PROJECT.idFromName(projectNodeId)
  const stub = c.env.PROJECT.get(doId)

  // Extract field values from the payload if present
  const fieldValues: Record<string, unknown> = {}

  if (payload.changes?.field_value) {
    const change = payload.changes.field_value
    if (change.field_type && change.field_name) {
      fieldValues[change.field_name] = {
        type: change.field_type,
        from: change.from,
        to: change.to,
      }
    }
  }

  const response = await stub.fetch(new Request('http://do/items/sync', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      item: {
        nodeId: payload.projects_v2_item.node_id,
        id: payload.projects_v2_item.id,
        contentNodeId: payload.projects_v2_item.content_node_id,
        contentType: payload.projects_v2_item.content_type,
        creator: payload.projects_v2_item.creator?.login,
        createdAt: payload.projects_v2_item.created_at,
        updatedAt: payload.projects_v2_item.updated_at,
        archivedAt: payload.projects_v2_item.archived_at,
        isArchived: payload.projects_v2_item.is_archived,
      },
      fieldValues,
      changes: payload.changes,
    }),
    headers: { 'Content-Type': 'application/json' },
  }))

  const result = await response.json()
  return c.json({ status: 'synced', result })
}

// Pull Request webhook handler
export async function handlePullRequest(
  c: HonoContext,
  payload: PullRequestEvent
): Promise<Response> {
  const repo = payload.repository
  const pr = payload.pull_request
  const action = payload.action
  const installationId = payload.installation?.id

  if (!installationId) {
    return c.json({ status: 'ignored', reason: 'no installation id' })
  }

  // Get PRDO instance using naming convention: {owner}/{repo}#{pr_number}
  const doId = c.env.PRDO.idFromName(`${repo.full_name}#${pr.number}`)
  const stub = c.env.PRDO.get(doId)

  // Map webhook action to PRDO event
  switch (action) {
    case 'opened':
    case 'reopened':
      // Send PR_OPENED event
      return stub.fetch(new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PR_OPENED',
          prNumber: pr.number,
          repoFullName: repo.full_name,
          author: pr.user?.login,
          base: pr.base.ref,
          head: pr.head.sha,
          installationId,
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

    case 'synchronize':
      // Send FIX_COMPLETE event (new commits pushed)
      // Note: PullRequestSynchronizeEvent doesn't have commits field
      return stub.fetch(new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'FIX_COMPLETE',
          commits: [],
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

    case 'closed':
      // Send CLOSE event with merged flag
      return stub.fetch(new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'CLOSE',
          merged: pr.merged || false,
        }),
        headers: { 'Content-Type': 'application/json' },
      }))

    default:
      return c.json({ status: 'ignored', action })
  }
}

// Pull Request Review webhook handler
export async function handlePullRequestReview(
  c: HonoContext,
  payload: PullRequestReviewEvent
): Promise<Response> {
  const repo = payload.repository
  const pr = payload.pull_request
  const review = payload.review
  const action = payload.action

  // Only handle submitted reviews
  if (action !== 'submitted') {
    return c.json({ status: 'ignored', reason: 'action not submitted' })
  }

  // Only handle approved or changes_requested states
  const reviewState = review.state.toLowerCase()
  if (reviewState !== 'approved' && reviewState !== 'changes_requested') {
    return c.json({ status: 'ignored', reason: `review state: ${reviewState}` })
  }

  // Get PRDO instance using naming convention: {owner}/{repo}#{pr_number}
  const doId = c.env.PRDO.idFromName(`${repo.full_name}#${pr.number}`)
  const stub = c.env.PRDO.get(doId)

  // Send REVIEW_COMPLETE event
  return stub.fetch(new Request('http://do/event', {
    method: 'POST',
    body: JSON.stringify({
      type: 'REVIEW_COMPLETE',
      reviewer: review.user?.login,
      decision: reviewState,
      body: review.body || '',
    }),
    headers: { 'Content-Type': 'application/json' },
  }))
}
