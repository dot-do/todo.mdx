/**
 * DAG (Directed Acyclic Graph) Analysis for Issue Dependencies
 *
 * Provides dependency graph analysis for the Planner Agent (Priya):
 * - Find ready issues (no open blockers)
 * - Identify critical path (longest chain to completion)
 * - Determine what blocks/unblocks an issue
 */

import type { Issue } from './types'

/**
 * DAG analyzer for issue dependencies
 */
export class DAG {
  private issues: Map<string, Issue>

  constructor(issues: Issue[]) {
    this.issues = new Map(issues.map(i => [i.id, i]))
  }

  /**
   * Get all ready issues (status=open AND all dependencies closed)
   */
  ready(): Issue[] {
    const result: Issue[] = []

    for (const issue of this.issues.values()) {
      // Must be open (not closed or in_progress)
      if (issue.status !== 'open') {
        continue
      }

      // Check if all dependencies are closed
      const allDependenciesClosed = issue.dependsOn.every(depId => {
        const dep = this.issues.get(depId)
        // If dependency doesn't exist, treat as not closed (blocker)
        if (!dep) return false
        return dep.status === 'closed'
      })

      if (allDependenciesClosed) {
        result.push(issue)
      }
    }

    return result
  }

  /**
   * Find the critical path - longest chain of open/in_progress issues to completion
   *
   * Returns the path from root to leaf that has the most remaining work.
   * Excludes closed issues from the calculation.
   */
  criticalPath(): Issue[] {
    // Get all open/in_progress issues
    const openIssues = Array.from(this.issues.values()).filter(
      i => i.status === 'open' || i.status === 'in_progress'
    )

    if (openIssues.length === 0) {
      return []
    }

    // Find longest path for each issue using DFS with memoization
    const memo = new Map<string, Issue[]>()

    const findLongestPath = (issueId: string, visited: Set<string>): Issue[] => {
      // Check memo
      if (memo.has(issueId)) {
        return memo.get(issueId)!
      }

      const issue = this.issues.get(issueId)
      if (!issue) return []

      // Skip closed issues
      if (issue.status === 'closed') {
        return []
      }

      // Detect cycles
      if (visited.has(issueId)) {
        return [issue]
      }

      const newVisited = new Set(visited)
      newVisited.add(issueId)

      // Find longest path through any dependency
      let longestPath: Issue[] = [issue]

      for (const depId of issue.dependsOn) {
        const depPath = findLongestPath(depId, newVisited)
        if (depPath.length + 1 > longestPath.length) {
          longestPath = [...depPath, issue]
        }
      }

      memo.set(issueId, longestPath)
      return longestPath
    }

    // Find the overall longest path
    let criticalPath: Issue[] = []

    for (const issue of openIssues) {
      const path = findLongestPath(issue.id, new Set())
      if (path.length > criticalPath.length) {
        criticalPath = path
      }
    }

    return criticalPath
  }

  /**
   * Get all open issues blocking this issue (transitive)
   *
   * Returns direct and transitive dependencies that are still open.
   * Throws if issue not found.
   */
  blockedBy(issueId: string): Issue[] {
    const issue = this.issues.get(issueId)
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`)
    }

    const blockers: Issue[] = []
    const visited = new Set<string>()

    const collectBlockers = (id: string) => {
      const current = this.issues.get(id)
      if (!current) return

      for (const depId of current.dependsOn) {
        if (visited.has(depId)) continue
        visited.add(depId)

        const dep = this.issues.get(depId)
        if (!dep) continue

        // Only include open/in_progress blockers
        if (dep.status !== 'closed') {
          blockers.push(dep)
        }

        // Recurse to get transitive blockers
        collectBlockers(depId)
      }
    }

    collectBlockers(issueId)
    return blockers
  }

  /**
   * Get all issues that this issue unblocks (transitive)
   *
   * Returns direct and transitive dependents.
   * Throws if issue not found.
   */
  unblocks(issueId: string): Issue[] {
    const issue = this.issues.get(issueId)
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`)
    }

    const unblocked: Issue[] = []
    const visited = new Set<string>()

    const collectUnblocked = (id: string) => {
      const current = this.issues.get(id)
      if (!current) return

      // Find all issues that depend on current
      for (const candidate of this.issues.values()) {
        if (visited.has(candidate.id)) continue
        if (candidate.dependsOn.includes(id)) {
          visited.add(candidate.id)
          unblocked.push(candidate)
          // Recurse to get transitive dependents
          collectUnblocked(candidate.id)
        }
      }
    }

    collectUnblocked(issueId)
    return unblocked
  }
}
