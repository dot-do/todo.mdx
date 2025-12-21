import type { ToolConfig, ResolvedTools, Connection } from './types'

/**
 * Resolves tool configuration from a hierarchy of configs.
 *
 * Merges configs from org → repo → project → issue → assignment levels.
 *
 * Rules:
 * - `enabled` accumulates down the hierarchy (union)
 * - `disabled` overrides at each level (later levels can disable previously enabled tools)
 * - `requiredApps` accumulates down the hierarchy (union)
 * - `includeDefaults` defaults to true at the top level, can be overridden
 *
 * @param hierarchy Array of ToolConfig from highest (org) to lowest (assignment) level
 * @param connections Available connections for the user/context
 * @param defaultTools Optional default tool names to include when includeDefaults is true
 * @returns ResolvedTools with final enabled/required lists and connections
 *
 * @example
 * ```typescript
 * const orgConfig = { enabled: ['GitHub', 'Slack'], requiredApps: ['GitHub'] }
 * const repoConfig = { disabled: ['Slack'], enabled: ['Linear'] }
 * const issueConfig = { requiredApps: ['Linear'] }
 *
 * const resolved = resolveToolConfig([orgConfig, repoConfig, issueConfig], connections)
 * // Result: {
 * //   enabled: ['GitHub', 'Linear'],  // Slack disabled, Linear added
 * //   required: ['GitHub', 'Linear'], // Both required
 * //   connections: [...]
 * // }
 * ```
 */
export function resolveToolConfig(
  hierarchy: ToolConfig[],
  connections: Connection[] = [],
  defaultTools: string[] = []
): ResolvedTools {
  // Start with defaults if includeDefaults is true at any level
  const shouldIncludeDefaults = hierarchy.some(config => config.includeDefaults !== false)
  const enabledSet = new Set<string>(shouldIncludeDefaults ? defaultTools : [])
  const requiredSet = new Set<string>()
  const disabledSet = new Set<string>()

  // Process hierarchy from top (org) to bottom (assignment)
  for (const config of hierarchy) {
    // Add enabled tools
    if (config.enabled) {
      for (const tool of config.enabled) {
        enabledSet.add(tool)
      }
    }

    // Track disabled tools (these override any enabled)
    if (config.disabled) {
      for (const tool of config.disabled) {
        disabledSet.add(tool)
      }
    }

    // Accumulate required apps
    if (config.requiredApps) {
      for (const app of config.requiredApps) {
        requiredSet.add(app)
      }
    }
  }

  // Remove disabled tools from enabled set
  disabledSet.forEach(disabled => {
    enabledSet.delete(disabled)
  })

  // Filter connections to only active ones
  const activeConnections = connections.filter(conn => conn.status === 'active')

  return {
    enabled: Array.from(enabledSet).sort(),
    required: Array.from(requiredSet).sort(),
    connections: activeConnections
  }
}

/**
 * Validates that all required apps have active connections.
 *
 * @param resolved ResolvedTools from resolveToolConfig
 * @returns Object with validation result and missing apps
 */
export function validateRequiredApps(resolved: ResolvedTools): {
  valid: boolean
  missingApps: string[]
} {
  const connectedApps = new Set(resolved.connections.map(conn => conn.app))
  const missingApps = resolved.required.filter(app => !connectedApps.has(app))

  return {
    valid: missingApps.length === 0,
    missingApps
  }
}

/**
 * Extracts app name from a full tool name.
 *
 * @param fullToolName Tool name in format 'app.toolName' (e.g., 'github.createPullRequest')
 * @returns App name in PascalCase (e.g., 'GitHub')
 *
 * @example
 * ```typescript
 * extractAppFromToolName('github.createPullRequest') // 'GitHub'
 * extractAppFromToolName('linear.createIssue') // 'Linear'
 * extractAppFromToolName('slack.sendMessage') // 'Slack'
 * ```
 */
export function extractAppFromToolName(fullToolName: string): string {
  const [app] = fullToolName.split('.')
  if (!app) return ''

  // Handle special cases for proper casing
  const specialCases: Record<string, string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    linkedin: 'LinkedIn',
    youtube: 'YouTube'
  }

  const lowerApp = app.toLowerCase()
  if (specialCases[lowerApp]) {
    return specialCases[lowerApp]
  }

  // Convert from camelCase to PascalCase
  return app.charAt(0).toUpperCase() + app.slice(1)
}

/**
 * Filters enabled tools to only those with available connections.
 *
 * @param resolved ResolvedTools from resolveToolConfig
 * @returns Array of tool names that have active connections
 */
export function getAvailableTools(resolved: ResolvedTools): string[] {
  const connectedApps = new Set(resolved.connections.map(conn => conn.app))

  return resolved.enabled.filter(toolName => {
    const app = extractAppFromToolName(toolName)
    return connectedApps.has(app)
  })
}
