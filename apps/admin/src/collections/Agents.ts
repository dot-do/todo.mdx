import type { CollectionConfig, Where } from 'payload'
import { isInternalRequest, adminOnly } from '../access'

/**
 * AI Agents configuration.
 * Defines agents that can be dispatched for code review, testing, debugging, etc.
 */
export const Agents: CollectionConfig = {
  slug: 'agents',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'agentId', 'tier', 'framework', 'org', 'repo'],
    group: 'Configuration',
  },
  access: {
    // Users can read agents in their installations/repos (custom logic for global agents)
    read: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      // Users can see agents in their installations or repos, plus global agents
      const orConditions: Where[] = [
        { 'org.users.id': { equals: user.id } },
        { 'repo.installation.users.id': { equals: user.id } },
        { and: [{ org: { exists: false } }, { repo: { exists: false } }] }, // Global agents
      ]
      return { or: orConditions }
    },
    // Only internal RPC or admins can create/delete agents
    create: adminOnly,
    // Users can update agents in their installations/repos (custom logic)
    update: ({ req }) => {
      if (isInternalRequest(req)) return true
      const { user } = req
      if (!user) return false
      if (user.roles?.includes('admin')) return true
      // Users can update agents in their installations/repos
      const orConditions: Where[] = [
        { 'org.users.id': { equals: user.id } },
        { 'repo.installation.users.id': { equals: user.id } },
      ]
      return { or: orConditions }
    },
    delete: adminOnly,
  },
  fields: [
    {
      name: 'agentId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Unique identifier for this agent (e.g., code-reviewer, test-writer)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name for this agent',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Description of what this agent does',
      },
    },
    {
      name: 'tools',
      type: 'json',
      defaultValue: [],
      admin: {
        description: 'List of tools available to this agent',
      },
    },
    {
      name: 'tier',
      type: 'select',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Worker', value: 'worker' },
        { label: 'Sandbox', value: 'sandbox' },
      ],
      defaultValue: 'light',
      admin: {
        description: 'Execution tier: light (stateless), worker (CF Worker), or sandbox (isolated)',
      },
    },
    {
      name: 'model',
      type: 'text',
      defaultValue: 'overall',
      admin: {
        description: 'AI model to use (e.g., claude-3-5-sonnet-20241022, overall)',
      },
    },
    {
      name: 'framework',
      type: 'select',
      options: [
        { label: 'AI SDK (Vercel)', value: 'ai-sdk' },
        { label: 'Claude Agent SDK', value: 'claude-agent-sdk' },
        { label: 'OpenAI Agents', value: 'openai-agents' },
        { label: 'Claude Code', value: 'claude-code' },
      ],
      defaultValue: 'ai-sdk',
      admin: {
        description: 'Agent framework to use for execution',
      },
    },
    {
      name: 'instructions',
      type: 'code',
      admin: {
        language: 'markdown',
        description: 'System instructions for this agent (markdown format)',
      },
    },
    {
      name: 'maxSteps',
      type: 'number',
      defaultValue: 10,
      admin: {
        description: 'Maximum number of tool execution steps',
      },
    },
    {
      name: 'timeout',
      type: 'number',
      defaultValue: 300000,
      admin: {
        description: 'Execution timeout in milliseconds (default: 5 minutes)',
      },
    },
    // GitHub identity for PR reviews
    {
      name: 'githubUsername',
      type: 'text',
      index: true,
      admin: {
        description: 'GitHub username for this agent (e.g., quinn-qa-bot)',
      },
    },
    {
      name: 'githubPat',
      type: 'text',
      admin: {
        description: 'GitHub Personal Access Token (encrypted in storage)',
      },
    },
    {
      name: 'reviewRole',
      type: 'select',
      options: [
        { label: 'Product', value: 'product' },
        { label: 'QA', value: 'qa' },
        { label: 'Security', value: 'security' },
        { label: 'General', value: 'general' },
      ],
      admin: {
        description: 'Review role/persona for PRDO',
      },
    },
    {
      name: 'canEscalate',
      type: 'relationship',
      relationTo: 'agents',
      hasMany: true,
      admin: {
        description: 'Agents this reviewer can escalate to (e.g., Quinn can escalate to Sam)',
      },
    },
    // Scope: either org-level or repo-level
    {
      name: 'org',
      type: 'relationship',
      relationTo: 'installations',
      index: true,
      admin: {
        description: 'Organization/installation this agent is scoped to (leave empty for global)',
      },
    },
    {
      name: 'repo',
      type: 'relationship',
      relationTo: 'repos',
      index: true,
      admin: {
        description: 'Repository this agent is scoped to (leave empty for org-level or global)',
      },
    },
  ],
  timestamps: true,
}
