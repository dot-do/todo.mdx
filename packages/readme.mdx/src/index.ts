/**
 * readme.mdx - MDX components that compile to README.md with live data
 */

// Types
export type {
  ReadmeConfig,
  PackageData,
  GitHubData,
  NpmData,
  BadgeOptions,
  ComponentContext,
} from './types.js'

// Data fetching
export {
  loadPackageData,
  parseGitHubRepo,
  fetchGitHubData,
  fetchNpmData,
} from './data.js'

// Component rendering
export {
  renderBadges,
  renderInstallation,
  renderUsage,
  renderAPI,
  renderContributing,
  renderLicense,
  renderPackage,
  renderStats,
} from './components.js'

// Compilation
export {
  compile,
  DEFAULT_TEMPLATE,
} from './compiler.js'
