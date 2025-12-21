// 'GitHub' → 'github' (for bindings)
// 'GoogleDrive' → 'googleDrive' (PascalCase to camelCase)
export const toBindingName = (app: string): string => {
  // Handle known apps with specific casing
  const casing: Record<string, string> = {
    'GitHub': 'github',
    'Linear': 'linear',
    'Slack': 'slack',
    'GoogleDrive': 'googleDrive',
    'MicrosoftTeams': 'microsoftTeams',
  }

  return casing[app] ?? app.charAt(0).toLowerCase() + app.slice(1)
}

// 'github' → 'GitHub' (for storage)
// For now, this is a simple uppercasing, but could be enhanced with a lookup table
// for proper casing like 'GitHub', 'Linear', etc.
export const toStorageName = (app: string): string => {
  // Handle known apps with specific casing
  const casing: Record<string, string> = {
    'github': 'GitHub',
    'linear': 'Linear',
    'slack': 'Slack',
    'googledrive': 'GoogleDrive',
    'microsoftteams': 'MicrosoftTeams',
  }

  const lower = app.toLowerCase()
  return casing[lower] ?? app.charAt(0).toUpperCase() + app.slice(1)
}

// Build full tool name: 'GitHub', 'createPullRequest' → 'github.createPullRequest'
export const toFullToolName = (app: string, action: string): string =>
  `${toBindingName(app)}.${action}`
