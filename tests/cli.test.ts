import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join, resolve, sep } from 'node:path'

// Mock the modules used by CLI
vi.mock('../src/compiler.js', () => ({
  compile: vi.fn().mockResolvedValue({
    output: '# TODO\n\nMocked output',
    files: [],
    issues: [
      { id: 'test-1', title: 'Test', status: 'open', type: 'task', priority: 2 },
    ],
  }),
}))

vi.mock('../src/sync.js', () => ({
  sync: vi.fn().mockResolvedValue({
    created: [],
    updated: [],
    deleted: [],
    filesWritten: [],
    conflicts: [],
  }),
}))

vi.mock('../src/watcher.js', () => ({
  watch: vi.fn().mockResolvedValue(undefined),
}))

/**
 * Helper to execute CLI command
 * Returns { exitCode, stdout, stderr }
 */
async function execCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cliPath = join(process.cwd(), 'dist/cli.js')
    const proc = spawn('node', [cliPath, ...args], {
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      })
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

describe('CLI - Command Parsing', () => {
  it('should show help when no command given', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: [],
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toHaveLength(0)
  })

  it('should parse build command', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['build'],
      options: {
        output: { type: 'string', short: 'o' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toContain('build')
  })

  it('should parse build command with output flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['build', '--output', './docs/TODO.md'],
      options: {
        output: { type: 'string', short: 'o' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toContain('build')
    expect(result.values.output).toBe('./docs/TODO.md')
  })

  it('should parse sync command', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['sync'],
      options: {
        'dry-run': { type: 'boolean' },
        direction: { type: 'string' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toContain('sync')
  })

  it('should parse sync command with dry-run flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['sync', '--dry-run'],
      options: {
        'dry-run': { type: 'boolean' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toContain('sync')
    expect(result.values['dry-run']).toBe(true)
  })

  it('should parse sync command with direction flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['sync', '--direction', 'beads-to-files'],
      options: {
        direction: { type: 'string' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toContain('sync')
    expect(result.values.direction).toBe('beads-to-files')
  })

  it('should parse watch command', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['watch'],
      options: {},
      allowPositionals: true,
    })

    expect(result.positionals).toContain('watch')
  })

  it('should parse init command', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['init'],
      options: {},
      allowPositionals: true,
    })

    expect(result.positionals).toContain('init')
  })

  it('should parse help flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['--help'],
      options: {
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
    })

    expect(result.values.help).toBe(true)
  })

  it('should parse version flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['--version'],
      options: {
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    expect(result.values.version).toBe(true)
  })

  it('should parse short help flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['-h'],
      options: {
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: true,
    })

    expect(result.values.help).toBe(true)
  })

  it('should parse short version flag', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['-v'],
      options: {
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })

    expect(result.values.version).toBe(true)
  })
})

describe('CLI - Command Validation', () => {
  it('should validate sync direction values', () => {
    const validDirections = ['beads-to-files', 'files-to-beads', 'bidirectional']

    const testDirection = 'beads-to-files'
    expect(validDirections.includes(testDirection)).toBe(true)

    const invalidDirection = 'invalid'
    expect(validDirections.includes(invalidDirection)).toBe(false)
  })

  it('should handle multiple flags together', () => {
    const { parseArgs } = require('node:util')

    const result = parseArgs({
      args: ['sync', '--dry-run', '--direction', 'beads-to-files'],
      options: {
        'dry-run': { type: 'boolean' },
        direction: { type: 'string' },
      },
      allowPositionals: true,
    })

    expect(result.positionals).toContain('sync')
    expect(result.values['dry-run']).toBe(true)
    expect(result.values.direction).toBe('beads-to-files')
  })
})

describe('CLI - Path Validation (Security)', () => {
  // Helper function to test path validation logic (mirrors the implementation)
  const validateOutputPath = (outputPath: string, cwd: string): string => {
    const resolvedPath = resolve(cwd, outputPath)
    const resolvedCwd = resolve(cwd)

    // Check if resolved path is within the project directory
    // Must start with cwd + path separator or be exactly the cwd
    if (!resolvedPath.startsWith(resolvedCwd + sep) && resolvedPath !== resolvedCwd) {
      throw new Error(
        `Output path must be within the project directory. ` +
        `Path '${outputPath}' resolves to '${resolvedPath}' which is outside '${resolvedCwd}'`
      )
    }

    return resolvedPath
  }

  it('should reject path traversal with .. in --output', () => {
    const cwd = process.cwd()
    const maliciousPath = '../../etc/passwd'

    // This should throw because it escapes the project directory
    expect(() => {
      validateOutputPath(maliciousPath, cwd)
    }).toThrow(/Output path must be within the project directory/)
  })

  it('should reject absolute path outside project directory', () => {
    const cwd = process.cwd()
    const maliciousPath = '/etc/passwd'

    // This should throw because it's an absolute path outside project
    expect(() => {
      validateOutputPath(maliciousPath, cwd)
    }).toThrow(/Output path must be within the project directory/)
  })

  it('should allow valid subdirectory within project', () => {
    const cwd = process.cwd()
    const validPath = 'docs/TODO.md'

    // This should NOT throw - it's within the project
    expect(() => {
      validateOutputPath(validPath, cwd)
    }).not.toThrow()
  })

  it('should allow path in current directory', () => {
    const cwd = process.cwd()
    const validPath = 'TODO.md'

    // This should NOT throw - it's in the project root
    expect(() => {
      validateOutputPath(validPath, cwd)
    }).not.toThrow()
  })

  it('should reject path with .. that escapes project', () => {
    const cwd = process.cwd()
    const suspiciousPath = 'docs/../../etc/passwd'

    // After resolution, this escapes the project directory
    expect(() => {
      validateOutputPath(suspiciousPath, cwd)
    }).toThrow(/Output path must be within the project directory/)
  })

  it('should include helpful error message with actual paths', () => {
    const cwd = process.cwd()
    const maliciousPath = '../../etc/passwd'

    try {
      validateOutputPath(maliciousPath, cwd)
      // Should not reach here
      expect(true).toBe(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      expect(message).toContain('Output path must be within the project directory')
      expect(message).toContain(maliciousPath)
      expect(message).toContain('resolves to')
      expect(message).toContain('outside')
    }
  })
})

describe('CLI - Integration Tests', () => {
  // These tests require building the CLI first
  // Run 'pnpm build' before running these tests
  it('should show version', async () => {
    const result = await execCli(['--version'])
    expect(result.stdout).toContain('0.1.0')
    expect(result.exitCode).toBe(0)
  })

  it('should show help', async () => {
    const result = await execCli(['--help'])
    expect(result.stdout).toContain('USAGE:')
    expect(result.stdout).toContain('COMMANDS:')
    expect(result.exitCode).toBe(0)
  })

  it('should handle unknown command', async () => {
    const result = await execCli(['unknown'])
    expect(result.stderr).toContain('Unknown command')
    expect(result.exitCode).toBe(1)
  })

  it('should show help when no command provided', async () => {
    const result = await execCli([])
    expect(result.stdout).toContain('USAGE:')
    expect(result.stdout).toContain('COMMANDS:')
    expect(result.exitCode).toBe(1)
  })

  it('should handle build command', async () => {
    const result = await execCli(['build'])
    expect(result.stdout).toContain('Compiling TODO.md')
    expect(result.stdout).toContain('Compiled')
    expect(result.stdout).toContain('issues')
    expect(result.exitCode).toBe(0)
  })

  it('should handle build command with output flag', async () => {
    const result = await execCli(['build', '--output', 'test-output.md'])
    expect(result.stdout).toContain('Compiling test-output.md')
    expect(result.stdout).toContain('Compiled')
    expect(result.exitCode).toBe(0)
  })

  it('should show issue counts in build output', async () => {
    const result = await execCli(['build'])
    expect(result.stdout).toContain('In Progress:')
    expect(result.stdout).toContain('Open:')
    expect(result.stdout).toContain('Closed:')
    expect(result.exitCode).toBe(0)
  })

  it('should reject path traversal in build output', async () => {
    const result = await execCli(['build', '--output', '../../etc/passwd'])
    expect(result.stderr).toContain('Output path must be within the project directory')
    expect(result.exitCode).toBe(1)
  })

  it('should handle sync command', async () => {
    const result = await execCli(['sync'])
    expect(result.stdout).toContain('Syncing')
    expect(result.stdout).toContain('bidirectional')
    expect(result.exitCode).toBe(0)
  })

  it('should handle sync command with dry-run flag', async () => {
    const result = await execCli(['sync', '--dry-run'])
    expect(result.stdout).toContain('dry-run')
    expect(result.stdout).toContain('Syncing')
    expect(result.exitCode).toBe(0)
  })

  it('should handle sync command with direction flag', async () => {
    const result = await execCli(['sync', '--direction', 'beads-to-files'])
    expect(result.stdout).toContain('beads-to-files')
    expect(result.stdout).toContain('Syncing')
    expect(result.exitCode).toBe(0)
  })

  it('should handle sync with files-to-beads direction', async () => {
    const result = await execCli(['sync', '--direction', 'files-to-beads'])
    expect(result.stdout).toContain('files-to-beads')
    expect(result.exitCode).toBe(0)
  })

  it('should handle sync with multiple flags', async () => {
    const result = await execCli(['sync', '--dry-run', '--direction', 'beads-to-files'])
    expect(result.stdout).toContain('dry-run')
    expect(result.stdout).toContain('beads-to-files')
    expect(result.exitCode).toBe(0)
  })

  it('should reject invalid sync direction', async () => {
    const result = await execCli(['sync', '--direction', 'invalid-direction'])
    expect(result.stderr).toContain('Invalid direction')
    expect(result.exitCode).toBe(1)
  })

  it('should handle init command', async () => {
    const result = await execCli(['init'])
    expect(result.stdout).toContain('Initializing todo.mdx')
    expect(result.exitCode).toBe(0)
  })

  it('should handle help command', async () => {
    const result = await execCli(['help'])
    expect(result.stdout).toContain('USAGE:')
    expect(result.stdout).toContain('COMMANDS:')
    expect(result.exitCode).toBe(0)
  })

  it('should handle version command', async () => {
    const result = await execCli(['version'])
    expect(result.stdout).toContain('0.1.0')
    expect(result.exitCode).toBe(0)
  })

  it('should handle -h flag', async () => {
    const result = await execCli(['-h'])
    expect(result.stdout).toContain('USAGE:')
    expect(result.exitCode).toBe(0)
  })

  it('should handle -v flag', async () => {
    const result = await execCli(['-v'])
    expect(result.stdout).toContain('0.1.0')
    expect(result.exitCode).toBe(0)
  })
})
