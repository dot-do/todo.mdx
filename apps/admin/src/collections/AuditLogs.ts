import type { CollectionConfig } from 'payload'
import { isInternalRequest, internalOrAdmin } from '../access/internal'

/**
 * Audit logs for agent actions.
 * Tracks all autonomous operations for compliance, debugging, and rollback.
 */
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'agent', 'repo', 'status', 'createdAt'],
    group: 'System',
  },
  access: {
    // Users can read audit logs for their repos
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      return {
        'repo.installation.users.id': { equals: user.id },
      }
    },
    // Only internal RPC can create audit logs
    create: internalOrAdmin,
    // Audit logs are immutable - no updates allowed
    update: () => false,
    // Only admins can delete (for GDPR compliance requests)
    delete: ({ req }) => {
      const { user } = req
      return user?.roles?.includes('admin') || false
    },
  },
  fields: [
    {
      name: 'action',
      type: 'select',
      required: true,
      index: true,
      options: [
        // Agent lifecycle
        { label: 'Agent Spawned', value: 'agent_spawned' },
        { label: 'Agent Completed', value: 'agent_completed' },
        { label: 'Agent Failed', value: 'agent_failed' },
        { label: 'Agent Timeout', value: 'agent_timeout' },
        // Code changes
        { label: 'Code Generated', value: 'code_generated' },
        { label: 'Branch Created', value: 'branch_created' },
        { label: 'Commit Pushed', value: 'commit_pushed' },
        { label: 'PR Created', value: 'pr_created' },
        { label: 'PR Merged', value: 'pr_merged' },
        { label: 'PR Closed', value: 'pr_closed' },
        // Reviews
        { label: 'Review Started', value: 'review_started' },
        { label: 'Review Approved', value: 'review_approved' },
        { label: 'Review Rejected', value: 'review_rejected' },
        { label: 'Changes Requested', value: 'changes_requested' },
        // Approval gates
        { label: 'Approval Required', value: 'approval_required' },
        { label: 'Approval Granted', value: 'approval_granted' },
        { label: 'Approval Denied', value: 'approval_denied' },
        { label: 'Auto-Approved', value: 'auto_approved' },
        // Cost tracking
        { label: 'Cost Incurred', value: 'cost_incurred' },
        { label: 'Budget Exceeded', value: 'budget_exceeded' },
        { label: 'Rate Limited', value: 'rate_limited' },
        // Rollback
        { label: 'Rollback Triggered', value: 'rollback_triggered' },
        { label: 'Rollback Completed', value: 'rollback_completed' },
        { label: 'Rollback Failed', value: 'rollback_failed' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'success',
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
        { label: 'Pending', value: 'pending' },
        { label: 'Blocked', value: 'blocked' },
      ],
    },
    {
      name: 'agent',
      type: 'relationship',
      relationTo: 'agents',
      index: true,
      admin: {
        description: 'Agent that performed this action',
      },
    },
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      index: true,
      admin: {
        description: 'Repository this action was performed on',
      },
    },
    {
      name: 'issue',
      type: 'relationship',
      relationTo: 'issues',
      index: true,
      admin: {
        description: 'Issue this action relates to',
      },
    },
    {
      name: 'prNumber',
      type: 'number',
      index: true,
      admin: {
        description: 'Pull request number if applicable',
      },
    },
    {
      name: 'sessionId',
      type: 'text',
      index: true,
      admin: {
        description: 'Claude session ID for correlation',
      },
    },
    // Cost tracking
    {
      name: 'cost',
      type: 'group',
      admin: {
        description: 'Cost information for this action',
      },
      fields: [
        {
          name: 'inputTokens',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'outputTokens',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'totalUsd',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Total cost in USD',
          },
        },
      ],
    },
    // Risk assessment
    {
      name: 'riskAssessment',
      type: 'group',
      admin: {
        description: 'Risk assessment for this action',
      },
      fields: [
        {
          name: 'level',
          type: 'select',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Medium', value: 'medium' },
            { label: 'High', value: 'high' },
            { label: 'Critical', value: 'critical' },
          ],
        },
        {
          name: 'factors',
          type: 'json',
          admin: {
            description: 'Risk factors that contributed to this assessment',
          },
        },
        {
          name: 'touchesCriticalPath',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether this action touches critical paths (auth, payments, etc.)',
          },
        },
      ],
    },
    // Details
    {
      name: 'details',
      type: 'json',
      admin: {
        description: 'Additional details about this action',
      },
    },
    {
      name: 'filesChanged',
      type: 'json',
      admin: {
        description: 'List of files changed (for code actions)',
      },
    },
    {
      name: 'diff',
      type: 'code',
      admin: {
        language: 'diff',
        description: 'Code diff if applicable',
      },
    },
    // Rollback info
    {
      name: 'rollback',
      type: 'group',
      admin: {
        description: 'Rollback information',
      },
      fields: [
        {
          name: 'canRollback',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'rollbackCommit',
          type: 'text',
          admin: {
            description: 'Commit SHA to rollback to',
          },
        },
        {
          name: 'rolledBackAt',
          type: 'date',
        },
        {
          name: 'rolledBackBy',
          type: 'relationship',
          relationTo: 'users',
        },
      ],
    },
    // Approval info
    {
      name: 'approval',
      type: 'group',
      admin: {
        description: 'Approval information if this action required approval',
      },
      fields: [
        {
          name: 'required',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'approvedBy',
          type: 'relationship',
          relationTo: 'users',
        },
        {
          name: 'approvedAt',
          type: 'date',
        },
        {
          name: 'reason',
          type: 'text',
          admin: {
            description: 'Reason for approval/denial',
          },
        },
      ],
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: {
        description: 'Error message if action failed',
      },
    },
    {
      name: 'duration',
      type: 'number',
      admin: {
        description: 'Duration of action in milliseconds',
      },
    },
  ],
  timestamps: true,
}
