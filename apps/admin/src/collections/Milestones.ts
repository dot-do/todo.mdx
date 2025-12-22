import type { CollectionConfig } from 'payload'
import { repoAccess, adminOnly } from '../access'

/**
 * Milestones collection.
 * GitHub milestones synced from repositories.
 * Used for organizing issues into time-based releases or sprints.
 */
export const Milestones: CollectionConfig = {
  slug: 'milestones',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'state', 'repo', 'dueOn', 'updatedAt'],
    group: 'GitHub',
  },
  access: {
    // Users can read milestones from repos they have access to
    read: repoAccess,
    // Only internal RPC or admins can create/delete milestones
    create: adminOnly,
    // Users can update milestones from repos they have access to
    update: repoAccess,
    delete: adminOnly,
  },
  fields: [
    // GitHub IDs for sync tracking
    {
      name: 'githubId',
      type: 'number',
      unique: true,
      index: true,
      admin: {
        description: 'GitHub milestone ID',
      },
    },
    {
      name: 'githubNumber',
      type: 'number',
      index: true,
      admin: {
        description: 'GitHub milestone number within the repo',
      },
    },
    // Core milestone fields
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Milestone title',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Milestone description',
      },
    },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
      index: true,
      admin: {
        description: 'Current milestone state',
      },
    },
    {
      name: 'dueOn',
      type: 'date',
      admin: {
        description: 'Due date for this milestone',
      },
    },
    // Relationships
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      required: true,
      index: true,
      admin: {
        description: 'Repository this milestone belongs to',
      },
    },
    // Sync tracking
    {
      name: 'lastSyncAt',
      type: 'date',
      admin: {
        description: 'Last sync timestamp with GitHub',
      },
    },
  ],
  timestamps: true,
}
