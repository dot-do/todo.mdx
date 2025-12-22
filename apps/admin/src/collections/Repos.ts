import type { CollectionConfig } from 'payload'
import { installationAccess, adminOnly } from '../access'
import { createApprovalGatesGroup } from '../fields/approval-gates'

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
    read: installationAccess,
    // Only internal RPC or admins can create/delete repos
    create: adminOnly,
    // Users can update repos they have access to via installation
    update: installationAccess,
    delete: adminOnly,
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
    createApprovalGatesGroup({ level: 'repo' }),
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
