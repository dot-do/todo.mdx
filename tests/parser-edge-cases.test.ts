import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseTodoFile, loadTodoFiles } from '../src/parser.js'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

describe('parseTodoFile - edge cases', () => {
  it('should throw error for empty frontmatter (no ID)', () => {
    const content = `---
---

Content only
`
    // Should throw because ID is required
    expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
  })

  it('should throw error for content without frontmatter (no ID)', () => {
    const content = 'Just plain markdown content'
    // Should throw because ID is required
    expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
  })

  it('should handle multiline title with quotes', () => {
    const content = `---
id: test
title: "A title with
newlines"
---

Content
`
    const result = parseTodoFile(content)
    // The simple parser doesn't handle multiline values, so it just gets first line (with quote)
    expect(result.issue.title).toBe('"A title with')
  })

  it('should handle empty labels array', () => {
    const content = `---
id: test
title: Test
labels: []
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.labels).toEqual([])
  })

  it('should handle labels with spaces', () => {
    const content = `---
id: test
title: Test
labels: [needs review, in progress]
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.labels).toEqual(['needs review', 'in progress'])
  })

  it('should handle boolean values', () => {
    const content = `---
id: test
title: Test
draft: true
archived: false
---

Content
`
    const result = parseTodoFile(content)
    expect(result.frontmatter.draft).toBe(true)
    expect(result.frontmatter.archived).toBe(false)
  })

  it('should handle null values', () => {
    const content = `---
id: test
title: Test
assignee: null
---

Content
`
    const result = parseTodoFile(content)
    expect(result.frontmatter.assignee).toBe(null)
  })

  it('should handle numeric strings', () => {
    const content = `---
id: test
title: Test
estimatedHours: 5
confidence: 0.95
---

Content
`
    const result = parseTodoFile(content)
    expect(result.frontmatter.estimatedHours).toBe(5)
    expect(result.frontmatter.confidence).toBe(0.95)
  })

  it('should handle comments in frontmatter', () => {
    const content = `---
# This is a comment
id: test
title: Test
# Another comment
priority: 3
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.id).toBe('test')
    expect(result.issue.priority).toBe(3)
  })

  it('should handle single quotes in values', () => {
    const content = `---
id: test
title: 'Test with single quotes'
assignee: 'user@example.com'
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.title).toBe('Test with single quotes')
    expect(result.issue.assignee).toBe('user@example.com')
  })

  it('should clamp out-of-range priority values and default non-numeric', () => {
    const testCases = [
      { value: -1, expected: 0 },  // Clamped to 0
      { value: 5, expected: 4 },   // Clamped to 4
      { value: 10, expected: 4 },  // Clamped to 4
      { value: 'high', expected: 2 }, // Default to 2
      { value: NaN, expected: 2 }  // Default to 2
    ]

    for (const { value, expected } of testCases) {
      const content = `---
id: test
title: Test
priority: ${value}
---

Content
`
      const result = parseTodoFile(content)
      expect(result.issue.priority).toBe(expected)
    }
  })

  it('should handle very long descriptions', () => {
    const longContent = '# Title\n\n' + 'Lorem ipsum '.repeat(1000)
    const content = `---
id: test
title: Test
---

${longContent}`
    const result = parseTodoFile(content)
    expect(result.issue.description).toBe(longContent.trim())
    expect(result.issue.description!.length).toBeGreaterThan(10000)
  })

  it('should preserve markdown formatting in description', () => {
    const markdown = `# Heading

## Subheading

- List item 1
- List item 2

\`\`\`typescript
const code = 'block';
\`\`\`

**Bold** and *italic* text.`

    const content = `---
id: test
title: Test
---

${markdown}
`
    const result = parseTodoFile(content)
    expect(result.issue.description).toBe(markdown)
  })

  // Edge case: Missing title should use fallback value
  it('should use "Untitled" fallback when title is missing', () => {
    const content = `---
id: test-123
priority: 3
---

Some description content
`
    const result = parseTodoFile(content)
    expect(result.issue.id).toBe('test-123')
    expect(result.issue.title).toBe('Untitled')
    expect(result.issue.description).toBe('Some description content')
  })

  // Edge case: Malformed YAML should provide helpful error messages
  it('should handle malformed YAML with unclosed brackets', () => {
    const content = `---
id: test
title: Test
labels: [tag1, tag2
---

Content
`
    // The parser should still work - JSON.parse will fail but fallback to comma-separated
    const result = parseTodoFile(content)
    expect(result.issue.id).toBe('test')
    // The malformed array should be handled gracefully
  })

  it('should handle malformed YAML with invalid key-value pairs', () => {
    const content = `---
id: test
title: Test
invalid line without colon
priority: 3
---

Content
`
    // Markdown.extractMeta should skip invalid lines
    const result = parseTodoFile(content)
    expect(result.issue.id).toBe('test')
    expect(result.issue.priority).toBe(3)
  })

  // Edge case: Unicode characters in titles and descriptions
  it('should handle Japanese characters in title', () => {
    const content = `---
id: test
title: タスク管理システム
---

日本語の説明文
`
    const result = parseTodoFile(content)
    expect(result.issue.title).toBe('タスク管理システム')
    expect(result.issue.description).toBe('日本語の説明文')
  })

  it('should handle emoji in title and description', () => {
    const content = `---
id: test
title: "🚀 Launch feature 🎉"
---

Add support for emoji 😊 🎨 ✨
`
    const result = parseTodoFile(content)
    expect(result.issue.title).toBe('🚀 Launch feature 🎉')
    expect(result.issue.description).toContain('😊 🎨 ✨')
  })

  it('should handle accented characters in title', () => {
    const content = `---
id: test
title: "Améliorer la qualité du café"
assignee: "François"
---

Résumé: café très important
`
    const result = parseTodoFile(content)
    expect(result.issue.title).toBe('Améliorer la qualité du café')
    expect(result.issue.assignee).toBe('François')
    expect(result.issue.description).toContain('Résumé')
  })

  // Edge case: Special characters in ID
  it('should accept IDs with underscores and hyphens', () => {
    const content = `---
id: test_123-abc
title: Test
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.id).toBe('test_123-abc')
  })

  it('should accept IDs with dots', () => {
    const content = `---
id: test.123.abc
title: Test
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.id).toBe('test.123.abc')
  })

  it('should reject IDs with only whitespace', () => {
    const content = `---
id: "   "
title: Test
---

Content
`
    expect(() => parseTodoFile(content)).toThrow(/ID cannot be empty/)
  })

  // Edge case: Very long titles
  it('should handle very long titles without truncation', () => {
    const longTitle = 'A'.repeat(1000)
    const content = `---
id: test
title: "${longTitle}"
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.title).toBe(longTitle)
    expect(result.issue.title.length).toBe(1000)
  })

  it('should handle very long titles with spaces', () => {
    const longTitle = 'Lorem ipsum dolor sit amet '.repeat(50)
    const content = `---
id: test
title: "${longTitle}"
---

Content
`
    const result = parseTodoFile(content)
    expect(result.issue.title).toBe(longTitle)
    expect(result.issue.title.length).toBeGreaterThan(1000)
  })
})

describe('loadTodoFiles - duplicate ID handling', () => {
  let testDir: string

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = join(tmpdir(), `todo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  it('should load multiple files with different IDs', async () => {
    await writeFile(join(testDir, 'issue1.md'), `---
id: test-1
title: First Issue
---

First content`)

    await writeFile(join(testDir, 'issue2.md'), `---
id: test-2
title: Second Issue
---

Second content`)

    const issues = await loadTodoFiles(testDir)
    expect(issues).toHaveLength(2)
    expect(issues.map(i => i.id).sort()).toEqual(['test-1', 'test-2'])
  })

  it('should load all files even when IDs are duplicated', async () => {
    await writeFile(join(testDir, 'issue1.md'), `---
id: duplicate-id
title: First Issue
---

First content`)

    await writeFile(join(testDir, 'issue2.md'), `---
id: duplicate-id
title: Second Issue
---

Second content`)

    const issues = await loadTodoFiles(testDir)
    // Both files should be loaded, even with duplicate IDs
    expect(issues).toHaveLength(2)
    expect(issues.every(i => i.id === 'duplicate-id')).toBe(true)

    // They should have different titles
    const titles = issues.map(i => i.title).sort()
    expect(titles).toEqual(['First Issue', 'Second Issue'])
  })

  it('should skip files with parsing errors but load valid files', async () => {
    await writeFile(join(testDir, 'valid.md'), `---
id: valid-1
title: Valid Issue
---

Valid content`)

    await writeFile(join(testDir, 'invalid.md'), `---
title: No ID Issue
---

This should fail`)

    await writeFile(join(testDir, 'also-valid.md'), `---
id: valid-2
title: Another Valid Issue
---

Also valid`)

    const issues = await loadTodoFiles(testDir)
    // Only the valid files should be loaded
    expect(issues).toHaveLength(2)
    expect(issues.map(i => i.id).sort()).toEqual(['valid-1', 'valid-2'])
  })

  it('should handle empty directory', async () => {
    const issues = await loadTodoFiles(testDir)
    expect(issues).toEqual([])
  })

  it('should return empty array for non-existent directory', async () => {
    const nonExistentDir = join(testDir, 'does-not-exist')
    const issues = await loadTodoFiles(nonExistentDir)
    expect(issues).toEqual([])
  })

  it('should only load .md files and ignore other files', async () => {
    await writeFile(join(testDir, 'issue.md'), `---
id: test-1
title: Markdown Issue
---

Content`)

    await writeFile(join(testDir, 'readme.txt'), 'Not a markdown file')
    await writeFile(join(testDir, 'config.json'), '{}')

    const issues = await loadTodoFiles(testDir)
    expect(issues).toHaveLength(1)
    expect(issues[0].id).toBe('test-1')
  })
})
