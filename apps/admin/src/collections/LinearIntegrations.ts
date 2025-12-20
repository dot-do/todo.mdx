import type { CollectionConfig } from 'payload'
import { encrypt, decrypt, isEncrypted } from '../lib/encryption'

/**
 * Linear workspace integrations.
 * Tracks Linear OAuth connections and webhook configurations.
 */
export const LinearIntegrations: CollectionConfig = {
  slug: 'linear-integrations',
  admin: {
    defaultColumns: ['linearData.organizationName', 'linearData.teamName', 'active', 'createdAt'],
    group: 'Linear',
  },
  access: {
    // Only authenticated users can read their own integrations
    read: ({ req: { user } }) => {
      if (!user) return false
      // Admins can see all
      if (user.roles?.includes('admin')) return true
      // Users see their own integrations
      return {
        user: { equals: user.id },
      }
    },
    // Users can create their own integrations
    create: ({ req: { user } }) => !!user,
    // Users can update their own integrations
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        user: { equals: user.id },
      }
    },
    // Users can delete their own integrations
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        user: { equals: user.id },
      }
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Encrypt webhook secret before saving (only if not already encrypted)
        if (data.webhookSecret && req.payload.secret && !isEncrypted(data.webhookSecret)) {
          data.webhookSecret = await encrypt(data.webhookSecret, req.payload.secret)
        }
        return data
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        // Decrypt webhook secret after reading
        if (doc.webhookSecret && req.payload.secret && isEncrypted(doc.webhookSecret)) {
          try {
            doc.webhookSecret = await decrypt(doc.webhookSecret, req.payload.secret)
          } catch (error) {
            // If decryption fails, return masked value
            console.error('Failed to decrypt webhook secret:', error)
            doc.webhookSecret = '***decryption-failed***'
          }
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who connected this Linear integration',
      },
    },
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      index: true,
      admin: {
        description: 'Optional: Link to a specific repository',
      },
    },
    {
      name: 'linearData',
      type: 'group',
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
            description: 'Linear organization URL key',
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
            description: 'Linear team ID',
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
        description: 'Webhook secret for signature verification (encrypted at rest)',
        // Note: Hidden field is handled by access control, not by hiding the component
        // Users can only see their own integrations, and admins can see all
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
