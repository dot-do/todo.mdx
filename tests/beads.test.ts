import { describe, it, expect, vi } from 'vitest'
import { loadBeadsIssues, hasBeadsDirectory } from '../src/beads.js'

describe('beads integration', () => {
  describe('loadBeadsIssues', () => {
    it('returns empty array when no .beads directory found', async () => {
      const issues = await loadBeadsIssues('/tmp/nonexistent-path-' + Date.now())
      expect(issues).toEqual([])
    })

    it('loads issues from .beads directory when it exists', async () => {
      // Use the actual project directory which has .beads
      const issues = await loadBeadsIssues('/Users/nathanclevenger/projects/todo.mdx')
      
      // Should return an array (may be empty or contain issues)
      expect(Array.isArray(issues)).toBe(true)
      
      // If issues exist, verify structure
      if (issues.length > 0) {
        const issue = issues[0]
        expect(issue).toHaveProperty('id')
        expect(issue).toHaveProperty('title')
        expect(issue).toHaveProperty('status')
        expect(issue).toHaveProperty('type')
        expect(issue).toHaveProperty('priority')
        expect(issue).toHaveProperty('createdAt')
        expect(issue).toHaveProperty('updatedAt')
        expect(issue.source).toBe('beads')
        
        // Dates should be ISO strings
        expect(typeof issue.createdAt).toBe('string')
        expect(typeof issue.updatedAt).toBe('string')
      }
    })

    it('handles errors gracefully', async () => {
      // Even with invalid path, should not throw
      await expect(loadBeadsIssues()).resolves.toBeDefined()
    })
  })

  describe('hasBeadsDirectory', () => {
    it('returns false when .beads directory does not exist', async () => {
      const result = await hasBeadsDirectory('/tmp/nonexistent-path-' + Date.now())
      expect(result).toBe(false)
    })

    it('returns true when .beads directory exists', async () => {
      const result = await hasBeadsDirectory('/Users/nathanclevenger/projects/todo.mdx')
      expect(result).toBe(true)
    })
  })
})
