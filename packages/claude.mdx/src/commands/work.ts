/**
 * Work Command
 *
 * Start a Claude Code session for a specific issue
 */

import chalk from 'chalk'
import { getIssue, updateIssueStatus } from '../beads.js'
import { spawnSession, checkClaudeInstalled, waitForSession } from '../session.js'
import type { WorkCommandOptions } from '../types.js'

export async function workCommand(
  issueIdArg: string | undefined,
  options: WorkCommandOptions
): Promise<void> {
  // Check Claude is installed
  const claudeInstalled = await checkClaudeInstalled()
  if (!claudeInstalled) {
    console.error(chalk.red('Error: Claude CLI not found. Please install Claude Code first.'))
    process.exit(1)
  }

  // Determine issue ID
  const issueId = issueIdArg || options.issueId
  if (!issueId) {
    console.error(chalk.red('Error: Issue ID required'))
    console.log('\nUsage:')
    console.log('  claude.mdx work <issue-id>')
    console.log('  claude.mdx work --issue-id <issue-id>')
    process.exit(1)
  }

  try {
    console.log(chalk.blue(`Fetching issue ${issueId}...`))

    // Get issue
    const issue = await getIssue(issueId)

    console.log(chalk.green(`Found: ${issue.title}`))
    console.log(chalk.gray(`Type: ${issue.type}, Priority: ${issue.priority || 'none'}, Status: ${issue.status}`))

    // Check if issue is blocked
    if (issue.status === 'blocked') {
      console.log(chalk.yellow('\nWarning: This issue is marked as blocked'))
      if (issue.dependencies && issue.dependencies.length > 0) {
        console.log(chalk.yellow('Blockers:'))
        for (const dep of issue.dependencies) {
          if (dep.dependency_type === 'blocks' && dep.status !== 'closed') {
            console.log(chalk.yellow(`  - ${dep.id}: ${dep.title} (${dep.status})`))
          }
        }
      }
    }

    // Check if already in progress
    if (issue.status === 'in_progress') {
      console.log(chalk.yellow('\nNote: This issue is already marked as in_progress'))
    }

    console.log(chalk.blue('\nStarting Claude Code session...'))

    // Update issue to in_progress
    if (issue.status === 'open') {
      await updateIssueStatus(issueId, 'in_progress')
      console.log(chalk.gray('Updated issue status to in_progress'))
    }

    // Spawn session
    const session = await spawnSession(issue, {
      interactive: true,
      cwd: process.cwd(),
    })

    console.log(chalk.green(`\nSession started for ${issueId}`))
    console.log(chalk.gray(`Started at: ${session.startedAt.toISOString()}`))

    // Wait for completion (in interactive mode)
    const completedSession = await waitForSession(issueId)

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
