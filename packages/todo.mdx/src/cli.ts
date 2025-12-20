#!/usr/bin/env node
/**
 * todo.mdx CLI
 * Compile TODO.mdx templates and sync issues
 */

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { compile, generateTodoFiles, loadBeadsIssues } from './compiler.js'
import type { Issue } from './types.js'

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
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o' },
      watch: { type: 'boolean', short: 'w' },
      init: { type: 'boolean' },
      generate: { type: 'boolean', short: 'g' },
      quiet: { type: 'boolean', short: 'q' },
      source: { type: 'string', short: 's' },
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
  -i, --input <file>    Input template (default: TODO.mdx or .mdx/todo.mdx)
  -o, --output <file>   Output file (default: TODO.md)
  -w, --watch           Watch for changes
  -g, --generate        Generate .todo/*.md files from issues
  -s, --source <type>   Data source: beads (default), github, api
  -q, --quiet           Suppress output
  -h, --help            Show this help

File Patterns:
  Configure in TODO.mdx frontmatter:

  filePattern: "[id]-[title].mdx"    → proj-123-my-task.md
  filePattern: "[title].mdx"         → my-task.md
  filePattern: "[type]/[id].mdx"     → bug/proj-123.md

Examples:
  npx todo.mdx                       # Compile TODO.mdx → TODO.md
  npx todo.mdx --generate            # Generate .todo/*.md from beads
  npx todo.mdx --generate -s github  # Generate from GitHub issues
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
    const source = values.source || 'beads'

    // Load issues from specified source
    let issues: Issue[] = []
    if (source === 'beads') {
      if (!values.quiet) {
        console.log('Loading issues from beads...')
      }
      issues = await loadBeadsIssues()
    } else if (source === 'github') {
      // TODO: Implement loadGitHubIssues() - see todo-0u4
      console.error('GitHub source not yet implemented. Use beads for now.')
      process.exit(1)
    } else if (source === 'api') {
      // TODO: Implement API client - see todo-si1
      console.error('API source not yet implemented. Use beads for now.')
      process.exit(1)
    } else {
      console.error(`Unknown source: ${source}. Valid sources: beads, github, api`)
      process.exit(1)
    }

    if (issues.length === 0) {
      if (!values.quiet) {
        console.log('No issues found. Make sure you have a .beads/ directory with issues.')
      }
      return
    }

    // Generate files with loaded issues
    const files = await generateTodoFiles({ issues })
    if (!values.quiet) {
      console.log(`Generated ${files.length} files in .todo/`)
    }
    return
  }

  // Default: compile
  await runCompile(values)
}

async function runCompile(options: {
  input?: string
  output?: string
  watch?: boolean
  quiet?: boolean
}) {
  // Determine input file: explicit > .mdx/todo.mdx > TODO.mdx
  let input = options.input
  if (!input) {
    if (existsSync('.mdx/todo.mdx')) {
      input = '.mdx/todo.mdx'
    } else if (existsSync('TODO.mdx')) {
      input = 'TODO.mdx'
    } else {
      // Create default template
      if (!options.quiet) {
        console.log('No TODO.mdx found, creating one...')
      }
      await writeFile('TODO.mdx', DEFAULT_TEMPLATE)
      input = 'TODO.mdx'
    }
  }

  const output = options.output || 'TODO.md'

  try {
    const { generatedFiles } = await compile({
      input,
      output,
    })

    if (!options.quiet) {
      if (generatedFiles.length === 1) {
        console.log(`Compiled TODO.mdx → ${generatedFiles[0]}`)
      } else {
        console.log(`Compiled TODO.mdx → ${generatedFiles.length} files`)
        for (const file of generatedFiles) {
          console.log(`  ${file}`)
        }
      }
    }

    if (options.watch) {
      // TODO: Implement watch mode - see todo-az6
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
