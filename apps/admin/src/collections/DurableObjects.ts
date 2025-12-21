import type { CollectionConfig } from 'payload'

/**
 * DurableObjects - Track Durable Object state and metadata.
 * Enables observability and debugging of XState machines running in DOs.
 */
export const DurableObjects: CollectionConfig = {
  slug: 'durable-objects',
  admin: {
    useAsTitle: 'ref',
    defaultColumns: ['ref', 'type', 'lastHeartbeat', 'org', 'repo'],
    group: 'System',
  },
  access: {
    // Users can read DOs for repos they have access to
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    // Only system can create/update DOs
    create: ({ req: { user } }) => user?.roles?.includes('admin'),
    update: ({ req: { user } }) => user?.roles?.includes('admin'),
    delete: ({ req: { user } }) => user?.roles?.includes('admin'),
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Org', value: 'org' },
        { label: 'Repo', value: 'repo' },
        { label: 'Project', value: 'project' },
        { label: 'PR', value: 'pr' },
        { label: 'Issue', value: 'issue' },
      ],
      index: true,
      admin: {
        description: 'Type of Durable Object',
      },
    },
    {
      name: 'doId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Durable Object ID string',
      },
    },
    {
      name: 'ref',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Human-readable reference: owner/repo#123',
      },
    },
    {
      name: 'state',
      type: 'json',
      admin: {
        description: 'XState snapshot',
      },
    },
    {
      name: 'lastHeartbeat',
      type: 'date',
      index: true,
      admin: {
        description: 'Last state update for detecting stale DOs',
      },
    },
    // Relationships
    {
      name: 'org',
      type: 'relationship',
      relationTo: 'installations',
      index: true,
      admin: {
        description: 'Related installation/organization',
      },
    },
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      index: true,
      admin: {
        description: 'Related repository',
      },
    },
    {
      name: 'issue',
      type: 'relationship',
      relationTo: 'issues',
      index: true,
      admin: {
        description: 'Related issue',
      },
    },
  ],
  timestamps: true,
}
