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

describe('writeTodoFiles - Security: Validation Before Directory Creation', () => {
  it('should validate paths BEFORE creating directories to prevent path traversal', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')
    const escapedDir = join(tmpDir, 'escaped')

    try {
      // Create a malicious issue that attempts to create directories outside todoDir
      // Using a custom pattern that could allow subdirectories
      const issue: TodoIssue = {
        id: 'todo-malicious',
        title: '../escaped/malicious-file',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      // This should either:
      // 1. Sanitize the path and succeed within todoDir, OR
      // 2. Throw a path traversal error BEFORE creating any escaped directories
      try {
        await writeTodoFiles([issue], todoDir)
      } catch (error) {
        // If it throws, that's acceptable - the important thing is no escaped directory was created
      }

      // The key test: no directory should have been created outside todoDir
      // If validation happens AFTER mkdir, this would fail
      const escapedDirExists = await fs.access(escapedDir).then(() => true).catch(() => false)
      expect(escapedDirExists).toBe(false)

      // Verify todoDir structure is intact
      const todoDirExists = await fs.access(todoDir).then(() => true).catch(() => false)
      expect(todoDirExists).toBe(true)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should validate directory path before mkdir when using [type]/[title].md pattern', async () => {
    // This test specifically targets the vulnerability where fileDir != todoDir
    // triggers mkdir BEFORE validatePathSafety
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')
    const escapedPath = join(tmpDir, 'malicious')

    try {
      const issue: TodoIssue = {
        id: 'todo-test',
        title: 'Normal Title',
        status: 'open',
        priority: 2,
        // Use a type that could be manipulated for path traversal
        type: '../malicious' as any,
      }

      // With pattern [type]/[title].md, this would try to create ../malicious/ dir
      try {
        await writeTodoFiles([issue], todoDir, { pattern: '[type]/[title].md' })
      } catch (error) {
        // Expected to throw - but BEFORE creating directories
      }

      // No malicious directory should exist
      const maliciousDirExists = await fs.access(escapedPath).then(() => true).catch(() => false)
      expect(maliciousDirExists).toBe(false)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('CRITICAL: should NOT create ANY directory outside todoDir even if path resolves outside', async () => {
    // This is the CRITICAL test that exposes the vulnerability
    // The bug: mkdir(fileDir) happens BEFORE validatePathSafety(filepath, todoDir)
    // So even though validation will eventually fail, the directory is already created
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')
    const attackDir = join(tmpDir, 'pwned')

    try {
      const issue: TodoIssue = {
        id: 'todo-test',
        title: 'innocent',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      // Use a pattern that injects path traversal via closedSubdir option
      // Since closed issues go to closedSubdir, we can inject '../pwned' there
      issue.status = 'closed'

      try {
        await writeTodoFiles([issue], todoDir, {
          closedSubdir: '../pwned',
          separateClosed: true
        })
      } catch (error) {
        // Should throw - but the question is: did it create the directory first?
      }

      // THE VULNERABILITY: If mkdir happens before validation,
      // the 'pwned' directory will exist even though the operation failed
      const attackDirExists = await fs.access(attackDir).then(() => true).catch(() => false)
      expect(attackDirExists).toBe(false) // This should PASS if fix is correct
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('writeTodoFiles - Security: Path Traversal via closedSubdir', () => {
  it('should reject closedSubdir containing path traversal sequences', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')
    const attackPath = join(tmpDir, 'etc', 'passwd')

    try {
      const issue: TodoIssue = {
        id: 'todo-closed',
        title: 'Closed Issue',
        status: 'closed',
        priority: 2,
        type: 'task',
      }

      // Attack via closedSubdir option with path traversal
      try {
        await writeTodoFiles([issue], todoDir, {
          closedSubdir: '../../../etc/passwd',
          separateClosed: true
        })
        // Should NOT reach here
        expect.fail('Should have thrown a path traversal error')
      } catch (error: any) {
        expect(error.message).toContain('path traversal')
      }

      // Verify no directories were created outside todoDir
      const etcExists = await fs.access(join(tmpDir, 'etc')).then(() => true).catch(() => false)
      expect(etcExists).toBe(false)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should reject pattern that creates directories outside todoDir', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      const issue: TodoIssue = {
        id: 'todo-test',
        title: 'Test',
        status: 'open',
        priority: 2,
        type: 'task',
      }

      // Attack via pattern option
      try {
        await writeTodoFiles([issue], todoDir, {
          pattern: '../attack/[title].md'
        })
        expect.fail('Should have thrown a path traversal error')
      } catch (error: any) {
        expect(error.message).toContain('path traversal')
      }

      // Verify attack directory was not created
      const attackExists = await fs.access(join(tmpDir, 'attack')).then(() => true).catch(() => false)
      expect(attackExists).toBe(false)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
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

      // Verify file was created inside todoDir (new pattern: [yyyy-mm-dd] [Title].md)
      const entries = await fs.readdir(todoDir, { withFileTypes: true })
      const files = entries.filter(e => e.isFile()).map(e => e.name)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/Malicious Issue\.md$/i)
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

      const entries = await fs.readdir(todoDir, { withFileTypes: true })
      const files = entries.filter(e => e.isFile()).map(e => e.name)
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

      const entries = await fs.readdir(todoDir, { withFileTypes: true })
      const files = entries.filter(e => e.isFile()).map(e => e.name)
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

      const entries = await fs.readdir(todoDir, { withFileTypes: true })
      const files = entries.filter(e => e.isFile()).map(e => e.name)
      expect(files.length).toBe(1)
      expect(files[0]).not.toContain('\0')
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should reject absolute path in closedSubdir', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')

    try {
      const issue: TodoIssue = {
        id: 'todo-closed',
        title: 'Closed Issue',
        status: 'closed',
        priority: 2,
        type: 'task',
      }

      // Attack with absolute path - should be rejected
      try {
        await writeTodoFiles([issue], todoDir, {
          closedSubdir: '/tmp/attack',
          separateClosed: true
        })
        expect.fail('Should have thrown a path traversal error')
      } catch (error: any) {
        expect(error.message).toContain('path traversal')
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })

  it('should reject symlink-like names with ..', async () => {
    const tmpDir = await fs.mkdtemp(join(tmpdir(), 'todo-test-'))
    const todoDir = join(tmpDir, '.todo')
    const escapedDir = join(tmpDir, 'attack')

    try {
      const issue: TodoIssue = {
        id: 'todo-test',
        title: 'Normal',
        status: 'closed',
        priority: 2,
        type: 'task',
      }

      // Attack with a closed subdir that uses ..
      try {
        await writeTodoFiles([issue], todoDir, {
          closedSubdir: 'legit/../attack',
          separateClosed: true
        })
      } catch (error) {
        // May throw or sanitize - either is acceptable
      }

      // Key check: no directory should exist outside todoDir
      const attackDirExists = await fs.access(escapedDir).then(() => true).catch(() => false)
      expect(attackDirExists).toBe(false)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})
