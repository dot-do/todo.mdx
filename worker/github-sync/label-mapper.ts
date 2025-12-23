/**
 * Label mapper: Converts GitHub labels to beads type/priority/status
 *
 * Maps GitHub labels to beads fields using configurable conventions.
 * Handles defaults, multiple matches, and returns unconsumed labels.
 */

import type { GitHubConventions } from './conventions'

export interface MappedFields {
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  priority: 0 | 1 | 2 | 3 | 4
  status: 'open' | 'in_progress' | 'closed'
  remainingLabels: string[]  // Labels not consumed by mapping
}

/**
 * Map GitHub labels to beads fields
 *
 * @param labels - Array of GitHub label names
 * @param githubState - GitHub issue state ('open' or 'closed')
 * @param conventions - Label mapping conventions
 * @returns Mapped fields with type, priority, status, and remaining labels
 */
export function mapLabels(
  labels: string[],
  githubState: 'open' | 'closed',
  conventions: GitHubConventions
): MappedFields {
  // Track which labels we've consumed
  const consumedLabels = new Set<string>()

  // Default values
  let type: MappedFields['type'] = 'task'
  let priority: MappedFields['priority'] = 2
  let status: MappedFields['status'] = githubState === 'closed' ? 'closed' : 'open'

  // Map type: first matching label wins
  for (const label of labels) {
    if (label in conventions.labels.type) {
      type = conventions.labels.type[label]
      consumedLabels.add(label)
      break  // First match wins
    }
  }

  // Map priority: highest priority (lowest number) wins
  let foundPriority = false
  for (const label of labels) {
    if (label in conventions.labels.priority) {
      const labelPriority = conventions.labels.priority[label]
      if (!foundPriority || labelPriority < priority) {
        priority = labelPriority
        foundPriority = true
      }
      consumedLabels.add(label)
    }
  }

  // Map status: check for in-progress label, but closed state always wins
  if (githubState === 'closed') {
    status = 'closed'
  } else {
    // Check for in-progress label
    const inProgressLabel = conventions.labels.status.inProgress
    if (inProgressLabel && labels.includes(inProgressLabel)) {
      status = 'in_progress'
      consumedLabels.add(inProgressLabel)
    }
  }

  // Collect remaining labels (not consumed by mapping)
  const remainingLabels = labels.filter(label => {
    // Filter out empty strings and consumed labels
    return label !== '' && !consumedLabels.has(label)
  })

  return {
    type,
    priority,
    status,
    remainingLabels,
  }
}
