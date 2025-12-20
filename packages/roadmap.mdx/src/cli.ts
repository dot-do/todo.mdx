#!/usr/bin/env node
/**
 * roadmap.mdx CLI
 * Compile ROADMAP.mdx templates and sync milestones/projects
 */

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { compile } from './compiler.js'

const DEFAULT_TEMPLATE = `---
title: Roadmap
beads: true
filePattern: "[id]-[title].mdx"
---

# {title}

<Stats />

## Active Epics

<Epics.Active />

## Milestones

<Milestones.Open />

## Completed

<Epics status="closed" />
`

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      output: { type: 'string', short: 'o' },
      watch: { type: 'boolean', short: 'w' },
      init: { type: 'boolean' },
      quiet: { type: 'boolean', short: 'q' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
roadmap.mdx - Sync ROADMAP.mdx with GitHub Milestones, Projects, and beads epics

Usage:
  npx roadmap.mdx              Compile ROADMAP.mdx to ROADMAP.md
  npx roadmap.mdx init         Create ROADMAP.mdx template

Options:
  -o, --output <file>   Output file (default: ROADMAP.md)
  -w, --watch           Watch for changes
  -q, --quiet           Suppress output
  -h, --help            Show this help

Examples:
  npx roadmap.mdx                    # Compile ROADMAP.mdx → ROADMAP.md
  npx roadmap.mdx --watch            # Watch mode
`)
    return
  }

  const command = positionals[0]

  // Init command
  if (values.init || command === 'init') {
    if (existsSync('ROADMAP.mdx')) {
      console.log('ROADMAP.mdx already exists')
      return
    }
    await writeFile('ROADMAP.mdx', DEFAULT_TEMPLATE)
    console.log('Created ROADMAP.mdx')
    return
  }

  // Default: compile
  await runCompile(values)
}

async function runCompile(options: {
  output?: string
  watch?: boolean
  quiet?: boolean
}) {
  // Auto-init if no ROADMAP.mdx
  if (!existsSync('ROADMAP.mdx')) {
    if (!options.quiet) {
      console.log('No ROADMAP.mdx found, creating one...')
    }
    await writeFile('ROADMAP.mdx', DEFAULT_TEMPLATE)
  }

  const output = options.output || 'ROADMAP.md'

  try {
    await compile({
      input: 'ROADMAP.mdx',
      output,
    })

    if (!options.quiet) {
      console.log(`Compiled ROADMAP.mdx → ${output}`)
    }

    if (options.watch) {
      console.log('Watch mode not yet implemented')
    }
  } catch (error) {
    console.error('Compilation failed:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
