import { describe, it, expect } from 'vitest'
import { parseRequiredCapabilities, type Capability } from './capabilities'
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

describe('parseRequiredCapabilities', () => {
  describe('label-based capability extraction', () => {
    it('should extract "code" capability from bug label', () => {
      const issue = createIssue({
        labels: ['bug'],
        description: 'Something is broken',
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })

    it('should extract "code" capability from feature label', () => {
      const issue = createIssue({
        labels: ['feature'],
        description: 'Add new functionality',
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })

    it('should extract "docs" capability from docs label', () => {
      const issue = createIssue({
        labels: ['docs'],
        description: 'Update documentation',
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('docs')
    })

    it('should extract "security" capability from security label', () => {
      const issue = createIssue({
        labels: ['security'],
        description: 'Security vulnerability',
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('security')
    })

    it('should handle multiple labels', () => {
      const issue = createIssue({
        labels: ['bug', 'security'],
        description: 'Security bug',
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
      expect(capabilities).toContain('security')
    })
  })

  describe('issue type-based capability extraction', () => {
    it('should extract "code" capability from bug type', () => {
      const issue = createIssue({
        type: 'bug',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })

    it('should extract "code" capability from feature type', () => {
      const issue = createIssue({
        type: 'feature',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })
  })

  describe('description-based capability extraction', () => {
    it('should extract "test" capability from "write tests" in description', () => {
      const issue = createIssue({
        description: 'Need to write tests for the new feature',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('test')
    })

    it('should extract "test" capability from "add test" in description', () => {
      const issue = createIssue({
        description: 'Add test coverage for edge cases',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('test')
    })

    it('should extract "review" capability from "code review" in description', () => {
      const issue = createIssue({
        description: 'Perform code review on PR #123',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('review')
    })

    it('should extract "review" capability from "review code" in description', () => {
      const issue = createIssue({
        description: 'Review code changes before merge',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('review')
    })

    it('should extract "docs" capability from "document" in description', () => {
      const issue = createIssue({
        description: 'Document the new API endpoints',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('docs')
    })

    it('should extract "code" capability from "fix" in description', () => {
      const issue = createIssue({
        description: 'Fix the authentication bug',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })

    it('should extract "code" capability from "implement" in description', () => {
      const issue = createIssue({
        description: 'Implement the new dashboard',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })

    it('should be case-insensitive', () => {
      const issue = createIssue({
        description: 'WRITE TESTS for the API',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('test')
    })
  })

  describe('title-based capability extraction', () => {
    it('should extract capabilities from title as well as description', () => {
      const issue = createIssue({
        title: 'Write tests for authentication',
        description: 'Implement test coverage',
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('test')
    })
  })

  describe('deduplication', () => {
    it('should return unique capabilities', () => {
      const issue = createIssue({
        title: 'Fix bug in authentication',
        description: 'Fix the authentication bug',
        labels: ['bug', 'feature'],
        type: 'bug',
      })

      const capabilities = parseRequiredCapabilities(issue)

      // Should have 'code' only once, not multiple times
      const codeCount = capabilities.filter(c => c === 'code').length
      expect(codeCount).toBe(1)
    })
  })

  describe('empty/minimal input', () => {
    it('should return empty array for issue with no signals', () => {
      const issue = createIssue({
        title: 'Task',
        description: '',
        labels: [],
        type: 'task',
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toEqual([])
    })

    it('should handle missing description', () => {
      const issue = createIssue({
        title: 'Fix bug',
        description: undefined,
        labels: [],
      })

      const capabilities = parseRequiredCapabilities(issue)

      expect(capabilities).toContain('code')
    })
  })
})
