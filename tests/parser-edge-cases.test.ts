import { describe, it, expect } from 'vitest'
import { parseTodoFile } from '../src/parser.js'

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
})
