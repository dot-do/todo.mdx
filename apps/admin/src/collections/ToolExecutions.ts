import type { CollectionConfig } from 'payload'
import { isInternalRequest } from '../access/internal'

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
    // Users can read their own executions, admins can read all
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        user: { equals: user.id },
      }
    },
    // Only system can create tool executions
    create: ({ req }) => {
      if (isInternalRequest(req)) return true
      return req.user?.roles?.includes('admin') ?? false
    },
    // Only admins can update/delete
    update: ({ req }) => {
      if (isInternalRequest(req)) return true
      return req.user?.roles?.includes('admin') ?? false
    },
    delete: ({ req }) => {
      if (isInternalRequest(req)) return true
      return req.user?.roles?.includes('admin') ?? false
    },
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
