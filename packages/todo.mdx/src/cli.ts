#!/usr/bin/env node
/**
 * todo.mdx CLI
 * Compile TODO.mdx templates and sync issues
 */

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { compile, generateTodoFiles, loadBeadsIssues, loadGitHubIssues } from './compiler.js'
import { loadApiIssues } from './api-client.js'
import { watch } from './watcher.js'
import type { Issue, TodoConfig } from './types.js'

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
      if (!values.quiet) {
        console.log('Loading issues from GitHub...')
      }

      // Check for required environment variable
      if (!process.env.GITHUB_TOKEN) {
        console.error('Error: GITHUB_TOKEN environment variable is required for GitHub source')
        console.error('Set it with: export GITHUB_TOKEN=ghp_your_token_here')
        process.exit(1)
      }

      // GitHub requires owner/repo - try to read from TODO.mdx frontmatter
      const config: TodoConfig = {}
      try {
        if (existsSync('TODO.mdx')) {
          const content = await readFile('TODO.mdx', 'utf-8')
          const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
          if (match) {
            const frontmatter = match[1]
            const ownerMatch = frontmatter.match(/owner:\s*(.+)/)
            const repoMatch = frontmatter.match(/repo:\s*(.+)/)
            if (ownerMatch) config.owner = ownerMatch[1].trim()
            if (repoMatch) config.repo = repoMatch[1].trim()
          }
        }
      } catch {
        // Ignore errors reading TODO.mdx
      }

      if (!config.owner || !config.repo) {
        console.error('Error: GitHub owner/repo not configured')
        console.error('Add to TODO.mdx frontmatter:')
        console.error('---')
        console.error('owner: your-github-username')
        console.error('repo: your-repo-name')
        console.error('---')
        process.exit(1)
      }

      issues = await loadGitHubIssues(config)
    } else if (source === 'api') {
      if (!values.quiet) {
        console.log('Loading issues from todo.mdx.do API...')
      }

      // API requires owner/repo and API key - try to read from TODO.mdx frontmatter or environment
      const config: TodoConfig = {}
      try {
        if (existsSync('TODO.mdx')) {
          const content = await readFile('TODO.mdx', 'utf-8')
          const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
          if (match) {
            const frontmatter = match[1]
            const ownerMatch = frontmatter.match(/owner:\s*(.+)/)
            const repoMatch = frontmatter.match(/repo:\s*(.+)/)
            const apiUrlMatch = frontmatter.match(/apiUrl:\s*(.+)/)
            const apiKeyMatch = frontmatter.match(/apiKey:\s*(.+)/)
            if (ownerMatch) config.owner = ownerMatch[1].trim()
            if (repoMatch) config.repo = repoMatch[1].trim()
            if (apiUrlMatch) config.apiUrl = apiUrlMatch[1].trim()
            if (apiKeyMatch) config.apiKey = apiKeyMatch[1].trim()
          }
        }
      } catch {
        // Ignore errors reading TODO.mdx
      }

      // Environment variables override frontmatter
      config.owner = config.owner || process.env.TODO_MDX_OWNER
      config.repo = config.repo || process.env.TODO_MDX_REPO
      config.apiUrl = config.apiUrl || process.env.TODO_MDX_API_URL
      config.apiKey = config.apiKey || process.env.TODO_MDX_API_KEY

      if (!config.owner || !config.repo) {
        console.error('Error: API owner/repo not configured')
        console.error('Add to TODO.mdx frontmatter:')
        console.error('---')
        console.error('owner: your-github-username')
        console.error('repo: your-repo-name')
        console.error('apiKey: your-api-key  # Optional if using TODO_MDX_API_KEY env var')
        console.error('---')
        console.error('Or set environment variables: TODO_MDX_OWNER, TODO_MDX_REPO, TODO_MDX_API_KEY')
        process.exit(1)
      }

      if (!config.apiKey) {
        console.error('Error: TODO_MDX_API_KEY environment variable or apiKey in frontmatter is required for API source')
        console.error('Set it with: export TODO_MDX_API_KEY=your_api_key_here')
        process.exit(1)
      }

      issues = await loadApiIssues(config)
    } else {
      console.error(`Unknown source: ${source}. Valid sources: beads, github, api`)
      process.exit(1)
    }

    if (issues.length === 0) {
      if (!values.quiet) {
        console.log('No issues found.')
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
      if (!options.quiet) {
        console.log('Starting watch mode...')
        console.log('Watching .todo/*.md for changes')
      }

      // Start the file watcher
      const stopWatcher = await watch({
        todoDir: '.todo',
        verbose: !options.quiet,
        onEvent: (event) => {
          if (!options.quiet) {
            if (event.action === 'updated') {
              console.log(`Synced ${event.issueId}: ${event.path}`)
            } else if (event.action === 'error') {
              console.error(`Error syncing ${event.path}: ${event.error}`)
            }
          }
        },
      })

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        if (!options.quiet) {
          console.log('\nStopping watch mode...')
        }
        await stopWatcher()
        process.exit(0)
      })

      process.on('SIGTERM', async () => {
        await stopWatcher()
        process.exit(0)
      })

      // Keep process alive
      await new Promise(() => {})
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
