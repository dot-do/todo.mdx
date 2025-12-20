/**
 * Data fetching for package.json, GitHub, and npm
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PackageData, GitHubData, NpmData } from './types.js'

/** Load package.json data */
export async function loadPackageData(packagePath?: string): Promise<PackageData | null> {
  const path = packagePath || resolve(process.cwd(), 'package.json')

  if (!existsSync(path)) {
    return null
  }

  try {
    const content = await readFile(path, 'utf-8')
    const pkg = JSON.parse(content) as PackageData
    return pkg
  } catch (error) {
    console.error('Failed to load package.json:', error)
    return null
  }
}

/** Extract GitHub owner/repo from package.json or string */
export function parseGitHubRepo(
  repo?: string | { type: string; url: string }
): { owner: string; repo: string } | null {
  if (!repo) return null

  let url: string
  if (typeof repo === 'string') {
    url = repo
  } else if (repo.url) {
    url = repo.url
  } else {
    return null
  }

  // Parse GitHub URL formats:
  // - https://github.com/owner/repo
  // - git+https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/.]+)/,
    /github\.com\/([^/]+)\/([^/]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      }
    }
  }

  return null
}

/** Fetch GitHub repository data */
export async function fetchGitHubData(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubData | null> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'readme.mdx',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    )

    if (!response.ok) {
      console.error(`GitHub API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json() as any

    return {
      owner: data.owner.login,
      repo: data.name,
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      watchers: data.watchers_count || 0,
      openIssues: data.open_issues_count || 0,
      defaultBranch: data.default_branch || 'main',
      description: data.description,
      homepage: data.homepage,
      license: data.license?.spdx_id,
      topics: data.topics || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
    }
  } catch (error) {
    console.error('Failed to fetch GitHub data:', error)
    return null
  }
}

/** Fetch npm package data */
export async function fetchNpmData(packageName: string): Promise<NpmData | null> {
  try {
    // Fetch package metadata
    const pkgResponse = await fetch(
      `https://registry.npmjs.org/${packageName}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'readme.mdx',
        },
      }
    )

    if (!pkgResponse.ok) {
      console.error(`npm API error: ${pkgResponse.status} ${pkgResponse.statusText}`)
      return null
    }

    const pkgData = await pkgResponse.json() as any
    const latestVersion = pkgData['dist-tags']?.latest
    const versionData = pkgData.versions?.[latestVersion]

    // Fetch download stats
    const downloadsResponse = await fetch(
      `https://api.npmjs.org/downloads/point/last-month/${packageName}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'readme.mdx',
        },
      }
    )

    let downloads = {
      lastDay: 0,
      lastWeek: 0,
      lastMonth: 0,
    }

    if (downloadsResponse.ok) {
      const downloadData = await downloadsResponse.json() as any
      downloads.lastMonth = downloadData.downloads || 0

      // Fetch weekly stats
      const weekResponse = await fetch(
        `https://api.npmjs.org/downloads/point/last-week/${packageName}`
      )
      if (weekResponse.ok) {
        const weekData = await weekResponse.json() as any
        downloads.lastWeek = weekData.downloads || 0
      }

      // Fetch daily stats
      const dayResponse = await fetch(
        `https://api.npmjs.org/downloads/point/last-day/${packageName}`
      )
      if (dayResponse.ok) {
        const dayData = await dayResponse.json() as any
        downloads.lastDay = dayData.downloads || 0
      }
    }

    return {
      name: pkgData.name,
      version: latestVersion,
      downloads,
      publishedAt: versionData?.time || pkgData.time?.created,
      updatedAt: pkgData.time?.modified || pkgData.time?.[latestVersion],
    }
  } catch (error) {
    console.error('Failed to fetch npm data:', error)
    return null
  }
}
