import type { CollectionConfig } from 'payload'

/**
 * Milestones for grouping issues.
 * Syncs with GitHub Milestones.
 */
export const Milestones: CollectionConfig = {
  slug: 'milestones',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'state', 'dueOn', 'repo'],
    group: 'Content',
  },
  access: {
    // Users can read milestones from repos they have access to
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
        description: 'Local milestone ID',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
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
      name: 'dueOn',
      type: 'date',
      admin: {
        description: 'Due date for the milestone',
      },
    },
    // GitHub sync fields
    {
      name: 'githubNumber',
      type: 'number',
      index: true,
      admin: {
        description: 'GitHub milestone number',
      },
    },
    {
      name: 'githubId',
      type: 'number',
      index: true,
      admin: {
        description: 'GitHub milestone ID',
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
    // Join field to show issues in this milestone
    {
      name: 'issues',
      type: 'join',
      collection: 'issues',
      on: 'milestone',
    },
    // Linear integration data
    {
      name: 'linearData',
      type: 'group',
      admin: {
        description: 'Linear integration metadata (for cycles)',
      },
      fields: [
        {
          name: 'id',
          type: 'text',
          index: true,
          admin: {
            description: 'Linear cycle ID',
          },
        },
        {
          name: 'number',
          type: 'number',
          admin: {
            description: 'Linear cycle number',
          },
        },
        {
          name: 'startsAt',
          type: 'date',
          admin: {
            description: 'Linear cycle start date',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
