/**
 * Status Command
 *
 * Show active Claude Code sessions and their progress
 */

import chalk from 'chalk'
import { getAllSessions, getRunningSessions } from '../session.js'
import { getStats } from '../beads.js'
import type { StatusCommandOptions } from '../types.js'

export async function statusCommand(options: StatusCommandOptions): Promise<void> {
  try {
    console.log(chalk.blue('Claude.mdx Status'))
    console.log('')

    // Get all sessions
    const allSessions = getAllSessions()
    const runningSessions = getRunningSessions()

    // Session summary
    console.log(chalk.bold('Active Sessions:'))
    if (allSessions.length === 0) {
      console.log(chalk.gray('  No active sessions'))
    } else {
      console.log(chalk.gray(`  Total: ${allSessions.length}`))
      console.log(chalk.gray(`  Running: ${runningSessions.length}`))
      console.log(
        chalk.gray(
          `  Completed: ${allSessions.filter((s) => s.status === 'completed').length}`
        )
      )
      console.log(chalk.gray(`  Failed: ${allSessions.filter((s) => s.status === 'failed').length}`))
      console.log(
        chalk.gray(`  Stopped: ${allSessions.filter((s) => s.status === 'stopped').length}`)
      )
    }

    console.log('')

    // Session details
    if (allSessions.length > 0) {
      console.log(chalk.bold('Sessions:'))
      for (const session of allSessions) {
        const statusColor =
          session.status === 'running'
            ? chalk.blue
            : session.status === 'completed'
              ? chalk.green
              : session.status === 'failed'
                ? chalk.red
                : chalk.yellow

        const duration = Date.now() - session.startedAt.getTime()
        const durationStr = formatDuration(duration)

        console.log('')
        console.log(`  ${chalk.bold(session.id)}: ${session.issue.title}`)
        console.log(
          `    Status: ${statusColor(session.status)} | Duration: ${durationStr}`
        )
        console.log(
          chalk.gray(
            `    Type: ${session.issue.type} | Priority: ${session.issue.priority || 'none'}`
          )
        )

        if (options.detailed) {
          console.log(chalk.gray(`    Started: ${session.startedAt.toISOString()}`))
          if (session.exitCode !== undefined) {
            console.log(chalk.gray(`    Exit code: ${session.exitCode}`))
          }

          if (session.issue.description) {
            const shortDesc = session.issue.description.slice(0, 80)
            console.log(
              chalk.gray(
                `    Description: ${shortDesc}${session.issue.description.length > 80 ? '...' : ''}`
              )
            )
          }
        }
      }
    }

    // Beads statistics
    console.log('')
    console.log(chalk.bold('Beads Statistics:'))
    try {
      const stats = await getStats()
      console.log(chalk.gray(`  Total issues: ${stats.total}`))
      console.log(chalk.gray(`  Open: ${stats.open}`))
      console.log(chalk.gray(`  In progress: ${stats.in_progress}`))
      console.log(chalk.gray(`  Blocked: ${stats.blocked}`))
      console.log(chalk.green(`  Ready to work: ${stats.ready}`))
      console.log(chalk.gray(`  Closed: ${stats.closed}`))
    } catch (error) {
      console.log(chalk.red('  Failed to get beads statistics'))
      if (options.detailed) {
        console.log(
          chalk.red(`    ${error instanceof Error ? error.message : String(error)}`)
        )
      }
    }

    console.log('')
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

/**
 * Format duration in ms to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}
