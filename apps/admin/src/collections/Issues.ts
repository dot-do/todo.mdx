import type { CollectionConfig } from 'payload'
import { repoAccess, adminOnly } from '../access'

/**
 * Issues collection.
 * Central issue tracking with sync status for beads, GitHub Issues, and Linear.
 * Provides admin visibility into all issues across integrated systems.
 */
export const Issues: CollectionConfig = {
  slug: 'issues',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'priority', 'repo', 'syncedTo', 'updatedAt'],
    group: 'Issues',
  },
  access: {
    // Users can read issues from repos they have access to
    read: repoAccess,
    // Only internal RPC or admins can create/delete issues
    create: adminOnly,
    // Users can update issues from repos they have access to
    update: repoAccess,
    delete: adminOnly,
  },
  fields: [
    // External IDs for sync tracking
    {
      name: 'beadsId',
      type: 'text',
      index: true,
      admin: {
        description: 'Beads issue ID (e.g., "todo-abc")',
      },
    },
    {
      name: 'githubNumber',
      type: 'number',
      index: true,
      admin: {
        description: 'GitHub issue number',
      },
    },
    {
      name: 'linearId',
      type: 'text',
      index: true,
      admin: {
        description: 'Linear issue ID',
      },
    },
    // Core issue fields
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Issue title',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Issue description',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Blocked', value: 'blocked' },
        { label: 'Closed', value: 'closed' },
      ],
      index: true,
      admin: {
        description: 'Current issue status',
      },
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'P2',
      options: [
        { label: 'P0 - Critical', value: 'P0' },
        { label: 'P1 - High', value: 'P1' },
        { label: 'P2 - Medium', value: 'P2' },
        { label: 'P3 - Low', value: 'P3' },
        { label: 'P4 - Backlog', value: 'P4' },
      ],
      index: true,
      admin: {
        description: 'Issue priority level',
      },
    },
    {
      name: 'issueType',
      type: 'select',
      defaultValue: 'task',
      options: [
        { label: 'Bug', value: 'bug' },
        { label: 'Feature', value: 'feature' },
        { label: 'Task', value: 'task' },
        { label: 'Epic', value: 'epic' },
        { label: 'Chore', value: 'chore' },
      ],
      index: true,
      admin: {
        description: 'Type of issue',
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
        description: 'Repository this issue belongs to',
      },
    },
    {
      name: 'assignee',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'User assigned to this issue',
      },
    },
    // Sync tracking - which systems this issue is synced to
    {
      name: 'syncedTo',
      type: 'group',
      admin: {
        description: 'Systems this issue is synced to',
      },
      fields: [
        {
          name: 'beads',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Synced to beads local tracker',
          },
        },
        {
          name: 'github',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Synced to GitHub Issues',
          },
        },
        {
          name: 'linear',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Synced to Linear',
          },
        },
      ],
    },
    // Last sync timestamps for each system
    {
      name: 'lastSyncAt',
      type: 'group',
      admin: {
        description: 'Last sync timestamps for each system',
      },
      fields: [
        {
          name: 'beads',
          type: 'date',
          admin: {
            description: 'Last beads sync timestamp',
          },
        },
        {
          name: 'github',
          type: 'date',
          admin: {
            description: 'Last GitHub sync timestamp',
          },
        },
        {
          name: 'linear',
          type: 'date',
          admin: {
            description: 'Last Linear sync timestamp',
          },
        },
      ],
    },
  ],
  timestamps: true,
}
