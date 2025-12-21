import type { CollectionConfig } from 'payload'
import { isInternalRequest, internalOrAdmin } from '../access/internal'

/**
 * Connections collection.
 * Unified integration connections across providers (native GitHub App, Composio, etc.).
 */
export const Connections: CollectionConfig = {
  slug: 'connections',
  admin: {
    useAsTitle: 'app',
    defaultColumns: ['app', 'provider', 'status', 'connectedAt'],
    group: 'Integrations',
  },
  access: {
    // Only authenticated users can read their own connections
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      // Admins can see all
      if (user.roles?.includes('admin')) return true
      // Users see their own connections
      return {
        user: { equals: user.id },
      }
    },
    // Users can create their own connections
    create: ({ req }) => {
      if (isInternalRequest(req)) return true
      return !!req.user
    },
    // Users can update their own connections
    update: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        user: { equals: user.id },
      }
    },
    // Users can delete their own connections
    delete: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        user: { equals: user.id },
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
        description: 'User who owns this connection',
      },
    },
    {
      name: 'org',
      type: 'relationship',
      relationTo: 'installations',
      index: true,
      admin: {
        description: 'Optional org-level connection',
      },
    },
    {
      name: 'app',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Integration name (PascalCase): GitHub, Slack, Linear',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'native',
      index: true,
      options: [
        { label: 'Native', value: 'native' },
        { label: 'Composio', value: 'composio' },
      ],
    },
    {
      name: 'externalId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Provider-specific ID (composioUserId, installationId, etc.)',
      },
    },
    {
      name: 'externalRef',
      type: 'json',
      admin: {
        description: 'Provider-specific metadata',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
    },
    {
      name: 'scopes',
      type: 'json',
      admin: {
        description: 'Granted permissions/scopes',
      },
    },
    {
      name: 'connectedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When the connection was established',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Token expiration for refresh',
      },
    },
  ],
  timestamps: true,
}
