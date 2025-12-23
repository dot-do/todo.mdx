import { describe, it, expect } from 'vitest'
import { extractIdFromFilename, applyPattern, parsePattern, type PatternToken } from '../src/patterns'
import type { TodoIssue } from '../src/types'

describe('parsePattern', () => {
  it('should parse simple pattern with id and title tokens', () => {
    const tokens = parsePattern('[id]-[title].md')

    expect(tokens).toHaveLength(4)

    // [id] token
    expect(tokens[0]).toEqual({
      type: 'variable',
      value: 'id',
      transform: 'preserve'
    })

    // '-' literal
    expect(tokens[1]).toEqual({
      type: 'literal',
      value: '-',
      transform: 'preserve'
    })

    // [title] token - dash before means slugify
    expect(tokens[2]).toEqual({
      type: 'variable',
      value: 'title',
      transform: 'slugify'
    })

    // '.md' literal
    expect(tokens[3]).toEqual({
      type: 'literal',
      value: '.md',
      transform: 'preserve'
    })
  })

  it('should detect slugify transform when dash delimiter precedes token', () => {
    const tokens = parsePattern('[id]-[title]-[type].md')

    // [id] - first token, no delimiter before
    expect(tokens[0].transform).toBe('preserve')

    // [title] - dash before
    expect(tokens.find(t => t.value === 'title')?.transform).toBe('slugify')

    // [type] - dash before
    expect(tokens.find(t => t.value === 'type')?.transform).toBe('slugify')
  })

  it('should detect preserve transform when space delimiter precedes token', () => {
    const tokens = parsePattern('[id] [title].md')

    // [id] - first token
    expect(tokens[0].transform).toBe('preserve')

    // Space literal between
    expect(tokens[1]).toEqual({
      type: 'literal',
      value: ' ',
      transform: 'preserve'
    })

    // [title] - space before
    expect(tokens.find(t => t.value === 'title')?.transform).toBe('preserve')
  })

  it('should detect capitalize transform for capitalized token names', () => {
    const tokens = parsePattern('[id] - [Title].md')

    // [Title] with capital T = capitalize
    expect(tokens.find(t => t.value === 'title')?.transform).toBe('capitalize')
  })

  it('should support all token types', () => {
    const pattern = '[id]-[title]-[yyyy-mm-dd]-[type]-[priority]-[assignee].md'
    const tokens = parsePattern(pattern)

    const variables = tokens.filter(t => t.type === 'variable')
    expect(variables).toHaveLength(6)

    const tokenNames = variables.map(t => t.value)
    expect(tokenNames).toContain('id')
    expect(tokenNames).toContain('title')
    expect(tokenNames).toContain('yyyy-mm-dd')
    expect(tokenNames).toContain('type')
    expect(tokenNames).toContain('priority')
    expect(tokenNames).toContain('assignee')
  })

  it('should handle literal text between tokens', () => {
    const tokens = parsePattern('[id] - [title] (v1).md')

    // Should have: [id], ' - ', [title], ' (v1).md'
    expect(tokens).toHaveLength(4)

    expect(tokens[0]).toEqual({
      type: 'variable',
      value: 'id',
      transform: 'preserve'
    })

    expect(tokens[1]).toEqual({
      type: 'literal',
      value: ' - ',
      transform: 'preserve'
    })

    expect(tokens[2]).toEqual({
      type: 'variable',
      value: 'title',
      transform: 'preserve' // space before
    })

    expect(tokens[3]).toEqual({
      type: 'literal',
      value: ' (v1).md',
      transform: 'preserve'
    })
  })

  it('should handle pattern with only literals', () => {
    const tokens = parsePattern('README.md')

    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toEqual({
      type: 'literal',
      value: 'README.md',
      transform: 'preserve'
    })
  })

  it('should handle pattern with only a single token', () => {
    const tokens = parsePattern('[id].md')

    expect(tokens).toHaveLength(2)
    expect(tokens[0]).toEqual({
      type: 'variable',
      value: 'id',
      transform: 'preserve'
    })
    expect(tokens[1]).toEqual({
      type: 'literal',
      value: '.md',
      transform: 'preserve'
    })
  })

  it('should handle subdirectory patterns', () => {
    const tokens = parsePattern('.todo/[type]/[id]-[title].md')

    const literals = tokens.filter(t => t.type === 'literal')
    const variables = tokens.filter(t => t.type === 'variable')

    expect(literals[0].value).toBe('.todo/')
    expect(variables[0].value).toBe('type')
    expect(literals[1].value).toBe('/')
    expect(variables[1].value).toBe('id')
  })

  it('should normalize capitalized tokens to lowercase', () => {
    const tokens = parsePattern('[Id]-[Title]-[Type].md')

    const variables = tokens.filter(t => t.type === 'variable')

    // Token values should be normalized to lowercase
    expect(variables[0].value).toBe('id')
    expect(variables[1].value).toBe('title')
    expect(variables[2].value).toBe('type')

    // But transform should be capitalize for capitalized tokens
    expect(variables[0].transform).toBe('capitalize')
    expect(variables[1].transform).toBe('capitalize')
    expect(variables[2].transform).toBe('capitalize')
  })

  it('should handle mixed delimiter contexts', () => {
    const tokens = parsePattern('[id]-[title] [type].md')

    const titleToken = tokens.find(t => t.type === 'variable' && t.value === 'title')
    const typeToken = tokens.find(t => t.type === 'variable' && t.value === 'type')

    // [title] has dash before = slugify
    expect(titleToken?.transform).toBe('slugify')

    // [type] has space before = preserve
    expect(typeToken?.transform).toBe('preserve')
  })
})

describe('extractIdFromFilename', () => {
  it('should extract id from simple pattern with dash delimiter', () => {
    const result = extractIdFromFilename('todo-abc-add-user-auth.md', '[id]-[title].md')
    expect(result).toBe('todo-abc')
  })

  it('should return null when pattern has no id token', () => {
    const result = extractIdFromFilename('2025-12-23 Add User Auth.md', '[yyyy-mm-dd] [Title].md')
    expect(result).toBe(null)
  })

  it('should extract id from subdirectory pattern', () => {
    const result = extractIdFromFilename('feature/todo-abc.md', '[type]/[id].md')
    expect(result).toBe('todo-abc')
  })

  it('should return null if pattern does not match', () => {
    const result = extractIdFromFilename('random-file.txt', '[id]-[title].md')
    expect(result).toBe(null)
  })

  it('should handle variable-length title tokens correctly', () => {
    const result = extractIdFromFilename('todo-xyz-this-is-a-very-long-title-with-many-words.md', '[id]-[title].md')
    expect(result).toBe('todo-xyz')
  })

  it('should extract id when title has mixed case', () => {
    const result = extractIdFromFilename('todo-def-Add-New-Feature.md', '[id]-[Title].md')
    expect(result).toBe('todo-def')
  })

  it('should handle id-only pattern', () => {
    const result = extractIdFromFilename('todo-123.md', '[id].md')
    expect(result).toBe('todo-123')
  })

  it('should return null when filename has wrong extension', () => {
    const result = extractIdFromFilename('todo-abc-title.txt', '[id]-[title].md')
    expect(result).toBe(null)
  })

  it('should handle pattern with spaces', () => {
    const result = extractIdFromFilename('todo-abc Add User Auth.md', '[id] [Title].md')
    expect(result).toBe('todo-abc')
  })

  it('should handle complex subdirectory patterns', () => {
    const result = extractIdFromFilename('bugs/high/todo-bug-123.md', '[type]/[priority]/[id].md')
    expect(result).toBe('todo-bug-123')
  })
})

describe('applyPattern', () => {
  const baseIssue: TodoIssue = {
    id: 'todo-abc',
    title: 'Add User Auth',
    status: 'open',
    type: 'feature',
    priority: 2,
    createdAt: '2025-12-23T10:00:00Z',
  }

  describe('basic pattern application', () => {
    it('should apply pattern [id]-[title].md', () => {
      const result = applyPattern('[id]-[title].md', baseIssue)
      expect(result).toBe('todo-abc-add-user-auth.md')
    })

    it('should apply pattern [yyyy-mm-dd] [Title].md with capitalized title', () => {
      const result = applyPattern('[yyyy-mm-dd] [Title].md', baseIssue)
      expect(result).toBe('2025-12-23 Add User Auth.md')
    })

    it('should apply pattern [type]/[id].md with subdirectory', () => {
      const result = applyPattern('[type]/[id].md', baseIssue)
      expect(result).toBe('feature/todo-abc.md')
    })
  })

  describe('edge cases', () => {
    it('should remove slashes from title', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'Fix API/Database Bug',
      }
      const result = applyPattern('[id]-[title].md', issue)
      expect(result).toBe('todo-abc-fix-api-database-bug.md')
      expect(result).not.toContain('/')
    })

    it('should preserve dots in title', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'Update README.md file',
      }
      const result = applyPattern('[id]-[title].md', issue)
      expect(result).toBe('todo-abc-update-readme.md-file.md')
    })

    it('should skip empty title token if title is missing', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: '',
      }
      const result = applyPattern('[id]-[title].md', issue)
      // Should skip the empty title and the preceding dash
      expect(result).toBe('todo-abc.md')
    })

    it('should handle missing optional fields gracefully', () => {
      const issue: TodoIssue = {
        id: 'todo-minimal',
        title: 'Minimal',
        status: 'open',
        type: 'task',
        priority: 2,
        // No createdAt, assignee, etc.
      }
      const result = applyPattern('[id]-[title].md', issue)
      expect(result).toBe('todo-minimal-minimal.md')
    })
  })

  describe('long title truncation', () => {
    it('should truncate very long titles to ~100 chars', () => {
      const longTitle =
        'This is a very long title that exceeds one hundred characters and should be truncated to prevent filesystem issues'
      const issue: TodoIssue = {
        ...baseIssue,
        title: longTitle,
      }
      const result = applyPattern('[id]-[title].md', issue)

      // Should be truncated but keep the extension
      expect(result.length).toBeLessThan(120) // ~100 chars + extension
      expect(result).toMatch(/^todo-abc-this-is-a-very-long-title.*\.md$/)
      expect(result.endsWith('.md')).toBe(true)
    })

    it('should truncate at word boundary when possible', () => {
      const longTitle = 'Add comprehensive authentication system with OAuth2 and SAML support for enterprise customers'
      const issue: TodoIssue = {
        ...baseIssue,
        title: longTitle,
      }
      const result = applyPattern('[id]-[title].md', issue)

      // Should not cut in the middle of a word
      expect(result).not.toMatch(/-[a-z]+-\.md$/)
      expect(result.endsWith('.md')).toBe(true)
    })
  })

  describe('collision handling', () => {
    it('should append -1 suffix when file exists', () => {
      const existingFiles = ['todo-abc-add-user-auth.md']
      const result = applyPattern('[id]-[title].md', baseIssue, existingFiles)
      expect(result).toBe('todo-abc-add-user-auth-1.md')
    })

    it('should append -2 suffix when -1 also exists', () => {
      const existingFiles = [
        'todo-abc-add-user-auth.md',
        'todo-abc-add-user-auth-1.md',
      ]
      const result = applyPattern('[id]-[title].md', baseIssue, existingFiles)
      expect(result).toBe('todo-abc-add-user-auth-2.md')
    })

    it('should handle collisions with subdirectories', () => {
      const existingFiles = ['feature/todo-abc.md']
      const result = applyPattern('[type]/[id].md', baseIssue, existingFiles)
      expect(result).toBe('feature/todo-abc-1.md')
    })

    it('should not add suffix if no collision', () => {
      const existingFiles = ['todo-xyz-other-issue.md']
      const result = applyPattern('[id]-[title].md', baseIssue, existingFiles)
      expect(result).toBe('todo-abc-add-user-auth.md')
    })
  })

  describe('date formatting', () => {
    it('should format yyyy-mm-dd from createdAt', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        createdAt: '2025-12-23T15:30:00Z',
      }
      const result = applyPattern('[yyyy-mm-dd]-[title].md', issue)
      expect(result).toBe('2025-12-23-add-user-auth.md')
    })

    it('should use current date if createdAt is missing', () => {
      const issue: TodoIssue = {
        id: 'todo-test',
        title: 'Test',
        status: 'open',
        type: 'task',
        priority: 2,
        // No createdAt
      }
      const result = applyPattern('[yyyy-mm-dd]-[title].md', issue)
      // Should match today's date pattern
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-test\.md$/)
    })
  })

  describe('title transformations', () => {
    it('should slugify title with dashes when in dash context', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'Fix Bug: API Timeout!',
      }
      const result = applyPattern('[id]-[title].md', issue)
      expect(result).toBe('todo-abc-fix-bug-api-timeout.md')
    })

    it('should preserve spaces when in space context', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'Fix Bug: API Timeout!',
      }
      const result = applyPattern('[id] [title].md', issue)
      expect(result).toBe('todo-abc Fix Bug API Timeout.md')
    })

    it('should capitalize [Title] variant', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'add user authentication',
      }
      const result = applyPattern('[Title].md', issue)
      expect(result).toBe('Add User Authentication.md')
    })
  })

  describe('special characters', () => {
    it('should remove special characters in slugified context', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'Fix: API (v2) Bug!',
      }
      const result = applyPattern('[id]-[title].md', issue)
      expect(result).toBe('todo-abc-fix-api-v2-bug.md')
    })

    it('should handle unicode characters', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        title: 'Add café menu 🍕',
      }
      const result = applyPattern('[id]-[title].md', issue)
      // Should handle unicode gracefully
      expect(result).toMatch(/^todo-abc-add-cafe-menu.*\.md$/)
    })
  })

  describe('other token types', () => {
    it('should resolve [type] token', () => {
      const result = applyPattern('[type]-[id].md', baseIssue)
      expect(result).toBe('feature-todo-abc.md')
    })

    it('should resolve [priority] token', () => {
      const result = applyPattern('[priority]-[title].md', baseIssue)
      expect(result).toBe('2-add-user-auth.md')
    })

    it('should resolve [assignee] token', () => {
      const issue: TodoIssue = {
        ...baseIssue,
        assignee: 'john@example.com',
      }
      const result = applyPattern('[assignee]-[title].md', issue)
      expect(result).toBe('john-add-user-auth.md')
    })

    it('should skip [assignee] token if not set', () => {
      const result = applyPattern('[assignee]-[title].md', baseIssue)
      // Should skip the assignee and its delimiter
      expect(result).toBe('add-user-auth.md')
    })
  })
})
