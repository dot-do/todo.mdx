import type { CollectionConfig } from 'payload'
import { isInternalRequest } from '../access/internal'

/**
 * Issues (todos) within a repository.
 * Core data model for todo.mdx - syncs bidirectionally with GitHub Issues.
 */
export const Issues: CollectionConfig = {
  slug: 'issues',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'priority', 'repo', 'milestone'],
    group: 'Content',
  },
  access: {
    // Users can read issues from repos they have access to
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    create: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    update: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    delete: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
  },
  fields: [
    {
      name: 'localId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Local issue ID (e.g., todo-abc)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
      admin: {
        description: 'Issue body/description (markdown)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Closed', value: 'closed' },
      ],
      defaultValue: 'open',
      index: true,
      admin: {
        description: 'Issue status (maps to GitHub open/closed)',
      },
    },
    {
      name: 'priority',
      type: 'number',
      min: 0,
      max: 4,
      defaultValue: 2,
      admin: {
        description: '0 = critical, 1 = high, 2 = medium, 3 = low, 4 = backlog',
      },
    },
    {
      name: 'labels',
      type: 'json',
      admin: {
        description: 'Array of label names',
      },
    },
    {
      name: 'assignees',
      type: 'json',
      admin: {
        description: 'Array of assignee logins',
      },
    },
    // GitHub sync fields
    {
      name: 'githubNumber',
      type: 'number',
      index: true,
      admin: {
        description: 'GitHub issue number',
      },
    },
    {
      name: 'githubId',
      type: 'number',
      index: true,
      admin: {
        description: 'GitHub issue ID',
      },
    },
    {
      name: 'githubUrl',
      type: 'text',
      admin: {
        description: 'GitHub issue URL',
      },
    },
    // Dependencies
    {
      name: 'dependsOn',
      type: 'relationship',
      relationTo: 'issues',
      hasMany: true,
      admin: {
        description: 'Issues this one depends on (blockers)',
      },
    },
    // Relationships
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      required: true,
      index: true,
    },
    {
      name: 'milestone',
      type: 'relationship',
      relationTo: 'milestones',
      index: true,
    },
    // Metadata
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Task', value: 'task' },
        { label: 'Bug', value: 'bug' },
        { label: 'Feature', value: 'feature' },
        { label: 'Epic', value: 'epic' },
      ],
      defaultValue: 'task',
    },
    {
      name: 'closedAt',
      type: 'date',
    },
    {
      name: 'closeReason',
      type: 'text',
      admin: {
        description: 'Reason for closing the issue',
      },
    },
    // Tool configuration (issue level)
    {
      name: 'toolConfig',
      type: 'json',
      admin: {
        description: 'Tool configuration for this issue (inherits from repo → installation)',
      },
    },
    // Approval gate configuration (issue-level overrides)
    {
      name: 'approvalGates',
      type: 'group',
      admin: {
        description: 'Issue-specific approval gate settings (overrides repo/org defaults)',
      },
      fields: [
        {
          name: 'inheritFromRepo',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Inherit approval gate settings from repository',
          },
        },
        {
          name: 'requireHumanApproval',
          type: 'checkbox',
          admin: {
            description: 'Require human approval for PRs related to this issue',
            condition: (data) => !data.approvalGates?.inheritFromRepo,
          },
        },
        {
          name: 'approvers',
          type: 'array',
          admin: {
            description: 'GitHub usernames who can approve PRs for this issue',
            condition: (data) => !data.approvalGates?.inheritFromRepo,
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
            description: 'GitHub teams who can approve PRs for this issue (format: org/team-slug)',
            condition: (data) => !data.approvalGates?.inheritFromRepo,
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
        {
          name: 'riskScore',
          type: 'number',
          min: 0,
          max: 100,
          admin: {
            description: 'Calculated risk score for this issue (0-100)',
            condition: (data) => !data.approvalGates?.inheritFromRepo,
          },
        },
      ],
    },
  ],
  timestamps: true,
}
