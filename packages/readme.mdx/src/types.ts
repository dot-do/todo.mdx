/**
 * Core types for readme.mdx
 */

export interface ReadmeConfig {
  /** Path to package.json */
  packagePath?: string
  /** GitHub repository (owner/repo) */
  repo?: string
  /** Include GitHub badges */
  badges?: boolean
  /** Include npm stats */
  npmStats?: boolean
  /** Output format */
  format?: 'md' | 'mdx'
}

export interface PackageData {
  name: string
  version: string
  description?: string
  license?: string
  author?: string | { name: string; email?: string; url?: string }
  repository?: string | { type: string; url: string }
  homepage?: string
  bugs?: string | { url: string }
  keywords?: string[]
  main?: string
  types?: string
  bin?: Record<string, string> | string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  engines?: Record<string, string>
}

export interface GitHubData {
  owner: string
  repo: string
  stars: number
  forks: number
  watchers: number
  openIssues: number
  defaultBranch: string
  description?: string
  homepage?: string
  license?: string
  topics?: string[]
  createdAt: string
  updatedAt: string
  pushedAt: string
}

export interface NpmData {
  name: string
  version: string
  downloads: {
    lastDay: number
    lastWeek: number
    lastMonth: number
  }
  publishedAt: string
  updatedAt: string
}

export interface BadgeOptions {
  npm?: boolean
  github?: boolean
  license?: boolean
  build?: boolean
  coverage?: boolean
  style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge' | 'social'
}

export interface ComponentContext {
  pkg: PackageData
  github?: GitHubData
  npm?: NpmData
  config: ReadmeConfig
}
