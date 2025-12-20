/**
 * CLI entry point for cli.mdx
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { compile, renderCli, renderMarkdown, renderDual } from './simple-compiler.js'

/** Parse command line arguments */
function parseArgs(args: string[]): {
  command: string
  input?: string
  output?: string
  mode?: 'terminal' | 'markdown' | 'dual'
  help?: boolean
} {
  const parsed: any = {
    command: args[0] || 'render',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--input' || arg === '-i') {
      parsed.input = args[++i]
    } else if (arg === '--output' || arg === '-o') {
      parsed.output = args[++i]
    } else if (arg === '--mode' || arg === '-m') {
      parsed.mode = args[++i]
    } else if (!arg.startsWith('-') && i === 0) {
      parsed.command = arg
    } else if (!arg.startsWith('-') && !parsed.input) {
      parsed.input = arg
    }
  }

  return parsed
}

/** Show help message */
function showHelp() {
  console.log(`
cli.mdx - MDX-based CLI framework

USAGE:
  cli.mdx [command] [options]

COMMANDS:
  render              Render MDX to terminal (default)
  build               Compile MDX to markdown file
  dual                Render to both terminal and markdown
  help                Show this help message

OPTIONS:
  -i, --input <file>  Input MDX file (default: CLI.mdx)
  -o, --output <file> Output markdown file (default: CLI.md)
  -m, --mode <mode>   Render mode: terminal, markdown, or dual (default: terminal)
  -h, --help          Show this help message

EXAMPLES:
  cli.mdx                           # Render CLI.mdx to terminal
  cli.mdx build                     # Build CLI.mdx to CLI.md
  cli.mdx dual -i TODO.mdx -o TODO.md  # Render to both terminal and file
  cli.mdx -i ROADMAP.mdx -o ROADMAP.md --mode markdown

BUILT-IN COMPONENTS:
  <Issues.Ready />                  Show ready-to-work issues
  <Issues.Open />                   Show open issues
  <Issues.InProgress />             Show in-progress issues
  <Issues.Blocked />                Show blocked issues
  <Issues.Closed />                 Show closed issues
  <Roadmap />                       Show milestones/epics
  <Stats />                         Show issue statistics
  <Command name="..." />            Define CLI command
  <Agent rules={[...]} />           Define AI agent instructions

For more information, visit: https://github.com/dot-do/todo.mdx
`)
}

/** Main CLI function */
async function main() {
  const args = process.argv.slice(2)
  const parsed = parseArgs(args)

  if (parsed.help || parsed.command === 'help') {
    showHelp()
    process.exit(0)
  }

  const config = {
    input: parsed.input || 'CLI.mdx',
    output: parsed.output || 'CLI.md',
    mode: parsed.mode || 'terminal',
  }

  try {
    switch (parsed.command) {
      case 'render':
        await renderCli(config)
        break

      case 'build':
        await renderMarkdown(config)
        console.log(`✓ Compiled ${config.input} → ${config.output}`)
        break

      case 'dual':
        await renderDual(config)
        console.log(`✓ Compiled ${config.input} → ${config.output}`)
        break

      default:
        // Try to compile the first argument as input file
        if (parsed.command && !parsed.command.startsWith('-')) {
          await renderCli({ ...config, input: parsed.command })
        } else {
          await renderCli(config)
        }
        break
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
