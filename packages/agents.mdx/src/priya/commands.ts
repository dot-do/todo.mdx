/**
 * Priya CLI Commands
 *
 * Commands for interacting with Priya the Product Planner
 */

import { createRuntime } from '../runtime'
import { localTransport } from '../local'
import { assignReadyIssues } from './assignment'
import type { Repo, Issue } from '../types'
import { priya } from './persona'

/**
 * Get repo info from git remote
 */
async function getRepoFromGit(): Promise<Repo> {
  // This is a simple implementation - could be enhanced
  const { Bun } = globalThis as any
  if (!Bun) {
    throw new Error('Priya commands require Bun runtime')
  }

  const proc = Bun.spawn(['git', 'config', '--get', 'remote.origin.url'], {
    stdout: 'pipe',
  })
  const output = await new Response(proc.stdout).text()
  const url = output.trim()

  // Parse GitHub URL (https://github.com/owner/repo.git or git@github.com:owner/repo.git)
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
  if (!match) {
    throw new Error(`Could not parse GitHub URL: ${url}`)
  }

  const [, owner, name] = match

  // Get default branch
  const branchProc = Bun.spawn(['git', 'symbolic-ref', 'refs/remotes/origin/HEAD'], {
    stdout: 'pipe',
  })
  const branchOutput = await new Response(branchProc.stdout).text()
  const defaultBranch = branchOutput.trim().replace('refs/remotes/origin/', '') || 'main'

  return {
    owner,
    name,
    defaultBranch,
    url: `https://github.com/${owner}/${name}`,
  }
}

/**
 * priya assign - Run assignment algorithm once
 */
export async function priyaAssign(): Promise<void> {
  const repo = await getRepoFromGit()
  const transport = localTransport({ repo })
  const runtime = createRuntime({ repo, transport })

  console.log('🔍 Finding ready issues...')
  const results = await assignReadyIssues(runtime)

  if (results.length === 0) {
    console.log('✅ No ready issues to assign')
    return
  }

  console.log(`\n✅ Assigned ${results.length} issue${results.length === 1 ? '' : 's'}:\n`)

  for (const result of results) {
    console.log(`  ${result.issue.id}: ${result.issue.title}`)
    console.log(`    → ${result.agent.name} (${Math.round(result.confidence * 100)}% confidence)`)
    console.log(`    → ${result.reason}\n`)
  }
}

/**
 * priya status - Show assignment queue status
 */
export async function priyaStatus(): Promise<void> {
  const repo = await getRepoFromGit()
  const transport = localTransport({ repo })
  const runtime = createRuntime({ repo, transport })

  const [ready, blocked, inProgress] = await Promise.all([
    runtime.issues.ready(),
    runtime.issues.blocked(),
    runtime.issues.list({ status: 'in_progress' }),
  ])

  console.log('📊 Priya Status Report\n')

  console.log(`Ready to assign: ${ready.length}`)
  if (ready.length > 0) {
    ready.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title}`)
    })
    if (ready.length > 5) {
      console.log(`  ... and ${ready.length - 5} more`)
    }
  }

  console.log(`\nIn progress: ${inProgress.length}`)
  if (inProgress.length > 0) {
    inProgress.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title} (${issue.assignee || 'unassigned'})`)
    })
    if (inProgress.length > 5) {
      console.log(`  ... and ${inProgress.length - 5} more`)
    }
  }

  console.log(`\nBlocked: ${blocked.length}`)
  if (blocked.length > 0) {
    blocked.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title}`)
    })
    if (blocked.length > 5) {
      console.log(`  ... and ${blocked.length - 5} more`)
    }
  }
}

/**
 * priya critical-path - Show critical path analysis
 */
export async function priyaCriticalPath(): Promise<void> {
  const repo = await getRepoFromGit()
  const transport = localTransport({ repo })
  const runtime = createRuntime({ repo, transport })

  console.log('🎯 Critical Path Analysis\n')

  const criticalPath = await runtime.dag.criticalPath()

  if (criticalPath.length === 0) {
    console.log('✅ No critical path found (all issues completed or no dependencies)')
    return
  }

  console.log(`Length: ${criticalPath.length} issues\n`)

  criticalPath.forEach((issue, index) => {
    const marker = index === 0 ? '🔴' : index === criticalPath.length - 1 ? '🏁' : '  '
    console.log(`${marker} ${issue.id}: ${issue.title}`)
    console.log(`   Status: ${issue.status}, Priority: ${issue.priority}`)
    if (issue.assignee) {
      console.log(`   Assigned to: ${issue.assignee}`)
    }
    console.log()
  })

  console.log(`💡 Focus on unblocking the critical path to maximize velocity`)
}

/**
 * priya info - Show Priya agent information
 */
export async function priyaInfo(): Promise<void> {
  console.log(`🤖 ${priya.name}\n`)
  console.log(priya.description)
  console.log(`\nModel: ${priya.model}`)
  console.log(`Autonomy: ${priya.autonomy}`)
  console.log(`\nCapabilities:`)
  priya.capabilities?.forEach(cap => {
    console.log(`  - ${cap.name}: ${cap.description || cap.operations?.join(', ')}`)
  })
}
