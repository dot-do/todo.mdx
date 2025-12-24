import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadBeadsIssues, hasBeadsDirectory } from '../src/beads.js'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'

describe('beads integration', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'beads-test-'))
  })

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  describe('loadBeadsIssues', () => {
    it('returns empty array when no .beads directory found', async () => {
      const issues = await loadBeadsIssues(testDir)
      expect(issues).toEqual([])
    })

    it('loads issues from .beads directory when it exists', async () => {
      // Create .beads directory with known test data
      const beadsDir = join(testDir, '.beads')
      await mkdir(beadsDir, { recursive: true })

      // Create known fixture data
      const fixtureIssues = [
        {
          id: 'test-001',
          title: 'Test issue one',
          description: 'First test issue',
          status: 'open',
          priority: 1,
          issue_type: 'task',
          created_at: '2025-01-01T10:00:00.000Z',
          updated_at: '2025-01-01T12:00:00.000Z',
          labels: ['test', 'fixture'],
        },
        {
          id: 'test-002',
          title: 'Test issue two',
          description: 'Second test issue',
          status: 'closed',
          priority: 2,
          issue_type: 'bug',
          created_at: '2025-01-02T10:00:00.000Z',
          updated_at: '2025-01-02T14:00:00.000Z',
          closed_at: '2025-01-02T14:00:00.000Z',
        },
      ]

      // Write issues as JSONL
      const jsonlContent = fixtureIssues.map((issue) => JSON.stringify(issue)).join('\n')
      await writeFile(join(beadsDir, 'issues.jsonl'), jsonlContent)

      // Load and verify
      const issues = await loadBeadsIssues(testDir)

      expect(Array.isArray(issues)).toBe(true)
      expect(issues.length).toBe(2)

      // Verify first issue structure and values
      const issue1 = issues.find((i) => i.id === 'test-001')
      expect(issue1).toBeDefined()
      expect(issue1!.title).toBe('Test issue one')
      expect(issue1!.status).toBe('open')
      expect(issue1!.type).toBe('task')
      expect(issue1!.priority).toBe(1)
      expect(issue1!.source).toBe('beads')
      expect(issue1!.createdAt).toBe('2025-01-01T10:00:00.000Z')
      expect(issue1!.updatedAt).toBe('2025-01-01T12:00:00.000Z')
      expect(issue1!.labels).toEqual(['test', 'fixture'])

      // Verify second issue
      const issue2 = issues.find((i) => i.id === 'test-002')
      expect(issue2).toBeDefined()
      expect(issue2!.title).toBe('Test issue two')
      expect(issue2!.status).toBe('closed')
      expect(issue2!.type).toBe('bug')
      expect(issue2!.closedAt).toBe('2025-01-02T14:00:00.000Z')
    })

    it('returns empty array when issues.jsonl is empty', async () => {
      // Create .beads directory with empty issues.jsonl
      const beadsDir = join(testDir, '.beads')
      await mkdir(beadsDir, { recursive: true })
      await writeFile(join(beadsDir, 'issues.jsonl'), '')

      const issues = await loadBeadsIssues(testDir)
      expect(issues).toEqual([])
    })

    it('handles errors gracefully', async () => {
      // Even with invalid path, should not throw
      await expect(loadBeadsIssues('/nonexistent/path/' + Date.now())).resolves.toBeDefined()
    })
  })

  describe('hasBeadsDirectory', () => {
    it('returns false when .beads directory does not exist', async () => {
      const result = await hasBeadsDirectory(testDir)
      expect(result).toBe(false)
    })

    it('returns true when .beads directory exists', async () => {
      // Create .beads directory
      const beadsDir = join(testDir, '.beads')
      await mkdir(beadsDir, { recursive: true })
      // Create issues.jsonl (beads looks for this file)
      await writeFile(join(beadsDir, 'issues.jsonl'), '')

      const result = await hasBeadsDirectory(testDir)
      expect(result).toBe(true)
    })
  })
})
