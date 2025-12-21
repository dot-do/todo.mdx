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
  ],
  timestamps: true,
}
