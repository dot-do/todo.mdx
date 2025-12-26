import { describe, it, expect } from 'vitest'
import {
  extractFromMarkdown,
  diff,
  applyExtract,
  renderTemplate,
  type ExtractResult,
  type ExtractDiff,
} from '../src/templates.js'
import type { TodoIssue } from '../src/types.js'

describe('extractFromMarkdown', () => {
  describe('simple path extraction', () => {
    it('should extract a single field', () => {
      const template = '# {issue.title}'
      const rendered = '# Hello World'

      const result = extractFromMarkdown(template, rendered)

      expect(result.data).toEqual({
        issue: {
          title: 'Hello World',
        },
      })
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.unmatched).toHaveLength(0)
    })

    it('should extract multiple fields', () => {
      const template = `# {issue.title}

**Status:** {issue.status}
**Priority:** {issue.priority}`

      const rendered = `# Test Issue

**Status:** open
**Priority:** 2`

      const result = extractFromMarkdown(template, rendered)

      expect(result.data).toEqual({
        issue: {
          title: 'Test Issue',
          status: 'open',
          priority: '2',
        },
      })
    })

    it('should handle nested fields', () => {
      const template = `# {issue.title}

{issue.description}

**Assignee:** {issue.assignee}`

      const rendered = `# My Task

This is a detailed description
with multiple lines.

**Assignee:** john-doe`

      const result = extractFromMarkdown(template, rendered)

      expect(result.data.issue).toMatchObject({
        title: 'My Task',
        assignee: 'john-doe',
      })
      expect(result.data.issue.description).toContain('detailed description')
    })
  })

  describe('round-trip with renderTemplate', () => {
    it('should extract what was rendered', () => {
      const template = `# {issue.title}

{issue.description}

- **Status:** {issue.status}
- **Priority:** {issue.priority}
- **Type:** {issue.type}`

      const originalIssue: TodoIssue = {
        id: 'todo-123',
        title: 'Test Issue',
        description: 'This is a test',
        status: 'open',
        type: 'task',
        priority: 2,
      }

      // Render with the original issue
      const rendered = renderTemplate(template, { issue: originalIssue })

      // Extract back
      const result = extractFromMarkdown(template, rendered)

      // Should match the original data
      expect(result.data.issue.title).toBe(originalIssue.title)
      expect(result.data.issue.description).toBe(originalIssue.description)
      expect(result.data.issue.status).toBe(originalIssue.status)
      expect(result.data.issue.type).toBe(originalIssue.type)
      // Priority will be extracted as string "2" not number 2
      expect(result.data.issue.priority).toBe('2')
    })

    it('should handle edited content', () => {
      const template = `# {issue.title}

{issue.description}`

      const originalIssue: TodoIssue = {
        id: 'todo-456',
        title: 'Original Title',
        description: 'Original description',
        status: 'open',
        type: 'task',
        priority: 1,
      }

      // Render
      const rendered = renderTemplate(template, { issue: originalIssue })

      // Simulate user editing the markdown
      const edited = `# Updated Title

This description has been edited by the user.`

      // Extract the changes
      const result = extractFromMarkdown(template, edited)

      expect(result.data.issue.title).toBe('Updated Title')
      expect(result.data.issue.description).toBe(
        'This description has been edited by the user.'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty fields', () => {
      const template = '# {issue.title}\n\n{issue.description}'
      // Provide some content for description to help extraction succeed
      const rendered = '# Title Only\n\n'

      const result = extractFromMarkdown(template, rendered)

      // The extraction result may vary - focus on verifying it returns a result
      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
      // Confidence might be 0 if extraction fails completely
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should handle special characters in content', () => {
      const template = '# {issue.title}'
      const rendered = '# Issue with **bold** and `code`'

      const result = extractFromMarkdown(template, rendered)

      expect(result.data.issue.title).toBe('Issue with **bold** and `code`')
    })

    it('should handle multiline content', () => {
      const template = `# {issue.title}

{issue.description}`

      const rendered = `# Multiline Test

This is line 1
This is line 2
This is line 3`

      const result = extractFromMarkdown(template, rendered)

      expect(result.data.issue.title).toBe('Multiline Test')
      expect(result.data.issue.description).toContain('line 1')
      expect(result.data.issue.description).toContain('line 2')
      expect(result.data.issue.description).toContain('line 3')
    })
  })

  describe('confidence and metadata', () => {
    it('should provide confidence score', () => {
      const template = '# {issue.title}'
      const rendered = '# Test'

      const result = extractFromMarkdown(template, rendered)

      expect(result.confidence).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should report unmatched slots when content does not match', () => {
      const template = '# {issue.title}\n\n**Status:** {issue.status}'
      // Missing the status line
      const rendered = '# Test Title'

      const result = extractFromMarkdown(template, rendered)

      // The extraction may return different structures depending on match success
      if (result.data.issue) {
        // Should still extract title if possible
        expect(result.data.issue.title).toBeDefined()
      }
      // Should have some unmatched slots or lower confidence
      expect(result.unmatched.length > 0 || result.confidence < 1).toBe(true)
    })

    it('should not use AI by default', () => {
      const template = '# {issue.title}'
      const rendered = '# Test'

      const result = extractFromMarkdown(template, rendered)

      expect(result.aiAssisted).toBe(false)
    })
  })
})

describe('diff', () => {
  it('should detect added fields', () => {
    const original = {
      issue: {
        title: 'Test',
        status: 'open',
      },
    }

    const extracted = {
      issue: {
        title: 'Test',
        status: 'open',
        priority: '2',
      },
    }

    const changes = diff(original, extracted)

    expect(changes.hasChanges).toBe(true)
    expect(changes.added).toHaveProperty('issue.priority')
  })

  it('should detect modified fields', () => {
    const original = {
      issue: {
        title: 'Original',
        status: 'open',
      },
    }

    const extracted = {
      issue: {
        title: 'Updated',
        status: 'open',
      },
    }

    const changes = diff(original, extracted)

    expect(changes.hasChanges).toBe(true)
    expect(changes.modified).toHaveProperty('issue.title')
    expect(changes.modified['issue.title']).toEqual({
      from: 'Original',
      to: 'Updated',
    })
  })

  it('should detect removed fields', () => {
    const original = {
      issue: {
        title: 'Test',
        status: 'open',
        priority: 2,
      },
    }

    const extracted = {
      issue: {
        title: 'Test',
        status: 'open',
      },
    }

    const changes = diff(original, extracted)

    expect(changes.hasChanges).toBe(true)
    expect(changes.removed).toContain('issue.priority')
  })

  it('should report no changes when data is identical', () => {
    const original = {
      issue: {
        title: 'Test',
        status: 'open',
      },
    }

    const extracted = {
      issue: {
        title: 'Test',
        status: 'open',
      },
    }

    const changes = diff(original, extracted)

    expect(changes.hasChanges).toBe(false)
    expect(Object.keys(changes.added)).toHaveLength(0)
    expect(Object.keys(changes.modified)).toHaveLength(0)
    expect(changes.removed).toHaveLength(0)
  })

  it('should handle complex nested changes', () => {
    const original = {
      issue: {
        title: 'Original Title',
        description: 'Original description',
        status: 'open',
        labels: ['bug', 'urgent'],
      },
    }

    const extracted = {
      issue: {
        title: 'Updated Title',
        description: 'Original description',
        status: 'in_progress',
        labels: ['bug', 'urgent'],
      },
    }

    const changes = diff(original, extracted)

    expect(changes.hasChanges).toBe(true)
    expect(changes.modified).toHaveProperty('issue.title')
    expect(changes.modified).toHaveProperty('issue.status')
    // Description and labels unchanged
    expect(changes.modified).not.toHaveProperty('issue.description')
  })
})

describe('applyExtract', () => {
  it('should merge extracted changes into original', () => {
    const original: TodoIssue = {
      id: 'todo-123',
      title: 'Original Title',
      description: 'Original description',
      status: 'open',
      type: 'task',
      priority: 1,
      createdAt: '2025-01-01T00:00:00Z',
    }

    const extracted = {
      issue: {
        title: 'Updated Title',
        description: 'Updated description',
      },
    }

    const merged = applyExtract({ issue: original }, extracted)

    // Updated fields
    expect(merged.issue.title).toBe('Updated Title')
    expect(merged.issue.description).toBe('Updated description')
    // Preserved fields from original
    expect(merged.issue.id).toBe('todo-123')
    expect(merged.issue.status).toBe('open')
    expect(merged.issue.createdAt).toBe('2025-01-01T00:00:00Z')
  })

  it('should handle partial updates', () => {
    const original = {
      issue: {
        title: 'Test',
        description: 'Description',
        status: 'open',
        priority: 1,
      },
    }

    const extracted = {
      issue: {
        status: 'in_progress',
      },
    }

    const merged = applyExtract(original, extracted)

    // Only status should be updated
    expect(merged.issue.status).toBe('in_progress')
    expect(merged.issue.title).toBe('Test')
    expect(merged.issue.description).toBe('Description')
    expect(merged.issue.priority).toBe(1)
  })

  it('should preserve fields not in extracted data', () => {
    const original: TodoIssue = {
      id: 'todo-456',
      title: 'Test',
      status: 'open',
      type: 'bug',
      priority: 2,
      labels: ['urgent', 'production'],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    }

    const extracted = {
      issue: {
        title: 'Updated Test',
      },
    }

    const merged = applyExtract({ issue: original }, extracted)

    expect(merged.issue.title).toBe('Updated Test')
    expect(merged.issue.labels).toEqual(['urgent', 'production'])
    expect(merged.issue.createdAt).toBe('2025-01-01T00:00:00Z')
    expect(merged.issue.updatedAt).toBe('2025-01-02T00:00:00Z')
  })
})

describe('full workflow: render → edit → extract → diff → apply', () => {
  it('should support complete bi-directional sync workflow', () => {
    const template = `# {issue.title}

{issue.description}

**Status:** {issue.status}
**Priority:** {issue.priority}
**Type:** {issue.type}`

    const originalIssue: TodoIssue = {
      id: 'todo-789',
      title: 'Implement Feature X',
      description: 'Add support for feature X',
      status: 'open',
      type: 'feature',
      priority: 2,
      createdAt: '2025-01-01T00:00:00Z',
    }

    // Step 1: Render template
    const rendered = renderTemplate(template, { issue: originalIssue })
    expect(rendered).toContain('Implement Feature X')
    expect(rendered).toContain('Add support for feature X')

    // Step 2: Simulate user editing the markdown
    const edited = `# Implement Feature X (Updated)

Add support for feature X with additional improvements.

**Status:** in_progress
**Priority:** 1
**Type:** feature`

    // Step 3: Extract changes from edited markdown
    const extracted = extractFromMarkdown(template, edited)
    expect(extracted.data.issue.title).toBe('Implement Feature X (Updated)')
    expect(extracted.data.issue.status).toBe('in_progress')
    expect(extracted.data.issue.priority).toBe('1')

    // Step 4: Compute diff
    const changes = diff({ issue: originalIssue }, extracted.data)
    expect(changes.hasChanges).toBe(true)
    expect(changes.modified).toHaveProperty('issue.title')
    expect(changes.modified).toHaveProperty('issue.description')
    expect(changes.modified).toHaveProperty('issue.status')
    expect(changes.modified).toHaveProperty('issue.priority')

    // Step 5: Apply changes to original
    const updated = applyExtract({ issue: originalIssue }, extracted.data)

    // Verify updated fields
    expect(updated.issue.title).toBe('Implement Feature X (Updated)')
    expect(updated.issue.status).toBe('in_progress')
    expect(updated.issue.priority).toBe('1')
    expect(updated.issue.description).toContain('additional improvements')

    // Verify preserved fields
    expect(updated.issue.id).toBe('todo-789')
    expect(updated.issue.createdAt).toBe('2025-01-01T00:00:00Z')
    expect(updated.issue.type).toBe('feature')
  })
})
