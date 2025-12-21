import type { CollectionConfig } from 'payload'
import { isInternalRequest, internalOrAdmin } from '../access/internal'

/**
 * GitHub App installations.
 * Tracks where the todo.mdx GitHub App is installed (user or org accounts).
 */
export const Installations: CollectionConfig = {
  slug: 'installations',
  admin: {
    useAsTitle: 'accountLogin',
    defaultColumns: ['accountLogin', 'accountType', 'installationId', 'createdAt'],
    group: 'GitHub',
  },
  access: {
    // Only authenticated users can read installations they have access to
    read: ({ req }) => {
      // Allow internal RPC calls
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      // Admins can see all
      if (user.roles?.includes('admin')) return true
      // Users see installations they're connected to
      return {
        'users.id': { equals: user.id },
      }
    },
    // Internal RPC or admins can create/update/delete
    create: internalOrAdmin,
    update: internalOrAdmin,
    delete: internalOrAdmin,
  },
  fields: [
    {
      name: 'installationId',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'GitHub App installation ID',
      },
    },
    {
      name: 'accountId',
      type: 'number',
      required: true,
      index: true,
      admin: {
        description: 'GitHub account ID (user or org)',
      },
    },
    {
      name: 'accountLogin',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'GitHub account login (username or org name)',
      },
    },
    {
      name: 'accountType',
      type: 'select',
      required: true,
      options: [
        { label: 'User', value: 'User' },
        { label: 'Organization', value: 'Organization' },
      ],
    },
    {
      name: 'accountAvatarUrl',
      type: 'text',
      admin: {
        description: 'GitHub avatar URL',
      },
    },
    {
      name: 'permissions',
      type: 'json',
      admin: {
        description: 'Granted permissions from GitHub',
      },
    },
    {
      name: 'events',
      type: 'json',
      admin: {
        description: 'Subscribed webhook events',
      },
    },
    {
      name: 'repositorySelection',
      type: 'select',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Selected', value: 'selected' },
      ],
      defaultValue: 'selected',
    },
    {
      name: 'suspendedAt',
      type: 'date',
      admin: {
        description: 'When the installation was suspended',
      },
    },
    {
      name: 'users',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        description: 'Users connected to this installation',
      },
    },
    // Tool configuration (org level)
    {
      name: 'toolConfig',
      type: 'json',
      admin: {
        description: 'Tool configuration for all repos in this installation',
      },
    },
    // Approval gate configuration (org level defaults)
    {
      name: 'approvalGates',
      type: 'group',
      admin: {
        description: 'Default approval gate settings for all repos in this installation',
      },
      fields: [
        {
          name: 'requireHumanApproval',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Require human approval before merging PRs (default for all repos)',
          },
        },
        {
          name: 'allowFullAutonomy',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Allow fully autonomous operation (no human approval required)',
          },
        },
        {
          name: 'maxBudgetPerDay',
          type: 'number',
          defaultValue: 100,
          admin: {
            description: 'Maximum daily budget in USD for agent operations',
          },
        },
        {
          name: 'maxAgentSpawnsPerHour',
          type: 'number',
          defaultValue: 10,
          admin: {
            description: 'Rate limit: max agent spawns per hour',
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
          defaultValue: 'high',
          admin: {
            description: 'Risk threshold for automatic approval',
          },
        },
        {
          name: 'criticalPaths',
          type: 'json',
          defaultValue: ['**/auth/**', '**/payment/**', '**/security/**', '**/.env*'],
          admin: {
            description: 'File paths that always require human approval (glob patterns)',
          },
        },
        {
          name: 'autoApproveLabels',
          type: 'json',
          defaultValue: ['auto-approve', 'safe-change'],
          admin: {
            description: 'Issue labels that allow automatic merge without human approval',
          },
        },
        {
          name: 'requireApprovalLabels',
          type: 'json',
          defaultValue: ['needs-review', 'breaking-change', 'security'],
          admin: {
            description: 'Issue labels that always require human approval',
          },
        },
        // Triggers - conditions that trigger approval requirements
        {
          name: 'triggers',
          type: 'group',
          admin: {
            description: 'Conditions that trigger approval requirements (org-wide defaults)',
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
        // Approvers - who can approve (org-wide defaults)
        {
          name: 'approvers',
          type: 'array',
          admin: {
            description: 'GitHub usernames who can approve (org-wide default)',
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
  ],
  timestamps: true,
}
