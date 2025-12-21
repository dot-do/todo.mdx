import type { CollectionConfig } from 'payload'
import { isInternalRequest, internalOrAdmin } from '../access/internal'

/**
 * Users collection with GitHub OAuth and role-based access control.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'githubLogin', 'roles', 'createdAt'],
    group: 'System',
  },
  auth: true,
  access: {
    // Users can read their own profile, admins can read all
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return { id: { equals: user.id } }
    },
    // Only admins can create users directly (OAuth creates users automatically)
    create: internalOrAdmin,
    // Users can update their own profile, admins can update all
    update: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return { id: { equals: user.id } }
    },
    delete: internalOrAdmin,
  },
  fields: [
    // RBAC
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ],
      defaultValue: ['user'],
      required: true,
      saveToJWT: true,
      access: {
        update: ({ req: { user } }) => user?.roles?.includes('admin'),
      },
    },
    // GitHub OAuth fields
    {
      name: 'githubId',
      type: 'number',
      unique: true,
      index: true,
      admin: {
        description: 'GitHub user ID',
        position: 'sidebar',
      },
    },
    {
      name: 'githubLogin',
      type: 'text',
      index: true,
      admin: {
        description: 'GitHub username',
        position: 'sidebar',
      },
    },
    {
      name: 'githubAvatarUrl',
      type: 'text',
      admin: {
        description: 'GitHub avatar URL',
      },
    },
    {
      name: 'name',
      type: 'text',
      admin: {
        description: 'Display name',
      },
    },
    // WorkOS OAuth fields
    {
      name: 'workosUserId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'WorkOS user ID',
        position: 'sidebar',
      },
    },
    // Join field to show user's installations
    {
      name: 'installations',
      type: 'join',
      collection: 'installations',
      on: 'users',
    },
  ],
}
