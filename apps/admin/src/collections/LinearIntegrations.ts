import type { CollectionConfig } from 'payload'

/**
 * Linear integrations.
 * Tracks Linear workspace connections for users and syncs issues/cycles.
 */
export const LinearIntegrations: CollectionConfig = {
  slug: 'linear-integrations',
  admin: {
    useAsTitle: 'linearData.organizationName',
    defaultColumns: ['linearData.organizationName', 'user', 'repo', 'active', 'lastSyncAt'],
    group: 'Integrations',
  },
  access: {
    // Users can read their own integrations
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'user.id': { equals: user.id },
      }
    },
    // Users can create their own integrations
    create: ({ req: { user } }) => {
      if (!user) return false
      return true
    },
    // Users can update their own integrations
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'user.id': { equals: user.id },
      }
    },
    // Users can delete their own integrations
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'user.id': { equals: user.id },
      }
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who connected this Linear workspace',
      },
    },
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      index: true,
      admin: {
        description: 'Repository to sync Linear issues to (optional)',
      },
    },
    {
      name: 'linearData',
      type: 'group',
      admin: {
        description: 'Linear workspace information',
      },
      fields: [
        {
          name: 'organizationId',
          type: 'text',
          required: true,
          index: true,
          admin: {
            description: 'Linear organization ID',
          },
        },
        {
          name: 'organizationName',
          type: 'text',
          required: true,
          admin: {
            description: 'Linear organization name',
          },
        },
        {
          name: 'urlKey',
          type: 'text',
          admin: {
            description: 'Linear workspace URL key',
          },
        },
        {
          name: 'userId',
          type: 'text',
          admin: {
            description: 'Linear user ID',
          },
        },
        {
          name: 'userEmail',
          type: 'text',
          admin: {
            description: 'Linear user email',
          },
        },
        {
          name: 'teamId',
          type: 'text',
          index: true,
          admin: {
            description: 'Linear team ID to sync (optional, syncs all teams if not set)',
          },
        },
        {
          name: 'teamName',
          type: 'text',
          admin: {
            description: 'Linear team name',
          },
        },
      ],
    },
    {
      name: 'webhookId',
      type: 'text',
      index: true,
      admin: {
        description: 'Linear webhook ID for this integration',
      },
    },
    {
      name: 'webhookSecret',
      type: 'text',
      admin: {
        description: 'Webhook secret for signature verification',
        hidden: true, // Hide from UI (sensitive)
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: {
        description: 'Whether this integration is active',
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
      name: 'lastSyncResult',
      type: 'json',
      admin: {
        description: 'Result of last sync (counts, errors)',
      },
    },
    {
      name: 'syncSettings',
      type: 'group',
      admin: {
        description: 'Sync configuration',
      },
      fields: [
        {
          name: 'autoSync',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Automatically sync on webhook events',
          },
        },
        {
          name: 'syncCycles',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Sync Linear cycles as milestones',
          },
        },
        {
          name: 'syncProjects',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Sync Linear projects',
          },
        },
        {
          name: 'syncLabels',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Sync Linear labels',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
