import { describe, it, expect } from 'vitest'
import { loadTodoFiles, parseTodoFile } from '../src/parser.js'
import { readFile } from 'fs/promises'
import { join } from 'path'

describe('loadTodoFiles integration', () => {
  it('should load files from .todo directory', async () => {
    const todoDir = join(process.cwd(), '.todo')
    const issues = await loadTodoFiles(todoDir)

    // Should load at least some issues
    expect(issues.length).toBeGreaterThan(0)

    // All should have a valid source (either 'beads' or 'file')
    for (const issue of issues) {
      expect(issue.source).toMatch(/^(beads|file)$/)
      expect(issue.id).toBeTruthy()
      expect(issue.title).toBeTruthy()
    }
  })

  it('should handle non-existent directory gracefully', async () => {
    const issues = await loadTodoFiles('/non/existent/directory')
    expect(issues).toEqual([])
  })

  it('should parse actual file from .todo correctly', async () => {
    // File is in closed/ subdirectory with new naming pattern
    const filePath = join(process.cwd(), '.todo', 'closed', '2025-12-20 Web Ide Layout File Tree  Monaco  Terminal.md')
    const content = await readFile(filePath, 'utf-8')
    const parsed = parseTodoFile(content)

    expect(parsed.issue.id).toBe('todo-01p')
    expect(parsed.issue.title).toBe('Web IDE layout: file tree + Monaco + terminal')
    expect(parsed.issue.status).toBe('closed')
    expect(parsed.issue.type).toBe('feature')
    expect(parsed.issue.labels).toContain('ide')
  })
})
