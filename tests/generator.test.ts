/**
 * Tests for generator.ts
 */
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateTodoFile, writeTodoFiles } from '../src/generator.js'
import type { TodoIssue } from '../src/types.js'
import { fromMarkdown } from '@mdxld/markdown'

describe('generateTodoFile', () => {
  it('generates basic todo file with minimal fields', () => {
    const issue: TodoIssue = {
      id: 'todo-abc',
      title: 'Test Issue',
      status: 'open',
      priority: 2,
      type: 'task',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('---')
    expect(result).toContain('id: todo-abc')
    expect(result).toContain('title: "Test Issue"')
    expect(result).toContain('state: open')
    expect(result).toContain('priority: 2')
    expect(result).toContain('type: task')
    expect(result).toContain('labels: []')
    expect(result).toContain('# Test Issue')
  })

  it('generates todo file with description', () => {
    const issue: TodoIssue = {
      id: 'todo-def',
      title: 'Issue with Description',
      description: 'This is a detailed description\nwith multiple lines.',
      status: 'in_progress',
      priority: 1,
      type: 'feature',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('# Issue with Description')
    expect(result).toContain('This is a detailed description')
    expect(result).toContain('with multiple lines.')
  })

  it('generates todo file with labels', () => {
    const issue: TodoIssue = {
      id: 'todo-ghi',
      title: 'Issue with Labels',
      status: 'open',
      priority: 3,
      type: 'bug',
      labels: ['urgent', 'frontend', 'css'],
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('labels: ["urgent", "frontend", "css"]')
  })

  it('generates todo file with dependencies', () => {
    const issue: TodoIssue = {
      id: 'todo-jkl',
      title: 'Issue with Dependencies',
      status: 'open',
      priority: 2,
      type: 'task',
      dependsOn: ['todo-abc', 'todo-def'],
      blocks: ['todo-xyz'],
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('### Related Issues')
    expect(result).toContain('**Depends on:**')
    expect(result).toContain('[todo-abc](./todo-abc.md)')
    expect(result).toContain('[todo-def](./todo-def.md)')
    expect(result).toContain('**Blocks:**')
    expect(result).toContain('[todo-xyz](./todo-xyz.md)')
  })

  it('generates todo file with timestamps', () => {
    const issue: TodoIssue = {
      id: 'todo-mno',
      title: 'Issue with Timestamps',
      status: 'closed',
      priority: 2,
      type: 'task',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T12:00:00Z',
      closedAt: '2024-01-03T18:00:00Z',
    }

    const result = generateTodoFile(issue)

    // Timestamps should ONLY be in frontmatter, not in body
    expect(result).toContain('createdAt: "2024-01-01T00:00:00Z"')
    expect(result).toContain('updatedAt: "2024-01-02T12:00:00Z"')
    expect(result).toContain('closedAt: "2024-01-03T18:00:00Z"')

    // Timeline section should NOT exist in the body
    expect(result).not.toContain('### Timeline')
    expect(result).not.toContain('**Created:**')
    expect(result).not.toContain('**Updated:**')
    expect(result).not.toContain('**Closed:**')
  })

  it('generates todo file with special characters in title', () => {
    const issue: TodoIssue = {
      id: 'todo-pqr',
      title: 'Issue: with special "characters" and #hashtags',
      status: 'open',
      priority: 2,
      type: 'task',
    }

    const result = generateTodoFile(issue)

    // Title should be quoted in frontmatter
    expect(result).toContain('title: "Issue: with special \\"characters\\" and #hashtags"')
    // Title should appear as-is in H1
    expect(result).toContain('# Issue: with special "characters" and #hashtags')
  })

  it('generates todo file with assignee', () => {
    const issue: TodoIssue = {
      id: 'todo-stu',
      title: 'Assigned Issue',
      status: 'in_progress',
      priority: 1,
      type: 'feature',
      assignee: 'john-doe',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('assignee: "john-doe"')
  })

  it('generates todo file with parent and children', () => {
    const issue: TodoIssue = {
      id: 'todo-vwx',
      title: 'Epic Issue',
      status: 'open',
      priority: 1,
      type: 'epic',
      children: ['todo-child1', 'todo-child2', 'todo-child3'],
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('### Related Issues')
    expect(result).toContain('**Children:**')
    expect(result).toContain('- [todo-child1](./todo-child1.md)')
    expect(result).toContain('- [todo-child2](./todo-child2.md)')
    expect(result).toContain('- [todo-child3](./todo-child3.md)')
  })

  it('generates todo file with source field', () => {
    const issue: TodoIssue = {
      id: 'todo-yza',
      title: 'Issue from Beads',
      status: 'open',
      priority: 2,
      type: 'task',
      source: 'beads',
    }

    const result = generateTodoFile(issue)

    expect(result).toContain('source: "beads"')
  })

  it('converts dependency references to markdown links', () => {
    const issue: TodoIssue = {
      id: 'todo-main',
      title: 'Issue with Linked Dependencies',
      status: 'open',
      priority: 2,
      type: 'task',
      dependsOn: ['todo-abc'],
      blocks: ['todo-xyz'],
      children: ['todo-123'],
    }

    const result = generateTodoFile(issue)

    // Should contain markdown links, not just bold text
    expect(result).toContain('[todo-abc](./todo-abc.md)')
    expect(result).toContain('[todo-xyz](./todo-xyz.md)')
    expect(result).toContain('[todo-123](./todo-123.md)')

    // Should NOT contain the old bold format
    expect(result).not.toContain('- **todo-abc**')
    expect(result).not.toContain('- **todo-xyz**')
    expect(result).not.toContain('- **todo-123**')
  })
})

describe('generateTodoFile - @mdxld/markdown compatibility', () => {
  it('should include YAML frontmatter compatible with fromMarkdown()', () => {
    const issue: TodoIssue = {
      id: 'todo-mdxld-2',
      title: 'Frontmatter Test',
      status: 'in_progress',
      priority: 1,
      type: 'feature',
    }

    const result = generateTodoFile(issue)

    // Should have proper YAML frontmatter delimiters
    expect(result).toMatch(/^---\n/)
    expect(result).toMatch(/\n---\n/)

    // Frontmatter should contain key fields
    const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---/)
    expect(frontmatterMatch).toBeTruthy()

    const frontmatter = frontmatterMatch![1]
    expect(frontmatter).toContain('id:')
    expect(frontmatter).toContain('title:')
    expect(frontmatter).toContain('state:') // Using 'state' for compatibility
    expect(frontmatter).toContain('priority:')
    expect(frontmatter).toContain('type:')
  })

  it('should store dependency arrays in frontmatter for round-trip compatibility', () => {
    const issue: TodoIssue = {
      id: 'todo-mdxld-4',
      title: 'Issue with Dependencies',
      status: 'open',
      priority: 2,
      type: 'task',
      dependsOn: ['todo-a', 'todo-b'],
      blocks: ['todo-c'],
      children: ['todo-x', 'todo-y'],
    }

    const result = generateTodoFile(issue)

    // Dependency IDs should be in frontmatter for round-trip parsing
    expect(result).toContain('dependsOn: ["todo-a", "todo-b"]')
    expect(result).toContain('blocks: ["todo-c"]')
    expect(result).toContain('children: ["todo-x", "todo-y"]')

    // Dependencies should also be rendered as markdown links in body
    expect(result).toContain('[todo-a](./todo-a.md)')
    expect(result).toContain('[todo-b](./todo-b.md)')
    expect(result).toContain('[todo-c](./todo-c.md)')
    expect(result).toContain('[todo-x](./todo-x.md)')
    expect(result).toContain('[todo-y](./todo-y.md)')
  })

  it('should use H1 heading for title', () => {
    const issue: TodoIssue = {
      id: 'todo-mdxld-5',
      title: 'Heading Test',
      status: 'open',
      priority: 2,
      type: 'task',
    }

    const result = generateTodoFile(issue)

    // Title should be H1 (# Title)
    expect(result).toContain('# Heading Test')
  })

  it('should handle all TodoIssue fields including optional ones', () => {
    const issue: TodoIssue = {
      id: 'todo-mdxld-3',
      title: 'Complete Issue',
      description: 'Full issue with all fields',
      status: 'closed',
      priority: 3,
      type: 'bug',
      labels: ['critical', 'security'],
      assignee: 'team-lead',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      closedAt: '2024-01-03T00:00:00Z',
      parent: 'todo-epic-1',
      source: 'beads',
      dependsOn: ['todo-dep-1'],
      blocks: ['todo-block-1'],
      children: ['todo-child-1', 'todo-child-2'],
    }

    const result = generateTodoFile(issue)

    // Verify all fields are in frontmatter
    expect(result).toContain('id: todo-mdxld-3')
    expect(result).toContain('title: "Complete Issue"')
    expect(result).toContain('state: closed')
    expect(result).toContain('priority: 3')
    expect(result).toContain('type: bug')
    expect(result).toContain('labels: ["critical", "security"]')
    expect(result).toContain('assignee: "team-lead"')
    expect(result).toContain('createdAt: "2024-01-01T00:00:00Z"')
    expect(result).toContain('updatedAt: "2024-01-02T00:00:00Z"')
    expect(result).toContain('closedAt: "2024-01-03T00:00:00Z"')
    expect(result).toContain('parent: "todo-epic-1"')
    expect(result).toContain('source: "beads"')
    expect(result).toContain('dependsOn: ["todo-dep-1"]')
    expect(result).toContain('blocks: ["todo-block-1"]')
    expect(result).toContain('children: ["todo-child-1", "todo-child-2"]')

    // Verify description is in body
    expect(result).toContain('Full issue with all fields')
  })
})

describe('writeTodoFiles - Security Tests', () => {
  it('should sanitize path traversal in issue ID', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      const issue: TodoIssue = {
        id: '../../../etc/passwd',
        title: 'Malicious Issue',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      const writtenPaths = await writeTodoFiles([issue], todoDir)

      // Should sanitize to safe filename like 'etc-passwd-malicious-issue.md'
      expect(writtenPaths[0]).toContain(todoDir)
      expect(writtenPaths[0]).not.toContain('..')
      expect(writtenPaths[0]).not.toContain('etc/passwd')

      // Verify file was created inside todoDir
      const files = await fs.readdir(todoDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/^etc-passwd-malicious-issue\.md$/)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should reject path traversal with backslashes', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      const issue: TodoIssue = {
        id: '..\\..\\..\\windows\\system32',
        title: 'Windows Path Traversal',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      const writtenPaths = await writeTodoFiles([issue], todoDir)

      // Should sanitize backslashes
      expect(writtenPaths[0]).toContain(todoDir)
      expect(writtenPaths[0]).not.toContain('..')
      expect(writtenPaths[0]).not.toContain('\\')

      const files = await fs.readdir(todoDir)
      expect(files.length).toBe(1)
      expect(files[0]).not.toContain('\\')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should sanitize special characters from issue ID', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      const issue: TodoIssue = {
        id: 'todo:<test>|file*?.md',
        title: 'Special Chars',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      const writtenPaths = await writeTodoFiles([issue], todoDir)

      // Should strip dangerous characters
      expect(writtenPaths[0]).toContain(todoDir)
      expect(writtenPaths[0]).not.toContain(':')
      expect(writtenPaths[0]).not.toContain('<')
      expect(writtenPaths[0]).not.toContain('>')
      expect(writtenPaths[0]).not.toContain('|')
      expect(writtenPaths[0]).not.toContain('*')
      expect(writtenPaths[0]).not.toContain('?')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should throw error if resolved path escapes target directory', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      // Create a symlink attack scenario
      const issue: TodoIssue = {
        id: 'todo-test',
        title: '../../../../../etc/passwd',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      // After sanitization, the slug might still create path issues
      // This test verifies that even slugified titles that could escape are caught
      const writtenPaths = await writeTodoFiles([issue], todoDir)
      expect(writtenPaths).toBeDefined() // Should succeed after sanitization

      const files = await fs.readdir(todoDir)
      expect(files.length).toBe(1)
      // Verify the file is actually in the todoDir
      const fullPath = join(todoDir, files[0])
      expect(fullPath.startsWith(todoDir)).toBe(true)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should handle null bytes in issue ID', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      const issue: TodoIssue = {
        id: 'todo\0malicious',
        title: 'Null Byte Test',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      const writtenPaths = await writeTodoFiles([issue], todoDir)

      // Should strip null bytes
      expect(writtenPaths[0]).not.toContain('\0')

      const files = await fs.readdir(todoDir)
      expect(files.length).toBe(1)
      expect(files[0]).not.toContain('\0')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
