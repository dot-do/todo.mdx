import type { CollectionConfig } from 'payload'

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
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'installation.users.id': { equals: user.id },
      }
    },
    create: ({ req: { user } }) => user?.roles?.includes('admin'),
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      // Users can update repos they have access to
      return {
        'installation.users.id': { equals: user.id },
      }
    },
    delete: ({ req: { user } }) => user?.roles?.includes('admin'),
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
  ],
  timestamps: true,
}
