/**
 * Payload helper utilities for main worker
 *
 * This module provides convenient wrappers around the Payload RPC service binding.
 */

import type { Env, Issue, Milestone } from './types'

/**
 * Get all open issues for a repository
 */
export async function getOpenIssues(
  env: Env,
  repoId: string,
  limit: number = 100
) {
  return env.PAYLOAD.find({
    collection: 'issues',
    where: {
      and: [
        { repo: { equals: repoId } },
        { state: { equals: 'open' } },
      ],
    },
    limit,
    sort: '-priority,-createdAt',
  })
}

/**
 * Get issues ready to work (no blockers, status=open)
 */
export async function getReadyIssues(
  env: Env,
  repoId: string,
  limit: number = 10
) {
  return env.PAYLOAD.find({
    collection: 'issues',
    where: {
      and: [
        { repo: { equals: repoId } },
        { state: { equals: 'open' } },
        { status: { equals: 'open' } },
        // Note: Need to check dependsOn separately as relationship queries are complex
      ],
    },
    limit,
    sort: '-priority',
    depth: 1,
  })
}

/**
 * Get all milestones for a repository
 */
export async function getMilestones(
  env: Env,
  repoId: string,
  state?: 'open' | 'closed'
) {
  const where: any = { repo: { equals: repoId } }
  if (state) {
    where.state = { equals: state }
  }

  return env.PAYLOAD.find({
    collection: 'milestones',
    where,
    sort: '-createdAt',
  })
}

/**
 * Create a new issue
 */
export async function createIssue(
  env: Env,
  data: {
    localId: string
    title: string
    body?: string
    repoId: string
    priority?: number
    labels?: string[]
    assignees?: string[]
    milestoneId?: string
    dependsOn?: string[]
  }
) {
  return env.PAYLOAD.create({
    collection: 'issues',
    data: {
      localId: data.localId,
      title: data.title,
      body: data.body || '',
      state: 'open',
      status: 'open',
      priority: data.priority ?? 2,
      labels: data.labels,
      assignees: data.assignees,
      repo: data.repoId,
      milestone: data.milestoneId,
      dependsOn: data.dependsOn,
    },
  })
}

/**
 * Update an issue
 */
export async function updateIssue(
  env: Env,
  id: string,
  data: Partial<{
    title: string
    body: string
    state: 'open' | 'closed'
    status: 'open' | 'in_progress' | 'closed'
    priority: number
    labels: string[]
    assignees: string[]
    milestoneId: string
    dependsOn: string[]
    closedAt: string
    closeReason: string
  }>
) {
  const updateData: any = {}

  if (data.title !== undefined) updateData.title = data.title
  if (data.body !== undefined) updateData.body = data.body
  if (data.state !== undefined) updateData.state = data.state
  if (data.status !== undefined) updateData.status = data.status
  if (data.priority !== undefined) updateData.priority = data.priority
  if (data.labels !== undefined) updateData.labels = data.labels
  if (data.assignees !== undefined) updateData.assignees = data.assignees
  if (data.milestoneId !== undefined) updateData.milestone = data.milestoneId
  if (data.dependsOn !== undefined) updateData.dependsOn = data.dependsOn
  if (data.closedAt !== undefined) updateData.closedAt = data.closedAt
  if (data.closeReason !== undefined) updateData.closeReason = data.closeReason

  return env.PAYLOAD.update({
    collection: 'issues',
    id,
    data: updateData,
  })
}

/**
 * Close an issue
 */
export async function closeIssue(
  env: Env,
  id: string,
  reason?: string
) {
  return updateIssue(env, id, {
    state: 'closed',
    status: 'closed',
    closedAt: new Date().toISOString(),
    closeReason: reason,
  })
}

/**
 * Sync issue from GitHub
 */
export async function syncIssueFromGitHub(
  env: Env,
  repoId: string,
  githubIssue: {
    id: number
    number: number
    title: string
    body?: string
    state: 'open' | 'closed'
    labels?: Array<{ name: string }>
    assignees?: Array<{ login: string }>
    milestone?: { id: number }
    html_url: string
  }
) {
  // Find existing issue by GitHub ID
  const existing = await env.PAYLOAD.find({
    collection: 'issues',
    where: { githubId: { equals: githubIssue.id } },
    limit: 1,
  })

  const data = {
    title: githubIssue.title,
    body: githubIssue.body || '',
    state: githubIssue.state,
    githubId: githubIssue.id,
    githubNumber: githubIssue.number,
    githubUrl: githubIssue.html_url,
    labels: githubIssue.labels?.map(l => l.name),
    assignees: githubIssue.assignees?.map(a => a.login),
    repo: repoId,
  }

  if (existing.docs && existing.docs.length > 0) {
    // Update existing
    return env.PAYLOAD.update({
      collection: 'issues',
      id: existing.docs[0].id,
      data,
    })
  } else {
    // Create new - need to generate localId
    return env.PAYLOAD.create({
      collection: 'issues',
      data: {
        ...data,
        localId: `todo-${Math.random().toString(36).substring(2, 7)}`,
        priority: 2,
      },
    })
  }
}

/**
 * Get repository by GitHub installation and repo name
 */
export async function getRepoByGitHub(
  env: Env,
  installationId: number,
  owner: string,
  name: string
) {
  const result = await env.PAYLOAD.find({
    collection: 'repos',
    where: {
      and: [
        { 'installation.githubId': { equals: installationId } },
        { owner: { equals: owner } },
        { name: { equals: name } },
      ],
    },
    limit: 1,
  })

  return result.docs?.[0] || null
}

/**
 * Create or update a repository
 */
export async function upsertRepo(
  env: Env,
  installationId: string,
  data: {
    githubId: number
    owner: string
    name: string
    fullName: string
    defaultBranch?: string
    private?: boolean
  }
) {
  const existing = await env.PAYLOAD.find({
    collection: 'repos',
    where: { githubId: { equals: data.githubId } },
    limit: 1,
  })

  const repoData = {
    githubId: data.githubId,
    owner: data.owner,
    name: data.name,
    fullName: data.fullName,
    defaultBranch: data.defaultBranch || 'main',
    private: data.private || false,
    installation: installationId,
  }

  if (existing.docs && existing.docs.length > 0) {
    return env.PAYLOAD.update({
      collection: 'repos',
      id: existing.docs[0].id,
      data: repoData,
    })
  } else {
    return env.PAYLOAD.create({
      collection: 'repos',
      data: repoData,
    })
  }
}
