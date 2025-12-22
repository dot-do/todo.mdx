import type { Field, GroupField } from 'payload'

/**
 * Shared option constants for approval gates fields.
 */
export const riskThresholdOptions = [
  { label: 'Low - Approve all automatically', value: 'low' },
  { label: 'Medium - Approve low-risk changes', value: 'medium' },
  { label: 'High - Require approval for all changes', value: 'high' },
] as const

export const issueTypeOptions = [
  { label: 'Task', value: 'task' },
  { label: 'Bug', value: 'bug' },
  { label: 'Feature', value: 'feature' },
  { label: 'Epic', value: 'epic' },
] as const

/**
 * Default values for org-level approval gates.
 */
export const approvalGatesDefaults = {
  requireHumanApproval: true,
  allowFullAutonomy: false,
  maxBudgetPerDay: 100,
  maxAgentSpawnsPerHour: 10,
  riskThreshold: 'high',
  criticalPaths: ['**/auth/**', '**/payment/**', '**/security/**', '**/.env*'],
  autoApproveLabels: ['auto-approve', 'safe-change'],
  requireApprovalLabels: ['needs-review', 'breaking-change', 'security'],
} as const

/**
 * Configuration options for createApprovalGatesGroup factory.
 */
export interface ApprovalGatesOptions {
  /**
   * Whether this is for organization-level (installation) or repo-level.
   * Org-level fields have default values; repo-level fields have conditional visibility.
   */
  level: 'org' | 'repo'
}

/**
 * Creates the triggers sub-group field for approval gates.
 */
function createTriggersGroup(level: 'org' | 'repo'): GroupField {
  const conditionFn = level === 'repo'
    ? (data: Record<string, unknown>) => !(data.approvalGates as Record<string, unknown>)?.inheritFromOrg
    : undefined

  return {
    name: 'triggers',
    type: 'group',
    admin: {
      description: level === 'org'
        ? 'Conditions that trigger approval requirements (org-wide defaults)'
        : 'Conditions that trigger approval requirements',
      ...(conditionFn && { condition: conditionFn }),
    },
    fields: [
      {
        name: 'labels',
        type: 'array',
        admin: {
          description: 'PR/issue labels that trigger approval',
        },
        fields: [
          {
            name: 'label',
            type: 'text',
            required: true,
          },
        ],
      },
      {
        name: 'types',
        type: 'array',
        admin: {
          description: 'Issue types that trigger approval',
        },
        fields: [
          {
            name: 'type',
            type: 'select',
            required: true,
            options: [...issueTypeOptions],
          },
        ],
      },
      {
        name: 'filesChanged',
        type: 'array',
        admin: {
          description: 'File path patterns that trigger approval (glob patterns)',
        },
        fields: [
          {
            name: 'pattern',
            type: 'text',
            required: true,
            admin: {
              description: 'Glob pattern (e.g., src/auth/**, *.sql)',
            },
          },
        ],
      },
      {
        name: 'riskScore',
        type: 'number',
        min: 0,
        max: 100,
        admin: {
          description: 'Risk score threshold (0-100) that triggers approval',
        },
      },
    ],
  }
}

/**
 * Creates the approvers array field.
 */
function createApproversField(level: 'org' | 'repo'): Field {
  const conditionFn = level === 'repo'
    ? (data: Record<string, unknown>) => !(data.approvalGates as Record<string, unknown>)?.inheritFromOrg
    : undefined

  return {
    name: 'approvers',
    type: 'array',
    admin: {
      description: level === 'org'
        ? 'GitHub usernames who can approve (org-wide default)'
        : 'GitHub usernames who can approve',
      ...(conditionFn && { condition: conditionFn }),
    },
    fields: [
      {
        name: 'username',
        type: 'text',
        required: true,
        admin: {
          description: 'GitHub username',
        },
      },
    ],
  }
}

/**
 * Creates the teamApprovers array field.
 */
function createTeamApproversField(level: 'org' | 'repo'): Field {
  const conditionFn = level === 'repo'
    ? (data: Record<string, unknown>) => !(data.approvalGates as Record<string, unknown>)?.inheritFromOrg
    : undefined

  return {
    name: 'teamApprovers',
    type: 'array',
    admin: {
      description: 'GitHub teams who can approve (format: org/team-slug)',
      ...(conditionFn && { condition: conditionFn }),
    },
    fields: [
      {
        name: 'team',
        type: 'text',
        required: true,
        admin: {
          description: 'GitHub team in format: org/team-slug',
        },
      },
    ],
  }
}

/**
 * Factory function to create the approvalGates group field.
 *
 * @param options - Configuration options
 * @returns A Payload GroupField for approval gates
 *
 * @example
 * // For Installations (org-level defaults)
 * createApprovalGatesGroup({ level: 'org' })
 *
 * @example
 * // For Repos (with inheritFromOrg option)
 * createApprovalGatesGroup({ level: 'repo' })
 */
export function createApprovalGatesGroup(options: ApprovalGatesOptions): GroupField {
  const { level } = options
  const isOrg = level === 'org'

  const conditionFn = !isOrg
    ? (data: Record<string, unknown>) => !(data.approvalGates as Record<string, unknown>)?.inheritFromOrg
    : undefined

  const fields: Field[] = []

  // Repo-level has inheritFromOrg checkbox first
  if (!isOrg) {
    fields.push({
      name: 'inheritFromOrg',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Inherit approval gate settings from organization',
      },
    })
  }

  // requireHumanApproval
  fields.push({
    name: 'requireHumanApproval',
    type: 'checkbox',
    ...(isOrg && { defaultValue: approvalGatesDefaults.requireHumanApproval }),
    admin: {
      description: isOrg
        ? 'Require human approval before merging PRs (default for all repos)'
        : 'Require human approval before merging PRs',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // allowFullAutonomy
  fields.push({
    name: 'allowFullAutonomy',
    type: 'checkbox',
    ...(isOrg && { defaultValue: approvalGatesDefaults.allowFullAutonomy }),
    admin: {
      description: 'Allow fully autonomous operation (no human approval required)',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // maxBudgetPerDay
  fields.push({
    name: 'maxBudgetPerDay',
    type: 'number',
    ...(isOrg && { defaultValue: approvalGatesDefaults.maxBudgetPerDay }),
    admin: {
      description: isOrg
        ? 'Maximum daily budget in USD for agent operations'
        : 'Maximum daily budget in USD for this repo',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // maxAgentSpawnsPerHour
  fields.push({
    name: 'maxAgentSpawnsPerHour',
    type: 'number',
    ...(isOrg && { defaultValue: approvalGatesDefaults.maxAgentSpawnsPerHour }),
    admin: {
      description: isOrg
        ? 'Rate limit: max agent spawns per hour'
        : 'Rate limit: max agent spawns per hour for this repo',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // riskThreshold
  fields.push({
    name: 'riskThreshold',
    type: 'select',
    options: [...riskThresholdOptions],
    ...(isOrg && { defaultValue: approvalGatesDefaults.riskThreshold }),
    admin: {
      description: 'Risk threshold for automatic approval',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // criticalPaths
  fields.push({
    name: 'criticalPaths',
    type: 'json',
    ...(isOrg && { defaultValue: approvalGatesDefaults.criticalPaths }),
    admin: {
      description: isOrg
        ? 'File paths that always require human approval (glob patterns)'
        : 'Additional file paths that require human approval (glob patterns)',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // autoApproveLabels
  fields.push({
    name: 'autoApproveLabels',
    type: 'json',
    ...(isOrg && { defaultValue: approvalGatesDefaults.autoApproveLabels }),
    admin: {
      description: 'Issue labels that allow automatic merge without human approval',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // requireApprovalLabels
  fields.push({
    name: 'requireApprovalLabels',
    type: 'json',
    ...(isOrg && { defaultValue: approvalGatesDefaults.requireApprovalLabels }),
    admin: {
      description: 'Issue labels that always require human approval',
      ...(conditionFn && { condition: conditionFn }),
    },
  })

  // triggers group
  fields.push(createTriggersGroup(level))

  // approvers array
  fields.push(createApproversField(level))

  // teamApprovers array
  fields.push(createTeamApproversField(level))

  return {
    name: 'approvalGates',
    type: 'group',
    admin: {
      description: isOrg
        ? 'Default approval gate settings for all repos in this installation'
        : 'Approval gate settings for this repo (overrides org-level defaults)',
    },
    fields,
  }
}
