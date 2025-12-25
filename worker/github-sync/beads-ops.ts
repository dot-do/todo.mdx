/**
 * Beads Operations Adapter
 *
 * Provides persistent issue operations by wrapping beads-workflows IssuesApi.
 * This adapter converts between BeadsIssue format (used by github-sync) and
 * the beads-workflows Issue format.
 */

import type { BeadsIssue } from './beads-to-github'
import type { IssuesApi, Issue, CreateOptions, UpdateOptions } from 'beads-workflows'

/**
 * Interface for beads operations used by sync orchestrator
 */
export interface BeadsOps {
  getIssue(id: string): Promise<BeadsIssue | null>
  createIssue(issue: BeadsIssue): Promise<BeadsIssue>
  updateIssue(id: string, issue: Partial<BeadsIssue>): Promise<BeadsIssue>
  listIssues(): Promise<BeadsIssue[]>
}

/**
 * Options for creating BeadsOps adapter
 */
export interface BeadsOpsOptions {
  issuesApi: IssuesApi
}

/**
 * Convert beads-workflows Issue to BeadsIssue format
 */
function issueToBeadsIssue(issue: Issue): BeadsIssue {
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description || '',
    // Handle 'blocked' status by mapping it for compatibility
    status: issue.status === 'blocked' ? 'blocked' : issue.status as BeadsIssue['status'],
    // Handle 'epic' type - map it directly
    type: issue.type as BeadsIssue['type'],
    priority: issue.priority as BeadsIssue['priority'],
    assignee: issue.assignee,
    labels: issue.labels || [],
    dependsOn: issue.dependsOn || [],
    blocks: issue.blocks || [],
    parent: issue.parent,
    externalRef: '', // beads-workflows doesn't have externalRef, initialize empty
    createdAt: issue.created.toISOString(),
    updatedAt: issue.updated.toISOString(),
    closedAt: issue.closed?.toISOString(),
  }
}

/**
 * Convert BeadsIssue to beads-workflows CreateOptions
 */
function beadsIssueToCreateOptions(issue: BeadsIssue): CreateOptions {
  return {
    title: issue.title,
    // Map 'chore' type to 'task' since beads-workflows doesn't support chore
    type: issue.type === 'chore' ? 'task' : issue.type as CreateOptions['type'],
    priority: issue.priority,
    description: issue.description,
    assignee: issue.assignee,
    labels: issue.labels,
  }
}

/**
 * Convert partial BeadsIssue to beads-workflows UpdateOptions
 */
function beadsIssueToUpdateOptions(issue: Partial<BeadsIssue>): UpdateOptions {
  const options: UpdateOptions = {}

  if (issue.title !== undefined) {
    options.title = issue.title
  }
  if (issue.status !== undefined) {
    // Map 'blocked' status to something beads-workflows supports
    options.status = issue.status === 'blocked' ? 'open' : issue.status as UpdateOptions['status']
  }
  if (issue.priority !== undefined) {
    options.priority = issue.priority
  }
  if (issue.description !== undefined) {
    options.description = issue.description
  }
  if (issue.assignee !== undefined) {
    options.assignee = issue.assignee
  }
  if (issue.labels !== undefined) {
    options.labels = issue.labels
  }

  return options
}

/**
 * Create BeadsOps adapter from beads-workflows IssuesApi
 */
export function createBeadsOps(options: BeadsOpsOptions): BeadsOps {
  const { issuesApi } = options

  async function getIssue(id: string): Promise<BeadsIssue | null> {
    const issue = await issuesApi.get(id)
    if (!issue) {
      return null
    }
    return issueToBeadsIssue(issue)
  }

  async function createIssue(beadsIssue: BeadsIssue): Promise<BeadsIssue> {
    const createOptions = beadsIssueToCreateOptions(beadsIssue)
    const created = await issuesApi.create(createOptions)

    if (!created) {
      // If API returns null, return the input issue with a generated ID
      return {
        ...beadsIssue,
        id: beadsIssue.id || `gen-${Date.now()}`,
      }
    }

    return issueToBeadsIssue(created)
  }

  async function updateIssue(
    id: string,
    updates: Partial<BeadsIssue>
  ): Promise<BeadsIssue> {
    const updateOptions = beadsIssueToUpdateOptions(updates)
    const updated = await issuesApi.update(id, updateOptions)

    if (!updated) {
      // If API returns null, return the updates with the id
      return {
        id,
        title: updates.title || '',
        description: updates.description || '',
        status: updates.status || 'open',
        type: updates.type || 'task',
        priority: updates.priority || 2,
        labels: updates.labels || [],
        dependsOn: updates.dependsOn || [],
        blocks: updates.blocks || [],
        externalRef: updates.externalRef || '',
        createdAt: updates.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    return issueToBeadsIssue(updated)
  }

  async function listIssues(): Promise<BeadsIssue[]> {
    const issues = await issuesApi.list()
    return issues.map(issueToBeadsIssue)
  }

  return {
    getIssue,
    createIssue,
    updateIssue,
    listIssues,
  }
}
