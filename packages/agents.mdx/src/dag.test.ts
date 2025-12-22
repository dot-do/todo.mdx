import { describe, it, expect } from 'vitest'
import { DAG } from './dag'
import type { Issue } from './types'

/**
 * Helper to create test issues
 */
function createIssue(overrides: Partial<Issue>): Issue {
  return {
    id: overrides.id || 'test-1',
    title: overrides.title || 'Test Issue',
    description: overrides.description,
    status: overrides.status || 'open',
    type: overrides.type || 'task',
    priority: overrides.priority ?? 2,
    assignee: overrides.assignee,
    labels: overrides.labels || [],
    created: overrides.created || new Date(),
    updated: overrides.updated || new Date(),
    closed: overrides.closed,
    dependsOn: overrides.dependsOn || [],
    blocks: overrides.blocks || [],
    parent: overrides.parent,
    children: overrides.children,
  }
}

describe('DAG', () => {
  describe('ready()', () => {
    it('returns issues with no dependencies', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: [] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      expect(ready).toHaveLength(2)
      expect(ready.map(i => i.id).sort()).toEqual(['a', 'b'])
    })

    it('returns issues where all dependencies are closed', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'closed', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe('b')
    })

    it('excludes issues with open dependencies', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe('a')
    })

    it('excludes closed issues', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'closed', dependsOn: [] }),
        createIssue({ id: 'b', status: 'closed', dependsOn: [] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      expect(ready).toHaveLength(0)
    })

    it('excludes in_progress issues', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'in_progress', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: [] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe('b')
    })

    it('handles complex dependency chains', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'closed', dependsOn: [] }),
        createIssue({ id: 'b', status: 'closed', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a', 'b'] }),
        createIssue({ id: 'd', status: 'open', dependsOn: ['c'] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe('c')
    })

    it('handles missing dependencies gracefully', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: ['nonexistent'] }),
      ]

      const dag = new DAG(issues)
      const ready = dag.ready()

      // Issue with missing dependency is NOT ready (dependency not found = not closed)
      expect(ready).toHaveLength(0)
    })
  })

  describe('criticalPath()', () => {
    it('returns empty array when no issues', () => {
      const dag = new DAG([])
      const path = dag.criticalPath()

      expect(path).toEqual([])
    })

    it('returns single issue when only one exists', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
      ]

      const dag = new DAG(issues)
      const path = dag.criticalPath()

      expect(path).toHaveLength(1)
      expect(path[0].id).toBe('a')
    })

    it('returns longest path in linear chain', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['b'] }),
      ]

      const dag = new DAG(issues)
      const path = dag.criticalPath()

      expect(path).toHaveLength(3)
      expect(path.map(i => i.id)).toEqual(['a', 'b', 'c'])
    })

    it('returns longest path when multiple paths exist', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'd', status: 'open', dependsOn: ['c'] }),
        createIssue({ id: 'e', status: 'open', dependsOn: ['d'] }),
      ]

      const dag = new DAG(issues)
      const path = dag.criticalPath()

      // Longest path: a -> c -> d -> e (length 4)
      expect(path).toHaveLength(4)
      expect(path.map(i => i.id)).toEqual(['a', 'c', 'd', 'e'])
    })

    it('excludes closed issues from path calculation', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'closed', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['b'] }),
      ]

      const dag = new DAG(issues)
      const path = dag.criticalPath()

      // Only count open/in_progress issues
      expect(path).toHaveLength(2)
      expect(path.map(i => i.id)).toEqual(['b', 'c'])
    })

    it('handles diamond dependencies', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'd', status: 'open', dependsOn: ['b', 'c'] }),
      ]

      const dag = new DAG(issues)
      const path = dag.criticalPath()

      // All paths are same length (3), return any one
      expect(path).toHaveLength(3)
      expect(path[0].id).toBe('a')
      expect(path[2].id).toBe('d')
    })
  })

  describe('blockedBy()', () => {
    it('returns empty array when issue has no dependencies', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
      ]

      const dag = new DAG(issues)
      const blockers = dag.blockedBy('a')

      expect(blockers).toEqual([])
    })

    it('returns open dependencies', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: [] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a', 'b'] }),
      ]

      const dag = new DAG(issues)
      const blockers = dag.blockedBy('c')

      expect(blockers).toHaveLength(2)
      expect(blockers.map(i => i.id).sort()).toEqual(['a', 'b'])
    })

    it('excludes closed dependencies', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'closed', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: [] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a', 'b'] }),
      ]

      const dag = new DAG(issues)
      const blockers = dag.blockedBy('c')

      expect(blockers).toHaveLength(1)
      expect(blockers[0].id).toBe('b')
    })

    it('throws error for nonexistent issue', () => {
      const dag = new DAG([])

      expect(() => dag.blockedBy('nonexistent')).toThrow('Issue not found: nonexistent')
    })

    it('returns transitive blockers', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['b'] }),
      ]

      const dag = new DAG(issues)
      const blockers = dag.blockedBy('c')

      // Direct blocker is 'b', but 'b' is blocked by 'a'
      // So 'c' is transitively blocked by both 'a' and 'b'
      expect(blockers).toHaveLength(2)
      expect(blockers.map(i => i.id).sort()).toEqual(['a', 'b'])
    })
  })

  describe('unblocks()', () => {
    it('returns empty array when issue blocks nothing', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
      ]

      const dag = new DAG(issues)
      const unblocked = dag.unblocks('a')

      expect(unblocked).toEqual([])
    })

    it('returns direct dependents', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a'] }),
      ]

      const dag = new DAG(issues)
      const unblocked = dag.unblocks('a')

      expect(unblocked).toHaveLength(2)
      expect(unblocked.map(i => i.id).sort()).toEqual(['b', 'c'])
    })

    it('throws error for nonexistent issue', () => {
      const dag = new DAG([])

      expect(() => dag.unblocks('nonexistent')).toThrow('Issue not found: nonexistent')
    })

    it('returns transitive dependents', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['b'] }),
      ]

      const dag = new DAG(issues)
      const unblocked = dag.unblocks('a')

      // 'a' directly unblocks 'b', and transitively unblocks 'c'
      expect(unblocked).toHaveLength(2)
      expect(unblocked.map(i => i.id).sort()).toEqual(['b', 'c'])
    })

    it('handles complex dependency graph', () => {
      const issues: Issue[] = [
        createIssue({ id: 'a', status: 'open', dependsOn: [] }),
        createIssue({ id: 'b', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'c', status: 'open', dependsOn: ['a'] }),
        createIssue({ id: 'd', status: 'open', dependsOn: ['b', 'c'] }),
      ]

      const dag = new DAG(issues)
      const unblocked = dag.unblocks('a')

      // 'a' unblocks 'b' and 'c' directly, and 'd' transitively
      expect(unblocked).toHaveLength(3)
      expect(unblocked.map(i => i.id).sort()).toEqual(['b', 'c', 'd'])
    })
  })
})
