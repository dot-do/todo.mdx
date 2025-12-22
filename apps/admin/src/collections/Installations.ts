import type { CollectionConfig } from 'payload'
import { isInternalRequest, adminOnly } from '../access'
import { createApprovalGatesGroup } from '../fields/approval-gates'

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
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
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
    createApprovalGatesGroup({ level: 'org' }),
  ],
  timestamps: true,
}
