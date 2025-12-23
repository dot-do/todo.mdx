import { describe, it, expect } from 'vitest'
import { parseIssueBody } from '../src/parser'
import { defaultConventions, type GitHubConventions } from '../src/conventions'

describe('parseIssueBody', () => {
  describe('dependencies parsing', () => {
    it('should parse comma-separated dependencies', () => {
      const body = 'Depends on: #123, #456'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
      expect(result.blocks).toEqual([])
      expect(result.parent).toBeUndefined()
    })

    it('should parse dependencies in list format', () => {
      const body = `Depends on:
- #123
- #456`
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
    })

    it('should parse dependencies with full GitHub URLs', () => {
      const body = 'Depends on: https://github.com/owner/repo/issues/123, #456'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
    })

    it('should parse dependencies with mixed formats on same line', () => {
      const body = 'Depends on: #123, https://github.com/owner/repo/issues/456, #789'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456', '789'])
    })

    it('should handle custom dependency pattern', () => {
      const customConventions: GitHubConventions = {
        ...defaultConventions,
        dependencies: {
          pattern: 'Requires:\\s*(.+)',
          separator: ', ',
        },
      }
      const body = 'Requires: #123, #456'
      const result = parseIssueBody(body, customConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
    })

    it('should handle custom separator', () => {
      const customConventions: GitHubConventions = {
        ...defaultConventions,
        dependencies: {
          pattern: 'Depends on:\\s*(.+)',
          separator: ' | ',
        },
      }
      const body = 'Depends on: #123 | #456'
      const result = parseIssueBody(body, customConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
    })
  })

  describe('blocks parsing', () => {
    it('should parse blocked issues', () => {
      const body = 'Blocks: #789'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.blocks).toEqual(['789'])
      expect(result.dependsOn).toEqual([])
    })

    it('should parse multiple blocked issues', () => {
      const body = 'Blocks: #789, #999'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.blocks).toEqual(['789', '999'])
    })

    it('should parse blocks with URLs', () => {
      const body = 'Blocks: https://github.com/owner/repo/issues/789'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.blocks).toEqual(['789'])
    })
  })

  describe('parent/epic parsing', () => {
    it('should parse parent issue reference', () => {
      const body = 'Parent: #100'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.parent).toBe('100')
      expect(result.dependsOn).toEqual([])
      expect(result.blocks).toEqual([])
    })

    it('should handle custom parent pattern', () => {
      const customConventions: GitHubConventions = {
        ...defaultConventions,
        epics: {
          bodyPattern: 'Epic:\\s*#(\\d+)',
        },
      }
      const body = 'Epic: #100'
      const result = parseIssueBody(body, customConventions)
      expect(result.parent).toBe('100')
    })

    it('should parse parent with URL format', () => {
      const body = 'Parent: https://github.com/owner/repo/issues/100'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.parent).toBe('100')
    })
  })

  describe('mixed patterns', () => {
    it('should parse all patterns from same body', () => {
      const body = `# Issue Description

Some description here.

Depends on: #123, #456
Blocks: #789
Parent: #100

More content...`
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
      expect(result.blocks).toEqual(['789'])
      expect(result.parent).toBe('100')
    })

    it('should handle multiple dependency sections', () => {
      const body = `Depends on: #123, #456

Some text here.

Depends on: #789`
      const result = parseIssueBody(body, defaultConventions)
      // Should capture all unique dependencies across multiple sections
      expect(result.dependsOn).toEqual(['123', '456', '789'])
    })
  })

  describe('edge cases', () => {
    it('should handle null body', () => {
      const result = parseIssueBody(null, defaultConventions)
      expect(result.dependsOn).toEqual([])
      expect(result.blocks).toEqual([])
      expect(result.parent).toBeUndefined()
    })

    it('should handle empty body', () => {
      const result = parseIssueBody('', defaultConventions)
      expect(result.dependsOn).toEqual([])
      expect(result.blocks).toEqual([])
      expect(result.parent).toBeUndefined()
    })

    it('should handle body with no matches', () => {
      const body = 'Just a regular issue description with no special patterns.'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual([])
      expect(result.blocks).toEqual([])
      expect(result.parent).toBeUndefined()
    })

    it('should handle body with pattern-like text but not exact match', () => {
      const body = 'This depends on something but not in the right format'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual([])
    })

    it('should deduplicate issue numbers', () => {
      const body = 'Depends on: #123, #456, #123'
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
    })

    it('should handle whitespace variations', () => {
      const body = 'Depends on:    #123,    #456   '
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456'])
    })

    it('should handle line breaks in dependency section', () => {
      const body = `Depends on: #123,
#456, #789`
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456', '789'])
    })

    it('should handle only first parent if multiple found', () => {
      const body = `Parent: #100
Parent: #200`
      const result = parseIssueBody(body, defaultConventions)
      // Should only capture the first parent
      expect(result.parent).toBe('100')
    })
  })

  describe('real-world examples', () => {
    it('should parse typical GitHub issue body', () => {
      const body = `## Description
This feature adds new functionality for user authentication.

## Dependencies
Depends on: #42, #55

## Blocks
Blocks: #60

## Related Issues
Parent: #10
      `
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['42', '55'])
      expect(result.blocks).toEqual(['60'])
      expect(result.parent).toBe('10')
    })

    it('should handle markdown checklist format', () => {
      const body = `## Dependencies
- [x] #123
- [ ] #456
- [ ] https://github.com/owner/repo/issues/789

Depends on: #123, #456, #789`
      const result = parseIssueBody(body, defaultConventions)
      expect(result.dependsOn).toEqual(['123', '456', '789'])
    })
  })
})
