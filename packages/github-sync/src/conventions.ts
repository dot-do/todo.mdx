/**
 * GitHub conventions configuration
 *
 * Defines how beads concepts map to GitHub labels and markdown patterns.
 * GitHub lacks native support for dependencies, epics, priority, and in-progress status,
 * so we use configurable conventions via labels and markdown patterns.
 */

export interface GitHubConventions {
  labels: {
    // Map GitHub label names to beads types
    type: Record<string, 'bug' | 'feature' | 'task' | 'epic' | 'chore'>
    // Map GitHub label names to priority numbers
    priority: Record<string, 0 | 1 | 2 | 3 | 4>
    // Label that indicates in-progress status
    status: { inProgress?: string }
  }

  dependencies: {
    // Regex to extract dependency refs from issue body
    pattern: string  // e.g., "Depends on:\\s*(.+)"
    // Separator between issue refs
    separator: string  // e.g., ", "
    // Pattern for blocks refs
    blocksPattern?: string
  }

  epics: {
    // Label prefix for epics (e.g., "epic:")
    labelPrefix?: string
    // Regex to find parent ref in body
    bodyPattern?: string  // e.g., "Parent:\\s*#(\\d+)"
  }
}

export const defaultConventions: GitHubConventions = {
  labels: {
    type: {
      'bug': 'bug',
      'enhancement': 'feature',
      'task': 'task',
      'epic': 'epic',
      'chore': 'chore',
    },
    priority: {
      'P0': 0,
      'P1': 1,
      'P2': 2,
      'P3': 3,
      'P4': 4,
    },
    status: {
      inProgress: 'status:in-progress',
    },
  },
  dependencies: {
    pattern: 'Depends on:\\s*(.+)',
    separator: ', ',
    blocksPattern: 'Blocks:\\s*(.+)',
  },
  epics: {
    labelPrefix: 'epic:',
    bodyPattern: 'Parent:\\s*#(\\d+)',
  },
}

/**
 * Deep merge conventions, combining custom config with defaults
 */
export function mergeConventions(
  custom: Partial<GitHubConventions>,
  defaults: GitHubConventions = defaultConventions
): GitHubConventions {
  return {
    labels: {
      type: {
        ...defaults.labels.type,
        ...(custom.labels?.type || {}),
      },
      priority: {
        ...defaults.labels.priority,
        ...(custom.labels?.priority || {}),
      },
      status: {
        inProgress: custom.labels?.status?.inProgress ?? defaults.labels.status.inProgress,
      },
    },
    dependencies: {
      pattern: custom.dependencies?.pattern ?? defaults.dependencies.pattern,
      separator: custom.dependencies?.separator ?? defaults.dependencies.separator,
      blocksPattern: custom.dependencies?.blocksPattern ?? defaults.dependencies.blocksPattern,
    },
    epics: {
      labelPrefix: custom.epics?.labelPrefix ?? defaults.epics.labelPrefix,
      bodyPattern: custom.epics?.bodyPattern ?? defaults.epics.bodyPattern,
    },
  }
}
