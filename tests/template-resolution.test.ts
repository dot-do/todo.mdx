import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplate } from '../src/templates.js'
import type { TemplateConfig } from '../src/templates.js'

describe('template resolution chain', () => {
  const testDir = join(process.cwd(), '.test-templates')
  const mdxDir = join(testDir, '.mdx')
  const presetsDir = join(mdxDir, 'presets')

  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(presetsDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('issue template resolution', () => {
    it('should check .mdx/[Issue].mdx first', async () => {
      const customTemplate = '# Custom Issue Template\n\n{{issue.title}}'
      await fs.writeFile(join(mdxDir, '[Issue].mdx'), customTemplate, 'utf-8')

      const config: TemplateConfig = {
        templateDir: mdxDir,
      }

      const result = await resolveTemplate('issue', config)
      expect(result).toBe(customTemplate)
    })

    it('should fall back to .mdx/presets/{preset}.mdx if config.preset specified', async () => {
      const presetTemplate = '# Detailed Preset\n\n{{issue.description}}'
      await fs.writeFile(join(presetsDir, 'detailed.mdx'), presetTemplate, 'utf-8')

      const config: TemplateConfig = {
        templateDir: mdxDir,
        preset: 'detailed',
      }

      const result = await resolveTemplate('issue', config)
      expect(result).toBe(presetTemplate)
    })

    it('should prefer custom template over preset', async () => {
      const customTemplate = '# Custom Issue Template\n\n{{issue.title}}'
      const presetTemplate = '# Detailed Preset\n\n{{issue.description}}'

      await fs.writeFile(join(mdxDir, '[Issue].mdx'), customTemplate, 'utf-8')
      await fs.writeFile(join(presetsDir, 'detailed.mdx'), presetTemplate, 'utf-8')

      const config: TemplateConfig = {
        templateDir: mdxDir,
        preset: 'detailed',
      }

      // Custom template should win
      const result = await resolveTemplate('issue', config)
      expect(result).toBe(customTemplate)
    })

    it('should fall back to built-in minimal preset', async () => {
      const config: TemplateConfig = {
        templateDir: mdxDir,
      }

      const result = await resolveTemplate('issue', config)

      // Should return built-in minimal template (non-empty string)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain('---') // Should have frontmatter
    })

    it('should use specified preset when custom template does not exist', async () => {
      const githubTemplate = '# GitHub-style Issue\n\n## Description\n{{issue.description}}'
      await fs.writeFile(join(presetsDir, 'github.mdx'), githubTemplate, 'utf-8')

      const config: TemplateConfig = {
        templateDir: mdxDir,
        preset: 'github',
      }

      const result = await resolveTemplate('issue', config)
      expect(result).toBe(githubTemplate)
    })
  })

  describe('todo template resolution', () => {
    it('should check .mdx/TODO.mdx first', async () => {
      const customTemplate = '# My Custom TODO\n\n{{todos.length}} items'
      await fs.writeFile(join(mdxDir, 'TODO.mdx'), customTemplate, 'utf-8')

      const config: TemplateConfig = {
        templateDir: mdxDir,
      }

      const result = await resolveTemplate('todo', config)
      expect(result).toBe(customTemplate)
    })

    it('should fall back to preset if specified', async () => {
      const presetTemplate = '# Linear-style TODO\n\n{{#each todos}}{{/each}}'
      await fs.writeFile(join(presetsDir, 'linear.mdx'), presetTemplate, 'utf-8')

      const config: TemplateConfig = {
        templateDir: mdxDir,
        preset: 'linear',
      }

      const result = await resolveTemplate('todo', config)
      expect(result).toBe(presetTemplate)
    })

    it('should fall back to built-in minimal preset', async () => {
      const config: TemplateConfig = {
        templateDir: mdxDir,
      }

      const result = await resolveTemplate('todo', config)

      // Should return built-in minimal template (non-empty string)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('default configuration', () => {
    it('should use .mdx as default templateDir', async () => {
      // Create template in default location
      const defaultMdxDir = join(testDir, '.mdx')
      await fs.mkdir(defaultMdxDir, { recursive: true })

      const customTemplate = '# Default Location Template'
      await fs.writeFile(join(defaultMdxDir, '[Issue].mdx'), customTemplate, 'utf-8')

      // Change to test directory
      const originalCwd = process.cwd()
      process.chdir(testDir)

      try {
        const result = await resolveTemplate('issue')
        expect(result).toBe(customTemplate)
      } finally {
        process.chdir(originalCwd)
      }
    })

    it('should work without any config', async () => {
      const result = await resolveTemplate('issue')

      // Should return built-in template
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should handle non-existent preset gracefully', async () => {
      const config: TemplateConfig = {
        templateDir: mdxDir,
        preset: 'nonexistent',
      }

      const result = await resolveTemplate('issue', config)

      // Should fall back to built-in minimal
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle missing templateDir gracefully', async () => {
      const config: TemplateConfig = {
        templateDir: '/nonexistent/path',
      }

      const result = await resolveTemplate('issue', config)

      // Should fall back to built-in minimal
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('supported presets', () => {
    it('should support minimal preset', async () => {
      const config: TemplateConfig = {
        preset: 'minimal',
      }

      const result = await resolveTemplate('issue', config)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should support detailed preset', async () => {
      const config: TemplateConfig = {
        preset: 'detailed',
      }

      const result = await resolveTemplate('issue', config)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should support github preset', async () => {
      const config: TemplateConfig = {
        preset: 'github',
      }

      const result = await resolveTemplate('issue', config)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should support linear preset', async () => {
      const config: TemplateConfig = {
        preset: 'linear',
      }

      const result = await resolveTemplate('issue', config)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
