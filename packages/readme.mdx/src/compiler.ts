/**
 * Compiler for README.mdx → README.md
 * Hydrates templates with live data from package.json, GitHub, npm
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ReadmeConfig, ComponentContext, BadgeOptions } from './types.js'
import { loadPackageData, parseGitHubRepo, fetchGitHubData, fetchNpmData } from './data.js'
import {
  renderBadges,
  renderInstallation,
  renderUsage,
  renderAPI,
  renderContributing,
  renderLicense,
  renderPackage,
  renderStats,
} from './components.js'

/** Frontmatter regex */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Simple YAML parser */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const line of yaml.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    // Remove quotes
    if (typeof value === 'string' && /^["'].*["']$/.test(value)) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/** Parse badge options from component attributes */
function parseBadgeOptions(attributes: string): BadgeOptions {
  const options: BadgeOptions = {}

  // Extract style
  const styleMatch = attributes.match(/style=["']?(\w+)["']?/)
  if (styleMatch) {
    options.style = styleMatch[1] as any
  }

  // Extract boolean flags
  if (attributes.includes('npm')) options.npm = !attributes.includes('npm={false}')
  if (attributes.includes('github')) options.github = !attributes.includes('github={false}')
  if (attributes.includes('license')) options.license = !attributes.includes('license={false}')
  if (attributes.includes('build')) options.build = !attributes.includes('build={false}')
  if (attributes.includes('coverage')) options.coverage = !attributes.includes('coverage={false}')

  return options
}

/** Compile README.mdx to README.md */
export async function compile(options: {
  input?: string
  output?: string
  config?: ReadmeConfig
} = {}): Promise<string> {
  const {
    input = 'README.mdx',
    output = 'README.md',
    config = {},
  } = options

  // Read template
  let template: string
  try {
    template = await readFile(input, 'utf-8')
  } catch {
    throw new Error(`Template file not found: ${input}`)
  }

  // Parse frontmatter
  let frontmatter: Record<string, unknown> = {}
  let content = template

  const match = template.match(FRONTMATTER_REGEX)
  if (match) {
    frontmatter = parseYaml(match[1])
    content = template.slice(match[0].length)
  }

  // Merge config from frontmatter
  const finalConfig: ReadmeConfig = {
    ...config,
    packagePath: frontmatter.packagePath as string ?? config.packagePath,
    repo: frontmatter.repo as string ?? config.repo,
    badges: frontmatter.badges as boolean ?? config.badges ?? true,
    npmStats: frontmatter.npmStats as boolean ?? config.npmStats ?? true,
  }

  // Load package data
  const pkg = await loadPackageData(finalConfig.packagePath)
  if (!pkg) {
    throw new Error('Failed to load package.json')
  }

  // Parse GitHub repo
  const githubInfo = finalConfig.repo
    ? { owner: finalConfig.repo.split('/')[0], repo: finalConfig.repo.split('/')[1] }
    : parseGitHubRepo(pkg.repository)

  // Fetch external data
  const [github, npm] = await Promise.all([
    githubInfo ? fetchGitHubData(githubInfo.owner, githubInfo.repo, process.env.GITHUB_TOKEN) : null,
    finalConfig.npmStats && pkg.name ? fetchNpmData(pkg.name) : null,
  ])

  // Build context
  const context: ComponentContext = {
    pkg,
    github: github || undefined,
    npm: npm || undefined,
    config: finalConfig,
  }

  // Hydrate template
  const result = hydrateTemplate(content, context, frontmatter)

  // Write output
  await writeFile(output, result)

  return result
}

/** Hydrate template with component data */
function hydrateTemplate(
  template: string,
  context: ComponentContext,
  frontmatter: Record<string, unknown>
): string {
  let result = template

  // Replace {variable} placeholders
  result = result.replace(/\{(\w+)\}/g, (_, key) => {
    if (key === 'name') return context.pkg.name || ''
    if (key === 'version') return context.pkg.version || ''
    if (key === 'description') return context.pkg.description || ''
    if (key === 'license') return context.pkg.license || ''
    if (frontmatter[key] !== undefined) {
      return String(frontmatter[key])
    }
    return `{${key}}`
  })

  // Replace component tags
  result = result.replace(/<Badges\s*([^>]*)\s*\/>/g, (_, attrs) => {
    const options = parseBadgeOptions(attrs)
    return renderBadges(context, options)
  })

  result = result.replace(/<Installation\s*\/>/g, () => {
    return renderInstallation(context)
  })

  result = result.replace(/<Usage\s*\/>/g, () => {
    return renderUsage(context)
  })

  result = result.replace(/<API\s*\/>/g, () => {
    return renderAPI(context)
  })

  result = result.replace(/<Contributing\s*\/>/g, () => {
    return renderContributing(context)
  })

  result = result.replace(/<License\s*\/>/g, () => {
    return renderLicense(context)
  })

  result = result.replace(/<Package\s*\/>/g, () => {
    return renderPackage(context)
  })

  result = result.replace(/<Stats\s*\/>/g, () => {
    return renderStats(context)
  })

  // Clean up extra newlines
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

/** Default README.mdx template */
export const DEFAULT_TEMPLATE = `---
title: {name}
badges: true
npmStats: true
---

# {name}

<Badges />

<Package />

## Installation

<Installation />

## Usage

<Usage />

## API

<API />

## Contributing

<Contributing />

## License

<License />
`
