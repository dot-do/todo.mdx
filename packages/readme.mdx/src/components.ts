/**
 * Component hydration logic for README.mdx
 */

import type { ComponentContext, BadgeOptions } from './types.js'

/** Generate badge markdown */
function badge(label: string, message: string, color: string, style: string = 'flat'): string {
  const encodedLabel = encodeURIComponent(label)
  const encodedMessage = encodeURIComponent(message)
  return `![${label}](https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${color}?style=${style})`
}

/** Render <Badges /> component */
export function renderBadges(context: ComponentContext, options: BadgeOptions = {}): string {
  const { pkg, github, npm } = context
  const style = options.style || 'flat'
  const badges: string[] = []

  // npm version badge
  if (options.npm !== false && pkg.name) {
    badges.push(
      `[![npm version](https://img.shields.io/npm/v/${pkg.name}?style=${style})](https://www.npmjs.com/package/${pkg.name})`
    )
  }

  // npm downloads
  if (options.npm !== false && npm) {
    badges.push(
      `[![npm downloads](https://img.shields.io/npm/dm/${pkg.name}?style=${style})](https://www.npmjs.com/package/${pkg.name})`
    )
  }

  // GitHub stars
  if (options.github !== false && github) {
    badges.push(
      `[![GitHub stars](https://img.shields.io/github/stars/${github.owner}/${github.repo}?style=${style})](https://github.com/${github.owner}/${github.repo}/stargazers)`
    )
  }

  // License
  if (options.license !== false && pkg.license) {
    const color = pkg.license === 'MIT' ? 'blue' : 'green'
    badges.push(badge('license', pkg.license, color, style))
  }

  // Build status (placeholder - would need CI integration)
  if (options.build && github) {
    badges.push(
      `[![Build Status](https://img.shields.io/github/actions/workflow/status/${github.owner}/${github.repo}/test.yml?style=${style})](https://github.com/${github.owner}/${github.repo}/actions)`
    )
  }

  return badges.join(' ') + '\n'
}

/** Render <Installation /> component */
export function renderInstallation(context: ComponentContext): string {
  const { pkg } = context
  const lines: string[] = []

  if (!pkg.name) {
    return '_Package name not found_\n'
  }

  lines.push('```bash')

  // npm install
  lines.push(`npm install ${pkg.name}`)
  lines.push('')

  // yarn alternative
  lines.push(`# or with yarn`)
  lines.push(`yarn add ${pkg.name}`)
  lines.push('')

  // pnpm alternative
  lines.push(`# or with pnpm`)
  lines.push(`pnpm add ${pkg.name}`)

  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

/** Render <Usage /> component */
export function renderUsage(context: ComponentContext): string {
  const { pkg } = context
  const lines: string[] = []

  lines.push('```typescript')
  lines.push(`import { /* ... */ } from '${pkg.name}'`)
  lines.push('')
  lines.push('// Your code here')
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

/** Render <API /> component */
export function renderAPI(context: ComponentContext): string {
  const { pkg } = context
  const lines: string[] = []

  // This is a placeholder - would need to parse TypeScript types
  lines.push('### API Reference')
  lines.push('')
  lines.push('_API documentation coming soon_')
  lines.push('')

  if (pkg.main) {
    lines.push(`**Main entry:** \`${pkg.main}\``)
    lines.push('')
  }

  if (pkg.types) {
    lines.push(`**Types:** \`${pkg.types}\``)
    lines.push('')
  }

  if (pkg.bin) {
    lines.push('### CLI Commands')
    lines.push('')
    if (typeof pkg.bin === 'string') {
      lines.push(`\`\`\`bash`)
      lines.push(`npx ${pkg.name}`)
      lines.push(`\`\`\``)
    } else {
      for (const [cmd, path] of Object.entries(pkg.bin)) {
        lines.push(`\`\`\`bash`)
        lines.push(`npx ${cmd}`)
        lines.push(`\`\`\``)
        lines.push('')
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** Render <Contributing /> component */
export function renderContributing(context: ComponentContext): string {
  const { pkg, github } = context
  const lines: string[] = []

  lines.push('Contributions are welcome! Please follow these steps:')
  lines.push('')
  lines.push('1. Fork the repository')
  lines.push('2. Create a feature branch (`git checkout -b feature/amazing-feature`)')
  lines.push('3. Commit your changes (`git commit -m "Add amazing feature"`)')
  lines.push('4. Push to the branch (`git push origin feature/amazing-feature`)')
  lines.push('5. Open a Pull Request')
  lines.push('')

  if (github) {
    lines.push(`**Repository:** [${github.owner}/${github.repo}](https://github.com/${github.owner}/${github.repo})`)
    lines.push('')
    lines.push(`**Issues:** [Report a bug or request a feature](https://github.com/${github.owner}/${github.repo}/issues)`)
    lines.push('')
  }

  return lines.join('\n')
}

/** Render <License /> component */
export function renderLicense(context: ComponentContext): string {
  const { pkg } = context
  const lines: string[] = []

  if (!pkg.license) {
    return '_License not specified_\n'
  }

  lines.push(`This project is licensed under the ${pkg.license} License.`)
  lines.push('')

  if (pkg.author) {
    const authorName = typeof pkg.author === 'string' ? pkg.author : pkg.author.name
    lines.push(`**Author:** ${authorName}`)
    lines.push('')
  }

  return lines.join('\n')
}

/** Render <Package /> component - shows package.json info */
export function renderPackage(context: ComponentContext): string {
  const { pkg } = context
  const lines: string[] = []

  if (pkg.description) {
    lines.push(pkg.description)
    lines.push('')
  }

  if (pkg.keywords && pkg.keywords.length > 0) {
    lines.push(`**Keywords:** ${pkg.keywords.join(', ')}`)
    lines.push('')
  }

  if (pkg.version) {
    lines.push(`**Version:** ${pkg.version}`)
    lines.push('')
  }

  return lines.join('\n')
}

/** Render <Stats /> component - GitHub/npm stats */
export function renderStats(context: ComponentContext): string {
  const { github, npm } = context
  const lines: string[] = []

  const stats: string[] = []

  if (github) {
    stats.push(`${github.stars} stars`)
    stats.push(`${github.forks} forks`)
    stats.push(`${github.openIssues} open issues`)
  }

  if (npm) {
    stats.push(`${npm.downloads.lastMonth.toLocaleString()} downloads/month`)
  }

  if (stats.length > 0) {
    lines.push(stats.join(' · '))
    lines.push('')
  }

  return lines.join('\n')
}
