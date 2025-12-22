import type { CollectionConfig } from 'payload'
import { ownerOrAdmin, authenticated } from '../access'

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
    // Users can read their own connections (or admins/internal)
    read: ownerOrAdmin('user'),
    // Authenticated users can create their own connections
    create: authenticated,
    // Users can update/delete their own connections
    update: ownerOrAdmin('user'),
    delete: ownerOrAdmin('user'),
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
