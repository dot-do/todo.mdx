import type { CollectionConfig } from 'payload'

/**
 * Issues (todos) within a repository.
 * Core data model for todo.mdx - syncs bidirectionally with GitHub Issues.
 */
export const Issues: CollectionConfig = {
  slug: 'issues',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'state', 'status', 'priority', 'repo', 'milestone'],
    group: 'Content',
  },
  access: {
    // Users can read issues from repos they have access to
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    delete: ({ req: { user } }) => {
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
      name: 'state',
      type: 'select',
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
      defaultValue: 'open',
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Closed', value: 'closed' },
      ],
      defaultValue: 'open',
      admin: {
        description: 'Extended status (beyond GitHub open/closed)',
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
  ],
  timestamps: true,
}
