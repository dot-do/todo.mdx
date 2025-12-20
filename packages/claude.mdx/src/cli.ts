#!/usr/bin/env node
/**
 * claude.mdx CLI
 *
 * AI-assisted development orchestrator
 * Dispatches Claude Code sessions to work on TODOs from beads issue tracker
 *
 * Usage:
 *   claude.mdx work [issue-id]     - Start session for specific issue
 *   claude.mdx next                - Pick next ready issue and start session
 *   claude.mdx daemon              - Watch mode, auto-dispatch sessions
 *   claude.mdx status              - Show active sessions and progress
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { workCommand } from './commands/work.js'
import { nextCommand } from './commands/next.js'
import { daemonCommand } from './commands/daemon.js'
import { statusCommand } from './commands/status.js'
import { checkBeadsInstalled } from './beads.js'

const program = new Command()

program
  .name('claude.mdx')
  .description('AI-assisted development orchestrator')
  .version('0.1.0')

// Work command
program
  .command('work [issue-id]')
  .description('Start Claude Code session for a specific issue')
  .option('-i, --issue-id <id>', 'Issue ID to work on')
  .option('--interactive', 'Interactive mode (pick from list)')
  .option('-c, --context <text>', 'Additional context to provide')
  .action(async (issueId, options) => {
    await checkBeads()
    await workCommand(issueId, options)
  })

// Next command
program
  .command('next')
  .description('Pick the next ready issue and start a session')
  .option('-p, --priority <level>', 'Priority threshold (1-5)', parseInt)
  .option('-t, --type <type>', 'Filter by type (bug|feature|task|epic|chore)')
  .option('-y, --yes', 'Auto-start without confirmation')
  .action(async (options) => {
    await checkBeads()
    await nextCommand(options)
  })

// Daemon command
program
  .command('daemon')
  .description('Watch for ready issues and auto-dispatch sessions')
  .option('-m, --max-parallel <count>', 'Maximum parallel sessions', parseInt, 2)
  .option('-i, --interval <seconds>', 'Polling interval in seconds', parseInt, 30)
  .option('-b, --background', 'Run in background')
  .option('-p, --priority <level>', 'Priority threshold', parseInt)
  .action(async (options) => {
    await checkBeads()
    await daemonCommand(options)
  })

// Status command
program
  .command('status')
  .description('Show active sessions and progress')
  .option('-d, --detailed', 'Show detailed session information')
  .option('-l, --logs', 'Show session logs')
  .action(async (options) => {
    await checkBeads()
    await statusCommand(options)
  })

// Help text
program.on('--help', () => {
  console.log('')
  console.log('Examples:')
  console.log('  $ claude.mdx work todo-123        # Start session for specific issue')
  console.log('  $ claude.mdx next                 # Work on next ready issue')
  console.log('  $ claude.mdx next -p 1            # Work on next P1 issue')
  console.log('  $ claude.mdx daemon -m 3          # Run daemon with 3 parallel sessions')
  console.log('  $ claude.mdx status               # Show active sessions')
  console.log('  $ claude.mdx status -d            # Show detailed status')
  console.log('')
})

/**
 * Check if beads is installed
 */
async function checkBeads(): Promise<void> {
  const installed = await checkBeadsInstalled()
  if (!installed) {
    console.error(chalk.red('Error: beads (bd) CLI not found.'))
    console.log(chalk.gray('\nInstall beads:'))
    console.log(chalk.gray('  npm install -g beads-workflows'))
    console.log(chalk.gray('  bd init'))
    console.log('')
    process.exit(1)
  }
}

// Parse and execute
program.parse()
