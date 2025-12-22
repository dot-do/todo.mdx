/**
 * Priya MCP Tools
 *
 * On-demand commands for Priya the Product Planner:
 * - priya_review_roadmap: Analyze roadmap and provide suggestions
 * - priya_plan_sprint: Select issues for next sprint
 * - priya_triage_backlog: Categorize and prioritize unassigned issues
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Env } from '../../types'
import { createRuntime, priyaReviewRoadmap, priyaPlanSprint, priyaTriageBacklog } from 'agents.mdx'
import { cloudTransport } from 'agents.mdx/cloud'

/** MCP tool result type */
type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/** Context passed to tool handlers after auth verification */
type RepoContext = {
  env: Env
  repo: string
  repoDoc: any
  userRepos: any[]
}

/**
 * Register Priya tools with the MCP server
 *
 * @param server - MCP server instance
 * @param withRepoAccess - Higher-order function for repo access verification
 */
export function registerPriyaTools(
  server: McpServer,
  withRepoAccess: <TArgs extends { repo: string }>(
    handler: (args: TArgs, ctx: RepoContext) => Promise<ToolResult>
  ) => (args: TArgs) => Promise<ToolResult>
) {
  // priya_review_roadmap: Analyze roadmap and provide suggestions
  server.tool(
    'priya_review_roadmap',
    `Ask Priya to review the roadmap and provide strategic suggestions.

Analyzes:
- High-priority unassigned issues
- Blocked issues on critical path
- Stale issues (open > 90 days)
- Overall project health

Returns: JSON with summary, suggestions, and stats

Example:
  priya_review_roadmap({ repo: "owner/repo" })`,
    {
      repo: z.string().describe('Repository (owner/name)'),
    },
    { readOnlyHint: true },
    withRepoAccess(async ({ repo }, { env }) => {
      try {
        // Create runtime for this repo
        const transport = cloudTransport({ env, repo })
        const runtime = createRuntime({
          repo: {
            owner: repo.split('/')[0],
            name: repo.split('/')[1],
            defaultBranch: 'main',
            url: `https://github.com/${repo}`,
          },
          transport,
        })

        // Call Priya command
        const result = await priyaReviewRoadmap(runtime)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        }
      }
    })
  )

  // priya_plan_sprint: Select issues for next sprint
  server.tool(
    'priya_plan_sprint',
    `Ask Priya to plan the next sprint by selecting ready issues.

Selects issues based on:
- Priority (higher priority first)
- Dependencies (only ready issues)
- Capacity limit
- Optional label filtering

Returns: JSON with selectedIssues, summary, and metrics

Examples:
  priya_plan_sprint({ repo: "owner/repo" })
  priya_plan_sprint({ repo: "owner/repo", capacity: 5 })
  priya_plan_sprint({ repo: "owner/repo", capacity: 10, labels: ["sprint-ready"] })`,
    {
      repo: z.string().describe('Repository (owner/name)'),
      capacity: z.number().optional().default(10).describe('Max number of issues to select (default: 10)'),
      labels: z.array(z.string()).optional().describe('Filter by labels (optional)'),
      priorityThreshold: z.number().optional().default(4).describe('Max priority to include (default: 4)'),
    },
    { readOnlyHint: true },
    withRepoAccess(async ({ repo, capacity, labels, priorityThreshold }, { env }) => {
      try {
        // Create runtime for this repo
        const transport = cloudTransport({ env, repo })
        const runtime = createRuntime({
          repo: {
            owner: repo.split('/')[0],
            name: repo.split('/')[1],
            defaultBranch: 'main',
            url: `https://github.com/${repo}`,
          },
          transport,
        })

        // Call Priya command
        const result = await priyaPlanSprint(runtime, {
          capacity,
          labels,
          priorityThreshold,
        })

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        }
      }
    })
  )

  // priya_triage_backlog: Categorize and prioritize unassigned issues
  server.tool(
    'priya_triage_backlog',
    `Ask Priya to triage the backlog and suggest improvements.

Analyzes:
- Priority mismatches (e.g., bugs that should be P0/P1)
- Issues needing labels
- Stale issues (open > 6 months)
- Categorization by urgency

Returns: JSON with suggestions, categorized issues, and stats

Example:
  priya_triage_backlog({ repo: "owner/repo" })`,
    {
      repo: z.string().describe('Repository (owner/name)'),
    },
    { readOnlyHint: true },
    withRepoAccess(async ({ repo }, { env }) => {
      try {
        // Create runtime for this repo
        const transport = cloudTransport({ env, repo })
        const runtime = createRuntime({
          repo: {
            owner: repo.split('/')[0],
            name: repo.split('/')[1],
            defaultBranch: 'main',
            url: `https://github.com/${repo}`,
          },
          transport,
        })

        // Call Priya command
        const result = await priyaTriageBacklog(runtime)

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        }
      }
    })
  )
}
