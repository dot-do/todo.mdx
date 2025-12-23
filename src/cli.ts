#!/usr/bin/env node
/**
 * CLI for todo.mdx
 * Simple command-line interface without external dependencies
 */

import { parseArgs } from 'node:util'
import { promises as fs } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { compile } from './compiler.js'
import { sync } from './sync.js'
import type { SyncOptions } from './sync.js'

const VERSION = '0.1.0'

const HELP_TEXT = `
todo.mdx - Bi-directional sync between TODO.mdx, .todo/*.md files, and beads

USAGE:
  todo.mdx <command> [options]

COMMANDS:
  build                Compile to TODO.md
  sync                 Run bi-directional sync
  watch                Watch mode for live sync
  init                 Initialize TODO.mdx in project
  help                 Show this help message
  version              Show version

OPTIONS:
  --help               Show help for command
  --version            Show version
  --output <path>      Custom output path (build command)
  --dry-run            Preview changes without applying (sync command)
  --direction <dir>    Sync direction: beads-to-files, files-to-beads, bidirectional (sync command)

EXAMPLES:
  todo.mdx build
  todo.mdx build --output ./docs/TODO.md
  todo.mdx sync
  todo.mdx sync --dry-run
  todo.mdx sync --direction beads-to-files
  todo.mdx watch
  todo.mdx init
`

/**
 * Print message with icon prefix
 */
function log(icon: string, message: string): void {
  console.log(`${icon} ${message}`)
}

/**
 * Print error and exit
 */
function error(message: string): never {
  console.error(`✗ Error: ${message}`)
  process.exit(1)
}

/**
 * Validate output path to prevent path traversal attacks
 * Ensures the resolved path is within the current working directory
 */
function validateOutputPath(outputPath: string): string {
  const cwd = process.cwd()
  const resolvedPath = resolve(cwd, outputPath)
  const resolvedCwd = resolve(cwd)

  // Check if resolved path is within the project directory
  // Must start with cwd + path separator or be exactly the cwd
  if (!resolvedPath.startsWith(resolvedCwd + sep) && resolvedPath !== resolvedCwd) {
    error(
      `Output path must be within the project directory. ` +
      `Path '${outputPath}' resolves to '${resolvedPath}' which is outside '${resolvedCwd}'`
    )
  }

  return resolvedPath
}

/**
 * Build command: compile to TODO.md
 */
async function buildCommand(args: { values: Record<string, unknown> }): Promise<void> {
  const outputPath = (args.values.output as string) || 'TODO.md'

  // Validate output path to prevent path traversal
  const validatedPath = validateOutputPath(outputPath)

  try {
    log('→', 'Compiling TODO.md...')
    const result = await compile()

    await fs.writeFile(validatedPath, result.output, 'utf-8')

    log('✓', `Compiled ${result.issues.length} issues to ${outputPath}`)
    log('✓', `  - In Progress: ${result.issues.filter(i => i.status === 'in_progress').length}`)
    log('✓', `  - Open: ${result.issues.filter(i => i.status === 'open').length}`)
    log('✓', `  - Closed: ${result.issues.filter(i => i.status === 'closed').length}`)
  } catch (err) {
    error(`Failed to compile: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Sync command: bi-directional sync
 */
async function syncCommand(args: { values: Record<string, unknown> }): Promise<void> {
  const dryRun = Boolean(args.values['dry-run'])
  const direction = (args.values.direction as SyncOptions['direction']) || 'bidirectional'

  // Validate direction
  const validDirections = ['beads-to-files', 'files-to-beads', 'bidirectional']
  if (!validDirections.includes(direction)) {
    error(`Invalid direction: ${direction}. Must be one of: ${validDirections.join(', ')}`)
  }

  try {
    log('→', `Syncing (${direction})${dryRun ? ' [dry-run]' : ''}...`)

    const result = await sync({ dryRun, direction })

    // Print summary
    if (dryRun) {
      log('→', 'Changes that would be made:')
    } else {
      log('✓', 'Sync complete:')
    }

    if (result.created.length > 0) {
      log('✓', `  Created: ${result.created.length} issues`)
      result.created.forEach(id => log('  ', `    - ${id}`))
    }

    if (result.updated.length > 0) {
      log('✓', `  Updated: ${result.updated.length} issues`)
      result.updated.forEach(id => log('  ', `    - ${id}`))
    }

    if (result.filesWritten.length > 0) {
      log('✓', `  Files written: ${result.filesWritten.length}`)
      result.filesWritten.forEach(path => log('  ', `    - ${path}`))
    }

    if (result.conflicts.length > 0) {
      log('→', `  Conflicts: ${result.conflicts.length}`)
      result.conflicts.forEach(conflict => {
        log('  ', `    - ${conflict.issueId}: ${conflict.field} (${conflict.resolution})`)
      })
    }

    if (
      result.created.length === 0 &&
      result.updated.length === 0 &&
      result.filesWritten.length === 0 &&
      result.conflicts.length === 0
    ) {
      log('✓', '  No changes needed')
    }
  } catch (err) {
    error(`Failed to sync: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Watch command: watch mode for live sync
 */
async function watchCommand(): Promise<void> {
  try {
    // Try to dynamically import watcher (may not exist yet)
    const { watch } = await import('./watcher.js')

    log('→', 'Starting watch mode...')
    log('→', 'Watching .beads/ and .todo/ for changes')
    log('→', 'Press Ctrl+C to stop')

    const watcher = await watch({
      onChange: (event) => {
        if (event.type === 'file-change') {
          log('→', `File changed: ${event.path}`)
        } else if (event.type === 'beads-change') {
          log('→', `Beads changed: ${event.issueId || 'unknown'}`)
        }
      },
    })

    log('✓', 'Watcher started')

    // Keep process alive until interrupted
    process.on('SIGINT', async () => {
      log('→', 'Stopping watcher...')
      await watcher.close()
      log('✓', 'Watcher stopped')
      process.exit(0)
    })
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ERR_MODULE_NOT_FOUND') {
      error('Watch mode not yet implemented. Run `todo.mdx sync` manually for now.')
    }
    error(`Failed to start watch mode: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Init command: initialize TODO.mdx in project
 */
async function initCommand(): Promise<void> {
  try {
    log('→', 'Initializing todo.mdx...')

    // Create .todo directory
    const todoDir = '.todo'
    await fs.mkdir(todoDir, { recursive: true })
    log('✓', `Created ${todoDir}/ directory`)

    // Create TODO.mdx template if it doesn't exist
    const todoMdxPath = 'TODO.mdx'
    try {
      await fs.access(todoMdxPath)
      log('→', `${todoMdxPath} already exists, skipping`)
    } catch {
      const template = `# TODO

This file is auto-generated from .todo/*.md files and beads.

Run \`todo.mdx build\` to regenerate this file.
`
      await fs.writeFile(todoMdxPath, template, 'utf-8')
      log('✓', `Created ${todoMdxPath}`)
    }

    // Create .gitignore entry for TODO.md if not exists
    try {
      const gitignorePath = '.gitignore'
      let gitignore = ''
      try {
        gitignore = await fs.readFile(gitignorePath, 'utf-8')
      } catch {
        // File doesn't exist yet
      }

      if (!gitignore.includes('TODO.md')) {
        const entry = '\n# todo.mdx generated file\nTODO.md\n'
        await fs.appendFile(gitignorePath, entry, 'utf-8')
        log('✓', 'Added TODO.md to .gitignore')
      } else {
        log('→', 'TODO.md already in .gitignore')
      }
    } catch (err) {
      log('→', 'Could not update .gitignore (optional)')
    }

    log('✓', 'Initialization complete!')
    log('→', 'Next steps:')
    log('  ', '  1. Create .todo/*.md files for your issues')
    log('  ', '  2. Run `todo.mdx sync` to sync with beads')
    log('  ', '  3. Run `todo.mdx build` to generate TODO.md')
  } catch (err) {
    error(`Failed to initialize: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      output: { type: 'string', short: 'o' },
      'dry-run': { type: 'boolean' },
      direction: { type: 'string' },
    },
    allowPositionals: true,
  })

  // Handle global flags
  if (args.values.version) {
    console.log(`todo.mdx v${VERSION}`)
    process.exit(0)
  }

  if (args.values.help && args.positionals.length === 0) {
    console.log(HELP_TEXT)
    process.exit(0)
  }

  // Get command
  const command = args.positionals[0]

  if (!command) {
    console.log(HELP_TEXT)
    process.exit(1)
  }

  // Route to command handlers
  switch (command) {
    case 'build':
      await buildCommand(args)
      break

    case 'sync':
      await syncCommand(args)
      break

    case 'watch':
      await watchCommand()
      break

    case 'init':
      await initCommand()
      break

    case 'help':
      console.log(HELP_TEXT)
      break

    case 'version':
      console.log(`todo.mdx v${VERSION}`)
      break

    default:
      error(`Unknown command: ${command}\n${HELP_TEXT}`)
  }
}

// Run CLI
main().catch((err) => {
  error(err instanceof Error ? err.message : String(err))
})
