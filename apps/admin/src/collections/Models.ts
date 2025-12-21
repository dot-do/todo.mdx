import type { CollectionConfig } from 'payload'
import { internalOrAdmin } from '../access/internal'

/**
 * Models collection - AI model catalog from OpenRouter.
 * Syncs available models from OpenRouter API with manual curation layer.
 */
export const Models: CollectionConfig = {
  slug: 'models',
  admin: {
    useAsTitle: 'name',
    group: 'Configuration',
    defaultColumns: ['name', 'provider', 'status', 'tier', 'contextLength'],
  },
  access: {
    // All authenticated users can read models
    read: ({ req: { user } }) => !!user,
    // Only admins can modify models (curation)
    create: internalOrAdmin,
    update: internalOrAdmin,
    delete: internalOrAdmin,
  },
  fields: [
    // From OpenRouter API
    {
      name: 'modelId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'OpenRouter model ID (e.g., anthropic/claude-3.5-sonnet)',
      },
    },
    {
      name: 'name',
      type: 'text',
      admin: {
        description: 'Human-readable model name',
      },
    },
    {
      name: 'provider',
      type: 'text',
      index: true,
      admin: {
        description: 'Model provider (e.g., anthropic, openai, google)',
      },
    },
    {
      name: 'contextLength',
      type: 'number',
      admin: {
        description: 'Maximum context window in tokens',
      },
    },
    {
      name: 'pricing',
      type: 'json',
      admin: {
        description: 'Pricing: { prompt: number, completion: number } per token',
      },
    },
    {
      name: 'capabilities',
      type: 'json',
      admin: {
        description: 'Capabilities: { vision: boolean, tools: boolean, streaming: boolean }',
      },
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      admin: {
        description: 'Last time model was synced from OpenRouter',
      },
    },
    // Manual curation layer
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Recommended', value: 'recommended' },
        { label: 'Deprecated', value: 'deprecated' },
        { label: 'Hidden', value: 'hidden' },
      ],
      defaultValue: 'available',
      index: true,
      admin: {
        description: 'Curation status for UI filtering',
      },
    },
    {
      name: 'tier',
      type: 'select',
      options: [
        { label: 'Fast', value: 'fast' },
        { label: 'Balanced', value: 'balanced' },
        { label: 'Reasoning', value: 'reasoning' },
        { label: 'Specialized', value: 'specialized' },
      ],
      admin: {
        description: 'Model tier for categorization',
      },
    },
    {
      name: 'bestFor',
      type: 'json',
      admin: {
        description: 'Use cases: ["coding", "research", "browser", "vision", etc.]',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal notes about this model',
      },
    },
  ],
  timestamps: true,
}
