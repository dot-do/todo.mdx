/**
 * Tests for template presets
 */
import { describe, it, expect } from 'vitest'
import { getBuiltinPreset } from '../src/presets.js'

describe('getBuiltinPreset', () => {
  describe('minimal preset', () => {
    it('returns valid template with frontmatter', () => {
      const template = getBuiltinPreset('minimal')

      expect(template).toBeTruthy()
      expect(template).toContain('---')
      expect(template).toContain('$pattern:')
      expect(template).toContain('# {issue.title}')
      expect(template).toContain('{issue.description}')
    })

    it('has $pattern in frontmatter', () => {
      const template = getBuiltinPreset('minimal')

      // Extract frontmatter
      const frontmatterMatch = template.match(/^---\n([\s\S]*?)\n---/)
      expect(frontmatterMatch).toBeTruthy()

      const frontmatter = frontmatterMatch![1]
      expect(frontmatter).toContain('$pattern:')
    })

    it('is minimal without extra sections', () => {
      const template = getBuiltinPreset('minimal')

      // Should not have dependencies, labels, or other complex sections
      expect(template).not.toContain('dependsOn')
      expect(template).not.toContain('Related Issues')
      expect(template).not.toContain('labels')
    })
  })

  describe('detailed preset', () => {
    it('includes dependencies section', () => {
      const template = getBuiltinPreset('detailed')

      expect(template).toBeTruthy()
      expect(template).toContain('---')
      expect(template).toContain('$pattern:')

      // Should include dependency handling
      expect(template).toContain('dependsOn')
      expect(template).toContain('blocks')
    })

    it('has all metadata fields', () => {
      const template = getBuiltinPreset('detailed')

      // Should include comprehensive metadata
      expect(template).toContain('id:')
      expect(template).toContain('title:')
      expect(template).toContain('state:')
      expect(template).toContain('priority:')
      expect(template).toContain('type:')
      expect(template).toContain('labels:')
      expect(template).toContain('assignee:')
      expect(template).toContain('createdAt:')
      expect(template).toContain('updatedAt:')
    })

    it('has $pattern in frontmatter', () => {
      const template = getBuiltinPreset('detailed')

      const frontmatterMatch = template.match(/^---\n([\s\S]*?)\n---/)
      expect(frontmatterMatch).toBeTruthy()

      const frontmatter = frontmatterMatch![1]
      expect(frontmatter).toContain('$pattern:')
    })
  })

  describe('github preset', () => {
    it('has GitHub-style label badges', () => {
      const template = getBuiltinPreset('github')

      expect(template).toBeTruthy()
      expect(template).toContain('---')
      expect(template).toContain('$pattern:')

      // Should have badge-like label rendering
      expect(template).toContain('labels')
      // GitHub-style often uses inline badges or tags
      expect(template.toLowerCase()).toMatch(/badge|label|tag/)
    })

    it('has $pattern in frontmatter', () => {
      const template = getBuiltinPreset('github')

      const frontmatterMatch = template.match(/^---\n([\s\S]*?)\n---/)
      expect(frontmatterMatch).toBeTruthy()

      const frontmatter = frontmatterMatch![1]
      expect(frontmatter).toContain('$pattern:')
    })

    it('has GitHub-specific sections', () => {
      const template = getBuiltinPreset('github')

      // GitHub issues typically have these sections
      expect(template.toLowerCase()).toMatch(/comment|discussion|activity/)
    })
  })

  describe('linear preset', () => {
    it('has Linear.app style', () => {
      const template = getBuiltinPreset('linear')

      expect(template).toBeTruthy()
      expect(template).toContain('---')
      expect(template).toContain('$pattern:')
    })

    it('has $pattern in frontmatter', () => {
      const template = getBuiltinPreset('linear')

      const frontmatterMatch = template.match(/^---\n([\s\S]*?)\n---/)
      expect(frontmatterMatch).toBeTruthy()

      const frontmatter = frontmatterMatch![1]
      expect(frontmatter).toContain('$pattern:')
    })

    it('has Linear-specific placeholders for project/cycle', () => {
      const template = getBuiltinPreset('linear')

      // Linear has projects, cycles, and teams
      expect(template.toLowerCase()).toMatch(/project|cycle|team/)
    })
  })

  describe('error handling', () => {
    it('throws error for unknown preset', () => {
      expect(() => getBuiltinPreset('unknown')).toThrow()
      expect(() => getBuiltinPreset('invalid-preset')).toThrow(/unknown preset/i)
    })

    it('throws error for empty preset name', () => {
      expect(() => getBuiltinPreset('')).toThrow()
    })
  })

  describe('preset validation', () => {
    const presets = ['minimal', 'detailed', 'github', 'linear']

    presets.forEach(preset => {
      it(`${preset} preset has valid MDX structure`, () => {
        const template = getBuiltinPreset(preset)

        // Valid MDX must have frontmatter
        expect(template).toMatch(/^---\n/)
        expect(template).toMatch(/\n---\n/)

        // Should have content after frontmatter
        const parts = template.split('---')
        expect(parts.length).toBeGreaterThanOrEqual(3)
        expect(parts[2].trim()).not.toBe('')
      })

      it(`${preset} preset has title placeholder`, () => {
        const template = getBuiltinPreset(preset)

        // Should reference issue.title somehow
        expect(template).toContain('{issue.title}')
      })
    })
  })
})
