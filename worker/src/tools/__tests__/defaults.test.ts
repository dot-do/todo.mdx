import { describe, it, expect } from 'vitest'
import { Browser } from '../defaults/browser'
import { Code } from '../defaults/code'
import { Search } from '../defaults/search'
import { File } from '../defaults/file'
import type { Connection } from '../types'

// Mock connection for default tools (no authentication needed)
const mockConnection: Connection = {
  id: 'default',
  user: 'system',
  app: 'Default',
  provider: 'native',
  externalId: 'default',
  externalRef: {},
  status: 'active',
  scopes: []
}

describe('default tools', () => {
  describe('Browser integration', () => {
    it('has correct name', () => {
      expect(Browser.name).toBe('Browser')
    })

    it('has fetchPage tool', () => {
      const tool = Browser.tools.find(t => t.name === 'fetchPage')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('browser.fetchPage')
    })

    it('has screenshot tool', () => {
      const tool = Browser.tools.find(t => t.name === 'screenshot')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('browser.screenshot')
    })

    describe('fetchPage', () => {
      const tool = Browser.tools.find(t => t.name === 'fetchPage')!

      it('validates url parameter', () => {
        const result = tool.schema.safeParse({ url: 'https://example.com' })
        expect(result.success).toBe(true)
      })

      it('rejects invalid urls', () => {
        const result = tool.schema.safeParse({ url: 'not-a-url' })
        expect(result.success).toBe(false)
      })

      it('accepts optional waitForSelector', () => {
        const result = tool.schema.safeParse({
          url: 'https://example.com',
          waitForSelector: '.content'
        })
        expect(result.success).toBe(true)
      })

      it('fetches a page and returns html, text, title', async () => {
        const result = await tool.execute(
          { url: 'https://example.com' },
          mockConnection
        )

        expect(result).toHaveProperty('html')
        expect(result).toHaveProperty('text')
        expect(result).toHaveProperty('title')
        expect(typeof result.html).toBe('string')
        expect(typeof result.text).toBe('string')
      })
    })

    describe('screenshot', () => {
      const tool = Browser.tools.find(t => t.name === 'screenshot')!

      it('validates url parameter', () => {
        const result = tool.schema.safeParse({ url: 'https://example.com' })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { url: 'https://example.com' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })
  })

  describe('Code integration', () => {
    it('has correct name', () => {
      expect(Code.name).toBe('Code')
    })

    it('has execute tool', () => {
      const tool = Code.tools.find(t => t.name === 'execute')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('code.execute')
    })

    it('has installPackage tool', () => {
      const tool = Code.tools.find(t => t.name === 'installPackage')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('code.installPackage')
    })

    describe('execute', () => {
      const tool = Code.tools.find(t => t.name === 'execute')!

      it('validates code parameter', () => {
        const result = tool.schema.safeParse({ code: 'console.log("test")' })
        expect(result.success).toBe(true)
      })

      it('accepts language parameter', () => {
        const result = tool.schema.safeParse({
          code: 'print("test")',
          language: 'python'
        })
        expect(result.success).toBe(true)
      })

      it('executes JavaScript code in sandbox', async () => {
        const result = await tool.execute(
          { code: '1 + 1' },
          mockConnection
        )

        expect(result).toHaveProperty('output')
      })
    })

    describe('installPackage', () => {
      const tool = Code.tools.find(t => t.name === 'installPackage')!

      it('validates package parameter', () => {
        const result = tool.schema.safeParse({ package: 'lodash' })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { package: 'lodash' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })
  })

  describe('Search integration', () => {
    it('has correct name', () => {
      expect(Search.name).toBe('Search')
    })

    it('has web tool', () => {
      const tool = Search.tools.find(t => t.name === 'web')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('search.web')
    })

    it('has images tool', () => {
      const tool = Search.tools.find(t => t.name === 'images')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('search.images')
    })

    describe('web', () => {
      const tool = Search.tools.find(t => t.name === 'web')!

      it('validates query parameter', () => {
        const result = tool.schema.safeParse({ query: 'test search' })
        expect(result.success).toBe(true)
      })

      it('accepts limit parameter', () => {
        const result = tool.schema.safeParse({ query: 'test', limit: 5 })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { query: 'test' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })

    describe('images', () => {
      const tool = Search.tools.find(t => t.name === 'images')!

      it('validates query parameter', () => {
        const result = tool.schema.safeParse({ query: 'cats' })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { query: 'cats' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })
  })

  describe('File integration', () => {
    it('has correct name', () => {
      expect(File.name).toBe('File')
    })

    it('has read tool', () => {
      const tool = File.tools.find(t => t.name === 'read')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('file.read')
    })

    it('has write tool', () => {
      const tool = File.tools.find(t => t.name === 'write')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('file.write')
    })

    it('has list tool', () => {
      const tool = File.tools.find(t => t.name === 'list')
      expect(tool).toBeDefined()
      expect(tool?.fullName).toBe('file.list')
    })

    describe('read', () => {
      const tool = File.tools.find(t => t.name === 'read')!

      it('validates path parameter', () => {
        const result = tool.schema.safeParse({ path: '/tmp/test.txt' })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { path: '/tmp/test.txt' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })

    describe('write', () => {
      const tool = File.tools.find(t => t.name === 'write')!

      it('validates path and content parameters', () => {
        const result = tool.schema.safeParse({
          path: '/tmp/test.txt',
          content: 'hello'
        })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { path: '/tmp/test.txt', content: 'test' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })

    describe('list', () => {
      const tool = File.tools.find(t => t.name === 'list')!

      it('validates path parameter', () => {
        const result = tool.schema.safeParse({ path: '/tmp' })
        expect(result.success).toBe(true)
      })

      it('returns not implemented message', async () => {
        const result = await tool.execute(
          { path: '/tmp' },
          mockConnection
        )

        expect(result).toHaveProperty('error')
        expect(result.error).toContain('Not implemented')
      })
    })
  })
})
