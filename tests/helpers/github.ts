import { App, Octokit } from '@octokit/app'
import type { Worktree } from './worktree'
import { execa } from 'execa'

const GITHUB_APP_ID = process.env.GITHUB_APP_ID
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID

// Test repository info (from submodule)
const TEST_REPO_OWNER = 'dot-do' // TODO: Make configurable
const TEST_REPO_NAME = 'test.mdx'

let cachedOctokit: Octokit | null = null

export function hasGitHubCredentials(): boolean {
  return !!(GITHUB_APP_ID && GITHUB_PRIVATE_KEY && GITHUB_INSTALLATION_ID)
}

export async function createGitHubClient(): Promise<Octokit> {
  if (cachedOctokit) {
    return cachedOctokit
  }

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
    throw new Error(
      'GitHub App credentials not configured. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, and GITHUB_INSTALLATION_ID'
    )
  }

  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  })

  cachedOctokit = await app.getInstallationOctokit(Number(GITHUB_INSTALLATION_ID))
  return cachedOctokit
}

export async function getGitCredentials(): Promise<{ username: string; password: string }> {
  const octokit = await createGitHubClient()

  const { data } = await octokit.rest.apps.createInstallationAccessToken({
    installation_id: Number(GITHUB_INSTALLATION_ID),
  })

  return {
    username: 'x-access-token',
    password: data.token,
  }
}

export async function configureGitAuth(worktree: Worktree): Promise<void> {
  const { username, password } = await getGitCredentials()

  // Configure git to use the token for this worktree
  await execa('git', ['config', 'credential.helper', 'store'], { cwd: worktree.path })

  // Set the remote URL with credentials
  const remoteUrl = `https://${username}:${password}@github.com/${TEST_REPO_OWNER}/${TEST_REPO_NAME}.git`
  await execa('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: worktree.path })
}

export async function listIssues(params?: { state?: 'open' | 'closed' | 'all'; labels?: string }) {
  const octokit = await createGitHubClient()

  const { data } = await octokit.rest.issues.listForRepo({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    state: params?.state || 'all',
    labels: params?.labels,
  })

  return data
}

export async function getIssue(issueNumber: number) {
  const octokit = await createGitHubClient()

  const { data } = await octokit.rest.issues.get({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    issue_number: issueNumber,
  })

  return data
}

export async function createPullRequest(params: {
  title: string
  body: string
  head: string
  base?: string
}) {
  const octokit = await createGitHubClient()

  const { data } = await octokit.rest.pulls.create({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base || 'main',
  })

  return data
}

export async function mergePullRequest(pullNumber: number) {
  const octokit = await createGitHubClient()

  const { data } = await octokit.rest.pulls.merge({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    pull_number: pullNumber,
    merge_method: 'squash',
  })

  return data
}

export async function closePullRequest(pullNumber: number) {
  const octokit = await createGitHubClient()

  const { data } = await octokit.rest.pulls.update({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    pull_number: pullNumber,
    state: 'closed',
  })

  return data
}

export async function deleteRemoteBranch(branchName: string) {
  const octokit = await createGitHubClient()

  try {
    await octokit.rest.git.deleteRef({
      owner: TEST_REPO_OWNER,
      repo: TEST_REPO_NAME,
      ref: `heads/${branchName}`,
    })
  } catch {
    // Branch may not exist on remote, ignore
  }
}
