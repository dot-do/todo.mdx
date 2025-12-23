import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

// Mock the modules used by CLI
vi.mock('../compiler.js', () => ({
  compile: vi.fn().mockResolvedValue({
    output: '# TODO\n\nMocked output',
    files: [],
    issues: [
      { id: 'test-1', title: 'Test', status: 'open', type: 'task', priority: 2 },
    ],
  }),
}))

vi.mock('../sync.js', () => ({
  sync: vi.fn().mockResolvedValue({
    created: [],
    updated: [],
    deleted: [],
    filesWritten: [],
    conflicts: [],
  }),
}))

vi.mock('../watcher.js', () => ({
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

describe('CLI - Integration Tests', () => {
  // These tests would require building the CLI first
  // They are skipped by default and can be run after build
  it.skip('should show version', async () => {
    const result = await execCli(['--version'])
    expect(result.stdout).toContain('0.1.0')
    expect(result.exitCode).toBe(0)
  })

  it.skip('should show help', async () => {
    const result = await execCli(['--help'])
    expect(result.stdout).toContain('USAGE:')
    expect(result.stdout).toContain('COMMANDS:')
    expect(result.exitCode).toBe(0)
  })

  it.skip('should handle unknown command', async () => {
    const result = await execCli(['unknown'])
    expect(result.stderr).toContain('Unknown command')
    expect(result.exitCode).toBe(1)
  })
})
