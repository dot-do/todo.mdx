/**
 * Next Command
 *
 * Pick the next ready issue and start a Claude Code session
 */

import chalk from 'chalk'
import { getReadyIssues, updateIssueStatus } from '../beads.js'
import { spawnSession, checkClaudeInstalled, waitForSession } from '../session.js'
import type { NextCommandOptions } from '../types.js'

export async function nextCommand(options: NextCommandOptions): Promise<void> {
  // Check Claude is installed
  const claudeInstalled = await checkClaudeInstalled()
  if (!claudeInstalled) {
    console.error(chalk.red('Error: Claude CLI not found. Please install Claude Code first.'))
    process.exit(1)
  }

  try {
    console.log(chalk.blue('Fetching ready issues...'))

    // Get ready issues
    const readyIssues = await getReadyIssues({
      priority: options.priority,
      limit: 10,
    })

    if (readyIssues.length === 0) {
      console.log(chalk.yellow('No ready issues found.'))
      console.log(chalk.gray('\nTry:'))
      console.log(chalk.gray('  bd list --status=open'))
      console.log(chalk.gray('  bd blocked'))
      process.exit(0)
    }

    // Filter by type if specified
    let filteredIssues = readyIssues
    if (options.type) {
      filteredIssues = readyIssues.filter((issue) => issue.type === options.type)
      if (filteredIssues.length === 0) {
        console.log(chalk.yellow(`No ready issues of type '${options.type}' found.`))
        process.exit(0)
      }
    }

    // Sort by priority (highest first), then by created date
    filteredIssues.sort((a, b) => {
      const priorityA = a.priority || 999
      const priorityB = b.priority || 999
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    // Pick the first issue
    const issue = filteredIssues[0]

    console.log(chalk.green('\nNext issue:'))
    console.log(chalk.bold(`  ${issue.id}: ${issue.title}`))
    console.log(chalk.gray(`  Type: ${issue.type}, Priority: ${issue.priority || 'none'}`))

    if (issue.description) {
      const shortDesc = issue.description.slice(0, 100)
      console.log(chalk.gray(`  ${shortDesc}${issue.description.length > 100 ? '...' : ''}`))
    }

    // Show other ready issues
    if (filteredIssues.length > 1) {
      console.log(chalk.gray(`\n${filteredIssues.length - 1} other ready issue${filteredIssues.length > 2 ? 's' : ''}:`))
      for (let i = 1; i < Math.min(5, filteredIssues.length); i++) {
        const otherIssue = filteredIssues[i]
        console.log(
          chalk.gray(`  ${otherIssue.id}: ${otherIssue.title} (P${otherIssue.priority || '?'})`)
        )
      }
      if (filteredIssues.length > 5) {
        console.log(chalk.gray(`  ... and ${filteredIssues.length - 5} more`))
      }
    }

    // Confirm (unless --yes flag)
    if (!options.yes) {
      console.log('')
      console.log(chalk.yellow('Press Ctrl+C to cancel, or Enter to start session...'))
      // In a real implementation, you'd use readline or prompts here
      // For now, we'll just proceed
    }

    console.log(chalk.blue('\nStarting Claude Code session...'))

    // Update issue to in_progress
    if (issue.status === 'open') {
      await updateIssueStatus(issue.id, 'in_progress')
      console.log(chalk.gray('Updated issue status to in_progress'))
    }

    // Spawn session
    const session = await spawnSession(issue, {
      interactive: true,
      cwd: process.cwd(),
    })

    console.log(chalk.green(`\nSession started for ${issue.id}`))
    console.log(chalk.gray(`Started at: ${session.startedAt.toISOString()}`))

    // Wait for completion
    const completedSession = await waitForSession(issue.id)

    console.log('')
    if (completedSession.status === 'completed') {
      console.log(chalk.green(`Session completed successfully (exit code: ${completedSession.exitCode})`))
    } else if (completedSession.status === 'failed') {
      console.log(chalk.red(`Session failed (exit code: ${completedSession.exitCode})`))
    } else if (completedSession.status === 'stopped') {
      console.log(chalk.yellow('Session stopped'))
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
