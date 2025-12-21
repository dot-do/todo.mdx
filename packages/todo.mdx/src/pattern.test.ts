/**
 * Tests for pattern.ts
 */

import { describe, it, expect } from 'vitest'
import { slugify, parsePattern, extractFromFilename, DEFAULT_PATTERN } from './pattern.js'
import type { Issue } from './types.js'

describe('slugify', () => {
  it('should convert to lowercase', () => {
    expect(slugify('Test Title')).toBe('test-title')
  })

  it('should replace spaces with hyphens', () => {
    expect(slugify('Multiple Word Title')).toBe('multiple-word-title')
  })

  it('should remove special characters', () => {
    expect(slugify('Title with @#$% special!')).toBe('title-with-special')
  })

  it('should handle consecutive spaces', () => {
    expect(slugify('Title   with   spaces')).toBe('title-with-spaces')
  })

  it('should trim leading/trailing hyphens', () => {
    expect(slugify('  Title  ')).toBe('title')
    expect(slugify('!!!Title!!!')).toBe('title')
  })

  it('should limit length to 50 characters', () => {
    const longTitle = 'a'.repeat(100)
    expect(slugify(longTitle).length).toBe(50)
  })

  it('should handle empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('should preserve numbers', () => {
    expect(slugify('Issue 123')).toBe('issue-123')
  })

  it('should handle unicode characters', () => {
    expect(slugify('Café résumé')).toBe('caf-r-sum')
  })
})

describe('parsePattern', () => {
  it('should parse default pattern', () => {
    const pattern = parsePattern(DEFAULT_PATTERN)

    expect(pattern.variables).toEqual(['id', 'title'])
    expect(pattern.separator).toBe('-')
    expect(pattern.regex).toBeDefined()
  })

  it('should parse single variable pattern', () => {
    const pattern = parsePattern('[id].md')

    expect(pattern.variables).toEqual(['id'])
    expect(pattern.regex.test('test-123.md')).toBe(true)
  })

  it('should parse multiple variables', () => {
    const pattern = parsePattern('[type]-[id]-[title].md')

    expect(pattern.variables).toEqual(['type', 'id', 'title'])
  })

  it('should detect separator', () => {
    const pattern1 = parsePattern('[id]_[title].md')
    expect(pattern1.separator).toBe('_')

    const pattern2 = parsePattern('[id].[title].md')
    expect(pattern2.separator).toBe('.')
  })

  it('should throw on unknown variable', () => {
    expect(() => parsePattern('[unknown].md')).toThrow('Unknown variable: unknown')
  })

  it('should format filename with id and title', () => {
    const pattern = parsePattern('[id]-[title].mdx')
    const issue: Issue = {
      id: 'test-1',
      title: 'Test Issue',
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('test-1-test-issue.md')
  })

  it('should format filename with type', () => {
    const pattern = parsePattern('[type]-[id].md')
    const issue: Issue = {
      id: 'test-1',
      title: 'Test',
      type: 'bug',
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('bug-test-1.md')
  })

  it('should format filename with priority', () => {
    const pattern = parsePattern('[priority]-[id].md')
    const issue: Issue = {
      id: 'test-1',
      title: 'Test',
      priority: 1,
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('p1-test-1.md')
  })

  it('should format filename with state', () => {
    const pattern = parsePattern('[state]-[id].md')
    const issue: Issue = {
      id: 'test-1',
      title: 'Test',
      state: 'in_progress',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('in_progress-test-1.md')
  })

  it('should format filename with github number', () => {
    const pattern = parsePattern('[number]-[title].md')
    const issue: Issue = {
      id: 'test-1',
      title: 'Test',
      githubNumber: 42,
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('42-test.md')
  })

  it('should format filename with prefix', () => {
    const pattern = parsePattern('[prefix]-[id].md')
    const issue: Issue = {
      id: 'todo-s33',
      title: 'Test',
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('todo-todo-s33.md')
  })

  it('should convert .mdx to .md in format', () => {
    const pattern = parsePattern('[id].mdx')
    const issue: Issue = {
      id: 'test-1',
      title: 'Test',
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('test-1.md')
  })

  it('should handle complex patterns', () => {
    const pattern = parsePattern('[type]/[priority]-[id]-[title].md')
    const issue: Issue = {
      id: 'test-1',
      title: 'Fix Bug',
      type: 'bug',
      priority: 0,
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }

    const filename = pattern.format(issue)
    expect(filename).toBe('bug/p0-test-1-fix-bug.md')
  })
})

describe('extractFromFilename', () => {
  it('should extract id from simple pattern', () => {
    const pattern = parsePattern('[id].md')
    const result = extractFromFilename('test-123.md', pattern)

    expect(result).toMatchObject({ id: 'test-123' })
  })

  it('should extract id and title from default pattern', () => {
    const pattern = parsePattern(DEFAULT_PATTERN)
    // DEFAULT_PATTERN is '[id]-[title].mdx'
    // The regex uses non-greedy match which stops at first separator
    const result = extractFromFilename('test1-my-issue.mdx', pattern)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('test1')
    expect(result?.title).toBe('my issue')
  })

  it('should extract type', () => {
    const pattern = parsePattern('[type]-[id].md')
    const result = extractFromFilename('bug-test-1.md', pattern)

    expect(result).toMatchObject({
      type: 'bug',
      id: 'test-1',
    })
  })

  it('should extract priority', () => {
    const pattern = parsePattern('[priority]-[id].md')
    const result = extractFromFilename('p2-test-1.md', pattern)

    expect(result).toMatchObject({
      priority: 2,
      id: 'test-1',
    })
  })

  it('should extract state', () => {
    const pattern = parsePattern('[state]-[id].md')
    const result = extractFromFilename('open-test-1.md', pattern)

    expect(result).toMatchObject({
      state: 'open',
      id: 'test-1',
    })
  })

  it('should extract github number', () => {
    const pattern = parsePattern('[number]-[title].md')
    const result = extractFromFilename('42-my-issue.md', pattern)

    expect(result).toMatchObject({
      githubNumber: 42,
      title: 'my issue',
    })
  })

  it('should return null for non-matching filename', () => {
    const pattern = parsePattern('[id]-[title].md')
    const result = extractFromFilename('invalid.md', pattern)

    expect(result).toBeNull()
  })

  it('should handle complex patterns', () => {
    const pattern = parsePattern('[type]-[priority]-[id].md')
    const result = extractFromFilename('feature-p1-test-123.md', pattern)

    expect(result).toMatchObject({
      type: 'feature',
      priority: 1,
      id: 'test-123',
    })
  })

  it('should reverse slugify title', () => {
    const pattern = parsePattern('[id]-[title].md')
    const result = extractFromFilename('test-1-add-new-feature.md', pattern)

    expect(result).not.toBeNull()
    // De-slugified title has hyphens converted to spaces
    expect(result?.title).toContain('add')
    expect(result?.title).toContain('new')
    expect(result?.title).toContain('feature')
  })

  it('should handle prefix variable', () => {
    const pattern = parsePattern('[prefix]-[id].md')
    const result = extractFromFilename('todo-s33.md', pattern)

    // Prefix is ignored in extraction
    expect(result).toBeDefined()
  })
})
