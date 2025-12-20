import type { CollectionConfig } from 'payload'

/**
 * Sync events for tracking bidirectional sync between local and GitHub.
 * Used to maintain consistency and resolve conflicts.
 */
export const SyncEvents: CollectionConfig = {
  slug: 'sync-events',
  admin: {
    useAsTitle: 'eventType',
    defaultColumns: ['eventType', 'direction', 'status', 'repo', 'createdAt'],
    group: 'System',
  },
  access: {
    // Users can read sync events for repos they have access to
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    // Only system can create/update sync events
    create: ({ req: { user } }) => user?.roles?.includes('admin'),
    update: ({ req: { user } }) => user?.roles?.includes('admin'),
    delete: ({ req: { user } }) => user?.roles?.includes('admin'),
  },
  fields: [
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        // Issue events
        { label: 'Issue Created', value: 'issue.created' },
        { label: 'Issue Updated', value: 'issue.updated' },
        { label: 'Issue Closed', value: 'issue.closed' },
        { label: 'Issue Reopened', value: 'issue.reopened' },
        { label: 'Issue Deleted', value: 'issue.deleted' },
        // Milestone events
        { label: 'Milestone Created', value: 'milestone.created' },
        { label: 'Milestone Updated', value: 'milestone.updated' },
        { label: 'Milestone Closed', value: 'milestone.closed' },
        { label: 'Milestone Deleted', value: 'milestone.deleted' },
        // Sync events
        { label: 'Full Sync', value: 'sync.full' },
        { label: 'Push Sync', value: 'sync.push' },
        { label: 'Pull Sync', value: 'sync.pull' },
      ],
      index: true,
    },
    {
      name: 'direction',
      type: 'select',
      required: true,
      options: [
        { label: 'Local → GitHub', value: 'local_to_github' },
        { label: 'GitHub → Local', value: 'github_to_local' },
        { label: 'Bidirectional', value: 'bidirectional' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Conflict', value: 'conflict' },
      ],
      defaultValue: 'pending',
      index: true,
    },
    {
      name: 'payload',
      type: 'json',
      admin: {
        description: 'Event payload data',
      },
    },
    {
      name: 'error',
      type: 'text',
      admin: {
        description: 'Error message if failed',
        condition: (data) => data.status === 'failed',
      },
    },
    {
      name: 'conflictResolution',
      type: 'select',
      options: [
        { label: 'Local Wins', value: 'local_wins' },
        { label: 'GitHub Wins', value: 'github_wins' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        description: 'How the conflict was resolved',
        condition: (data) => data.status === 'conflict',
      },
    },
    // References
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      required: true,
      index: true,
    },
    {
      name: 'issue',
      type: 'relationship',
      relationTo: 'issues',
      admin: {
        description: 'Related issue (if applicable)',
      },
    },
    {
      name: 'milestone',
      type: 'relationship',
      relationTo: 'milestones',
      admin: {
        description: 'Related milestone (if applicable)',
      },
    },
    // Timing
    {
      name: 'processedAt',
      type: 'date',
      admin: {
        description: 'When the event was processed',
      },
    },
    {
      name: 'retryCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of retry attempts',
      },
    },
  ],
  timestamps: true,
}
