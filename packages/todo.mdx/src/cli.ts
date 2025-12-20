#!/usr/bin/env node
/**
 * todo.mdx CLI
 * Compile TODO.mdx templates and sync issues
 */

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { compile, generateTodoFiles } from './compiler.js'

const DEFAULT_TEMPLATE = `---
title: TODO
beads: true
filePattern: "[id]-[title].mdx"
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={10} />

## All Open Issues

<Issues.Open />

## Completed

<Issues.Closed />
`

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      output: { type: 'string', short: 'o' },
      watch: { type: 'boolean', short: 'w' },
      init: { type: 'boolean' },
      generate: { type: 'boolean', short: 'g' },
      quiet: { type: 'boolean', short: 'q' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
todo.mdx - Bidirectional sync between TODO.mdx, .todo/*.md, GitHub Issues, and beads

Usage:
  npx todo.mdx              Compile TODO.mdx to TODO.md
  npx todo.mdx init         Create TODO.mdx template
  npx todo.mdx --generate   Generate .todo/*.md files from issues

Options:
  -o, --output <file>   Output file (default: TODO.md)
  -w, --watch           Watch for changes
  -g, --generate        Generate .todo/*.md files from issues
  -q, --quiet           Suppress output
  -h, --help            Show this help

File Patterns:
  Configure in TODO.mdx frontmatter:

  filePattern: "[id]-[title].mdx"    → proj-123-my-task.md
  filePattern: "[title].mdx"         → my-task.md
  filePattern: "[type]/[id].mdx"     → bug/proj-123.md

Examples:
  npx todo.mdx                       # Compile TODO.mdx → TODO.md
  npx todo.mdx --generate            # Generate .todo/*.md files
  npx todo.mdx --watch               # Watch mode
`)
    return
  }

  const command = positionals[0]

  // Init command
  if (values.init || command === 'init') {
    if (existsSync('TODO.mdx')) {
      console.log('TODO.mdx already exists')
      return
    }
    await writeFile('TODO.mdx', DEFAULT_TEMPLATE)
    console.log('Created TODO.mdx')
    return
  }

  // Generate .todo files
  if (values.generate || command === 'generate') {
    // Load issues and generate files
    const files = await generateTodoFiles()
    if (!values.quiet) {
      console.log(`Generated ${files.length} files in .todo/`)
    }
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
  // Auto-init if no TODO.mdx
  if (!existsSync('TODO.mdx')) {
    if (!options.quiet) {
      console.log('No TODO.mdx found, creating one...')
    }
    await writeFile('TODO.mdx', DEFAULT_TEMPLATE)
  }

  const output = options.output || 'TODO.md'

  try {
    const result = await compile({
      input: 'TODO.mdx',
      output,
    })

    if (!options.quiet) {
      console.log(`Compiled TODO.mdx → ${output}`)
    }

    if (options.watch) {
      // TODO: Implement watch mode
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
