import { z } from 'zod'
import type { Integration, Tool, Connection } from '../types'
import type { Env } from '../../types/env'

/**
 * Helper to get authenticated Octokit instance from connection
 */
async function getOctokit(connection: Connection, env: Env) {
  const { Octokit } = await import('@octokit/rest')
  const { createAppAuth } = await import('@octokit/auth-app')

  const installationId = connection.externalRef?.installationId

  if (!installationId) {
    throw new Error('GitHub connection missing installationId')
  }

  const auth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_PRIVATE_KEY,
    installationId,
  })

  const { token } = await auth({ type: 'installation' })
  return new Octokit({ auth: token })
}

/**
 * GitHub Native Integration
 *
 * Provides tools for interacting with GitHub via the native GitHub App.
 * Uses the existing GitHub App authentication from the connection's installationId.
 */
export const GitHub: Integration = {
  name: 'GitHub',
  tools: [
    {
      name: 'createBranch',
      fullName: 'github.createBranch',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        ref: z.string().describe('Branch name to create'),
        sha: z.string().optional().describe('Base SHA (defaults to default branch HEAD)'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        let sha = params.sha

        // If no sha provided, get default branch HEAD
        if (!sha) {
          const { data: repoData } = await octokit.repos.get({ owner, repo })
          const defaultBranch = repoData.default_branch
          const { data: branchData } = await octokit.repos.getBranch({
            owner,
            repo,
            branch: defaultBranch,
          })
          sha = branchData.commit.sha
        }

        // Create the ref
        const { data } = await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${params.ref}`,
          sha,
        })

        return {
          ref: data.ref,
          sha: data.object.sha,
          url: data.url,
        }
      },
    },
    {
      name: 'createPullRequest',
      fullName: 'github.createPullRequest',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        title: z.string().describe('Pull request title'),
        head: z.string().describe('Branch to merge from'),
        base: z.string().describe('Branch to merge into'),
        body: z.string().optional().describe('Pull request description'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.pulls.create({
          owner,
          repo,
          title: params.title,
          head: params.head,
          base: params.base,
          body: params.body,
        })

        return {
          number: data.number,
          url: data.html_url,
          state: data.state,
          title: data.title,
        }
      },
    },
    {
      name: 'addComment',
      fullName: 'github.addComment',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        issue: z.number().describe('Issue or PR number'),
        body: z.string().describe('Comment text'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.issues.createComment({
          owner,
          repo,
          issue_number: params.issue,
          body: params.body,
        })

        return {
          id: data.id,
          url: data.html_url,
          body: data.body,
          createdAt: data.created_at,
        }
      },
    },
    {
      name: 'listIssues',
      fullName: 'github.listIssues',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        state: z.enum(['open', 'closed', 'all']).optional().describe('Issue state filter'),
        labels: z.array(z.string()).optional().describe('Filter by labels'),
        assignee: z.string().optional().describe('Filter by assignee'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.issues.listForRepo({
          owner,
          repo,
          state: params.state,
          labels: params.labels?.join(','),
          assignee: params.assignee,
        })

        return data.map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
          assignees: issue.assignees?.map(a => a.login) || [],
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
        }))
      },
    },
    {
      name: 'updateIssue',
      fullName: 'github.updateIssue',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        issue: z.number().describe('Issue number'),
        title: z.string().optional().describe('New title'),
        body: z.string().optional().describe('New body'),
        state: z.enum(['open', 'closed']).optional().describe('New state'),
        labels: z.array(z.string()).optional().describe('Replace labels'),
        assignees: z.array(z.string()).optional().describe('Replace assignees'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.issues.update({
          owner,
          repo,
          issue_number: params.issue,
          title: params.title,
          body: params.body,
          state: params.state,
          labels: params.labels,
          assignees: params.assignees,
        })

        return {
          number: data.number,
          title: data.title,
          state: data.state,
          url: data.html_url,
        }
      },
    },
    {
      name: 'addLabels',
      fullName: 'github.addLabels',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        issue: z.number().describe('Issue or PR number'),
        labels: z.array(z.string()).describe('Labels to add'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.issues.addLabels({
          owner,
          repo,
          issue_number: params.issue,
          labels: params.labels,
        })

        return {
          labels: data.map(l => l.name),
        }
      },
    },
    {
      name: 'createLabel',
      fullName: 'github.createLabel',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        name: z.string().describe('Label name'),
        color: z.string().describe('Label color (hex without #)'),
        description: z.string().optional().describe('Label description'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.issues.createLabel({
          owner,
          repo,
          name: params.name,
          color: params.color,
          description: params.description,
        })

        return {
          name: data.name,
          color: data.color,
          description: data.description,
        }
      },
    },
    {
      name: 'mergePullRequest',
      fullName: 'github.mergePullRequest',
      schema: z.object({
        repo: z.string().describe('Repository in owner/repo format'),
        pullNumber: z.number().describe('Pull request number'),
        mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional().describe('Merge method'),
        commitTitle: z.string().optional().describe('Commit title'),
        commitMessage: z.string().optional().describe('Commit message'),
      }),
      execute: async (params, connection, env: Env) => {
        const octokit = await getOctokit(connection, env)
        const [owner, repo] = params.repo.split('/')

        const { data } = await octokit.pulls.merge({
          owner,
          repo,
          pull_number: params.pullNumber,
          merge_method: params.mergeMethod,
          commit_title: params.commitTitle,
          commit_message: params.commitMessage,
        })

        return {
          merged: data.merged,
          sha: data.sha,
          message: data.message,
        }
      },
    },
  ],
}
