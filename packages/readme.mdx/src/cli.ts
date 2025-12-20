#!/usr/bin/env node
/**
 * readme.mdx CLI
 * Compile README.mdx templates with live data
 */

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { compile, DEFAULT_TEMPLATE } from './compiler.js'

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      output: { type: 'string', short: 'o' },
      watch: { type: 'boolean', short: 'w' },
      init: { type: 'boolean' },
      quiet: { type: 'boolean', short: 'q' },
      'no-github': { type: 'boolean' },
      'no-npm': { type: 'boolean' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
readme.mdx - MDX components that compile to README.md with live data

Usage:
  npx readme.mdx              Compile README.mdx to README.md
  npx readme.mdx init         Create README.mdx template

Options:
  -o, --output <file>   Output file (default: README.md)
  -w, --watch           Watch for changes
  -q, --quiet           Suppress output
  --no-github           Skip GitHub API calls
  --no-npm              Skip npm API calls
  -h, --help            Show this help

Components:
  <Badges />            - npm version, build status, license badges
  <Installation />      - package installation instructions
  <Usage />             - usage examples placeholder
  <API />               - API documentation from package.json
  <Contributing />      - contribution guidelines
  <License />           - license info from package.json
  <Package />           - package description and metadata
  <Stats />             - GitHub stars, npm downloads

Variables:
  {name}                - Package name from package.json
  {version}             - Package version
  {description}         - Package description
  {license}             - Package license

Examples:
  npx readme.mdx                    # Compile README.mdx → README.md
  npx readme.mdx --watch            # Watch mode
  npx readme.mdx --no-github        # Skip GitHub data
`)
    return
  }

  const command = positionals[0]

  // Init command
  if (values.init || command === 'init') {
    if (existsSync('README.mdx')) {
      console.log('README.mdx already exists')
      return
    }
    await writeFile('README.mdx', DEFAULT_TEMPLATE)
    console.log('Created README.mdx')
    return
  }

  // Default: compile
  await runCompile(values)
}

async function runCompile(options: {
  output?: string
  watch?: boolean
  quiet?: boolean
  'no-github'?: boolean
  'no-npm'?: boolean
}) {
  // Auto-init if no README.mdx
  if (!existsSync('README.mdx')) {
    if (!options.quiet) {
      console.log('No README.mdx found, creating one...')
    }
    await writeFile('README.mdx', DEFAULT_TEMPLATE)
  }

  const output = options.output || 'README.md'

  try {
    const result = await compile({
      input: 'README.mdx',
      output,
      config: {
        badges: !options['no-github'],
        npmStats: !options['no-npm'],
      },
    })

    if (!options.quiet) {
      console.log(`Compiled README.mdx → ${output}`)
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
