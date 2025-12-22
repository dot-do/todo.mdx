import type { CollectionConfig } from 'payload'
import { ownerOrAdmin, adminOnly } from '../access'

/**
 * Tool executions audit log.
 * Tracks all tool executions for debugging, analytics, and compliance.
 */
export const ToolExecutions: CollectionConfig = {
  slug: 'tool-executions',
  admin: {
    useAsTitle: 'tool',
    defaultColumns: ['tool', 'user', 'executedAt', 'durationMs', 'error'],
    group: 'System',
  },
  access: {
    // Users can read their own executions, admins/internal can read all
    read: ownerOrAdmin('user'),
    // Only internal RPC or admins can create/update/delete tool executions
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'doId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Durable Object ID that executed the tool',
      },
    },
    {
      name: 'tool',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Tool name (e.g., GitHub.createPullRequest, Linear.createIssue)',
      },
    },
    {
      name: 'params',
      type: 'json',
      required: true,
      admin: {
        description: 'Tool execution parameters',
      },
    },
    {
      name: 'result',
      type: 'json',
      admin: {
        description: 'Tool execution result (if successful)',
        condition: (data) => !data.error,
      },
    },
    {
      name: 'error',
      type: 'text',
      admin: {
        description: 'Error message if execution failed',
        condition: (data) => !!data.error,
      },
    },
    {
      name: 'durationMs',
      type: 'number',
      required: true,
      admin: {
        description: 'Execution duration in milliseconds',
      },
    },
    {
      name: 'executedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
      admin: {
        description: 'When the tool was executed',
      },
    },
    // References
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'User who initiated the tool execution',
      },
    },
    {
      name: 'connection',
      type: 'relationship',
      relationTo: 'connections',
      required: true,
      index: true,
      admin: {
        description: 'Connection used for the tool execution',
      },
    },
  ],
  timestamps: true,
}
