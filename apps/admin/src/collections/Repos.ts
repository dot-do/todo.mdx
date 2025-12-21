import type { CollectionConfig } from 'payload'
import { isInternalRequest, internalOrAdmin } from '../access/internal'

/**
 * GitHub repositories.
 * Repos linked to GitHub App installations for todo.mdx sync.
 */
export const Repos: CollectionConfig = {
  slug: 'repos',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'installation', 'syncEnabled', 'lastSyncAt'],
    group: 'GitHub',
  },
  access: {
    // Users can read repos they have access to via installation
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'installation.users.id': { equals: user.id },
      }
    },
    create: internalOrAdmin,
    update: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      // Users can update repos they have access to
      return {
        'installation.users.id': { equals: user.id },
      }
    },
    delete: internalOrAdmin,
  },
  fields: [
    {
      name: 'githubId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'GitHub repository ID',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Repository name (without owner)',
      },
    },
    {
      name: 'fullName',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Full name (owner/repo)',
      },
    },
    {
      name: 'owner',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Repository owner (user or org login)',
      },
    },
    {
      name: 'private',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'defaultBranch',
      type: 'text',
      defaultValue: 'main',
    },
    {
      name: 'installation',
      type: 'relationship',
      relationTo: 'installations',
      required: true,
      index: true,
    },
    // Sync configuration
    {
      name: 'syncEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether to sync issues with GitHub',
      },
    },
    {
      name: 'syncPath',
      type: 'text',
      defaultValue: '.todo',
      admin: {
        description: 'Path to todo.mdx file in the repo',
      },
    },
    {
      name: 'lastSyncAt',
      type: 'date',
      admin: {
        description: 'Last successful sync timestamp',
      },
    },
    {
      name: 'syncStatus',
      type: 'select',
      options: [
        { label: 'Idle', value: 'idle' },
        { label: 'Syncing', value: 'syncing' },
        { label: 'Error', value: 'error' },
      ],
      defaultValue: 'idle',
    },
    {
      name: 'syncError',
      type: 'text',
      admin: {
        description: 'Last sync error message',
        condition: (data) => data.syncStatus === 'error',
      },
    },
    // Review configuration
    {
      name: 'reviewConfig',
      type: 'group',
      admin: {
        description: 'PR code review configuration',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether PR review is enabled for this repo',
          },
        },
        {
          name: 'reviewers',
          type: 'array',
          admin: {
            description: 'Ordered list of reviewers',
            condition: (data) => data.reviewConfig?.enabled,
          },
          fields: [
            {
              name: 'agent',
              type: 'relationship',
              relationTo: 'agents',
              required: true,
              admin: {
                description: 'Agent to review this PR',
              },
            },
          ],
        },
        {
          name: 'autoMerge',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Auto-merge when all reviewers approve',
            condition: (data) => data.reviewConfig?.enabled,
          },
        },
        {
          name: 'requireHumanApproval',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Require at least one human approval',
            condition: (data) => data.reviewConfig?.enabled,
          },
        },
      ],
    },
    // Approval gate configuration (repo level overrides)
    {
      name: 'approvalGates',
      type: 'group',
      admin: {
        description: 'Approval gate settings for this repo (overrides org-level defaults)',
      },
      fields: [
        {
          name: 'inheritFromOrg',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Inherit approval gate settings from organization',
          },
        },
        {
          name: 'requireHumanApproval',
          type: 'checkbox',
          admin: {
            description: 'Require human approval before merging PRs',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'allowFullAutonomy',
          type: 'checkbox',
          admin: {
            description: 'Allow fully autonomous operation (no human approval required)',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'maxBudgetPerDay',
          type: 'number',
          admin: {
            description: 'Maximum daily budget in USD for this repo',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'maxAgentSpawnsPerHour',
          type: 'number',
          admin: {
            description: 'Rate limit: max agent spawns per hour for this repo',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'riskThreshold',
          type: 'select',
          options: [
            { label: 'Low - Approve all automatically', value: 'low' },
            { label: 'Medium - Approve low-risk changes', value: 'medium' },
            { label: 'High - Require approval for all changes', value: 'high' },
          ],
          admin: {
            description: 'Risk threshold for automatic approval',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'criticalPaths',
          type: 'json',
          admin: {
            description: 'Additional file paths that require human approval (glob patterns)',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'autoApproveLabels',
          type: 'json',
          admin: {
            description: 'Issue labels that allow automatic merge without human approval',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        {
          name: 'requireApprovalLabels',
          type: 'json',
          admin: {
            description: 'Issue labels that always require human approval',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
          },
        },
        // Triggers - conditions that trigger approval requirements
        {
          name: 'triggers',
          type: 'group',
          admin: {
            description: 'Conditions that trigger approval requirements',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
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
                  options: [
                    { label: 'Task', value: 'task' },
                    { label: 'Bug', value: 'bug' },
                    { label: 'Feature', value: 'feature' },
                    { label: 'Epic', value: 'epic' },
                  ],
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
        },
        // Approvers - who can approve
        {
          name: 'approvers',
          type: 'array',
          admin: {
            description: 'GitHub usernames who can approve',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
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
        },
        {
          name: 'teamApprovers',
          type: 'array',
          admin: {
            description: 'GitHub teams who can approve (format: org/team-slug)',
            condition: (data) => !data.approvalGates?.inheritFromOrg,
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
        },
      ],
    },
    // Tool configuration (repo level)
    {
      name: 'toolConfig',
      type: 'json',
      admin: {
        description: 'Tool configuration for this repository (inherits from installation)',
      },
    },
    // Cost controls and budget tracking
    {
      name: 'costControls',
      type: 'group',
      admin: {
        description: 'Cost control settings and spend tracking for agent operations',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Whether cost controls are enabled for this repo',
          },
        },
        {
          name: 'inheritFromOrg',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Inherit budget limits from organization installation',
            condition: (data) => data.costControls?.enabled,
          },
        },
        // Budget limits
        {
          name: 'monthlyBudget',
          type: 'number',
          admin: {
            description: 'Maximum monthly budget in USD for Claude API spend (overrides org-level if not inheriting)',
            condition: (data) => data.costControls?.enabled && !data.costControls?.inheritFromOrg,
          },
        },
        {
          name: 'dailySessionLimit',
          type: 'number',
          admin: {
            description: 'Maximum number of agent sessions per day (overrides org-level if not inheriting)',
            condition: (data) => data.costControls?.enabled && !data.costControls?.inheritFromOrg,
          },
        },
        {
          name: 'maxConcurrentSessions',
          type: 'number',
          admin: {
            description: 'Maximum number of concurrent agent sessions (overrides org-level if not inheriting)',
            condition: (data) => data.costControls?.enabled && !data.costControls?.inheritFromOrg,
          },
        },
        // Alert configuration
        {
          name: 'alertThresholds',
          type: 'array',
          defaultValue: [
            { percentage: 50, notified: false },
            { percentage: 80, notified: false },
            { percentage: 100, notified: false },
          ],
          admin: {
            description: 'Budget alert thresholds (percentage of monthly budget)',
            condition: (data) => data.costControls?.enabled,
          },
          fields: [
            {
              name: 'percentage',
              type: 'number',
              required: true,
              admin: {
                description: 'Threshold percentage (e.g., 50 for 50%)',
              },
            },
            {
              name: 'notified',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Whether notification has been sent for this threshold this month',
              },
            },
            {
              name: 'lastNotifiedAt',
              type: 'date',
              admin: {
                description: 'When the last notification was sent',
              },
            },
          ],
        },
        {
          name: 'alertEmails',
          type: 'array',
          admin: {
            description: 'Email addresses to notify when budget thresholds are reached',
            condition: (data) => data.costControls?.enabled,
          },
          fields: [
            {
              name: 'email',
              type: 'email',
              required: true,
            },
          ],
        },
        // Current tracking (read-only, updated by system)
        {
          name: 'currentMonthSpend',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Current month spend in USD (auto-calculated from agent sessions)',
            readOnly: true,
            condition: (data) => data.costControls?.enabled,
          },
        },
        {
          name: 'currentMonthStart',
          type: 'date',
          admin: {
            description: 'Start date of current month tracking period',
            readOnly: true,
            condition: (data) => data.costControls?.enabled,
          },
        },
        {
          name: 'todaySessionCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Number of agent sessions started today (auto-calculated)',
            readOnly: true,
            condition: (data) => data.costControls?.enabled,
          },
        },
        {
          name: 'todayDate',
          type: 'date',
          admin: {
            description: 'Date for today session count tracking',
            readOnly: true,
            condition: (data) => data.costControls?.enabled,
          },
        },
        {
          name: 'activeSessions',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Number of currently active agent sessions',
            readOnly: true,
            condition: (data) => data.costControls?.enabled,
          },
        },
        // Hard stops
        {
          name: 'budgetExceeded',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether monthly budget has been exceeded (prevents new sessions)',
            readOnly: true,
            condition: (data) => data.costControls?.enabled,
          },
        },
        {
          name: 'budgetExceededAt',
          type: 'date',
          admin: {
            description: 'When the budget was exceeded',
            readOnly: true,
            condition: (data) => data.costControls?.budgetExceeded,
          },
        },
        {
          name: 'pausedUntil',
          type: 'date',
          admin: {
            description: 'Manually pause all agent operations until this date',
            condition: (data) => data.costControls?.enabled,
          },
        },
      ],
    },
  ],
  timestamps: true,
}
