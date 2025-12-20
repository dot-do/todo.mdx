/**
 * Daemon Command
 *
 * Watch for ready issues and auto-dispatch Claude Code sessions
 */

import chalk from 'chalk'
import { getReadyIssues, updateIssueStatus, getStats } from '../beads.js'
import {
  spawnSession,
  checkClaudeInstalled,
  getRunningSessions,
  clearCompletedSessions,
} from '../session.js'
import type { DaemonCommandOptions } from '../types.js'

let running = false
let statsInterval: NodeJS.Timeout | null = null

export async function daemonCommand(options: DaemonCommandOptions): Promise<void> {
  // Check Claude is installed
  const claudeInstalled = await checkClaudeInstalled()
  if (!claudeInstalled) {
    console.error(chalk.red('Error: Claude CLI not found. Please install Claude Code first.'))
    process.exit(1)
  }

  const maxParallel = options.maxParallel || 2
  const interval = (options.interval || 30) * 1000 // Convert to ms
  const priorityThreshold = options.priority

  console.log(chalk.blue('Starting claude.mdx daemon...'))
  console.log(chalk.gray(`Max parallel sessions: ${maxParallel}`))
  console.log(chalk.gray(`Poll interval: ${interval / 1000}s`))
  if (priorityThreshold) {
    console.log(chalk.gray(`Priority threshold: ${priorityThreshold}`))
  }
  console.log('')

  // Handle shutdown
  running = true
  const shutdown = () => {
    console.log(chalk.yellow('\nShutting down daemon...'))
    running = false
    if (statsInterval) {
      clearInterval(statsInterval)
    }
    // In production, you'd want to gracefully stop running sessions
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Print stats periodically
  statsInterval = setInterval(async () => {
    try {
      const stats = await getStats()
      const runningSessions = getRunningSessions()
      console.log(
        chalk.gray(
          `[${new Date().toLocaleTimeString()}] Stats: ${stats.ready} ready, ${stats.in_progress} in progress, ${runningSessions.length} active sessions`
        )
      )
    } catch {
      // Ignore stats errors
    }
  }, 60000) // Every minute

  // Main loop
  while (running) {
    try {
      // Clean up completed sessions
      clearCompletedSessions()

      // Check how many sessions are running
      const runningSessions = getRunningSessions()
      const availableSlots = maxParallel - runningSessions.length

      if (availableSlots > 0) {
        // Fetch ready issues
        const readyIssues = await getReadyIssues({
          priority: priorityThreshold,
          limit: availableSlots,
        })

        // Filter out issues that already have running sessions
        const runningIssueIds = new Set(runningSessions.map((s) => s.id))
        const newIssues = readyIssues.filter((issue) => !runningIssueIds.has(issue.id))

        // Sort by priority
        newIssues.sort((a, b) => {
          const priorityA = a.priority || 999
          const priorityB = b.priority || 999
          if (priorityA !== priorityB) {
            return priorityA - priorityB
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })

        // Start sessions for available slots
        for (let i = 0; i < Math.min(availableSlots, newIssues.length); i++) {
          const issue = newIssues[i]

          console.log(
            chalk.green(
              `[${new Date().toLocaleTimeString()}] Starting session for ${issue.id}: ${issue.title}`
            )
          )

          try {
            // Update to in_progress
            if (issue.status === 'open') {
              await updateIssueStatus(issue.id, 'in_progress')
            }

            // Spawn session (non-interactive)
            const session = await spawnSession(issue, {
              interactive: false,
              cwd: process.cwd(),
            })

            // Set up completion handler
            session.process.then(() => {
              const status = session.status === 'completed' ? chalk.green('completed') : chalk.red('failed')
              console.log(
                chalk.gray(
                  `[${new Date().toLocaleTimeString()}] Session ${issue.id} ${status} (exit code: ${session.exitCode})`
                )
              )
            })
          } catch (error) {
            console.error(
              chalk.red(
                `[${new Date().toLocaleTimeString()}] Failed to start session for ${issue.id}:`
              ),
              error instanceof Error ? error.message : String(error)
            )
          }
        }
      }

      // Sleep before next poll
      await sleep(interval)
    } catch (error) {
      console.error(
        chalk.red(`[${new Date().toLocaleTimeString()}] Error in daemon loop:`),
        error instanceof Error ? error.message : String(error)
      )
      await sleep(interval)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
