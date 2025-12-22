import type { CollectionConfig } from 'payload'
import { isInternalRequest, selfOrAdmin, adminOnly } from '../access'

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
    // Users can read their own profile, admins/internal can read all
    read: selfOrAdmin,
    // Only internal RPC or admins can create users directly (OAuth creates users automatically)
    create: adminOnly,
    // Users can update their own profile, admins/internal can update all
    update: selfOrAdmin,
    // Only internal RPC or admins can delete users
    delete: adminOnly,
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
        update: ({ req: { user } }) => Boolean(user?.roles?.includes('admin')),
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
