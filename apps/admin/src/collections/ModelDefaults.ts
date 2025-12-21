import type { CollectionConfig } from 'payload'
import { internalOrAdmin } from '../access/internal'

export const ModelDefaults: CollectionConfig = {
  slug: 'model-defaults',
  admin: {
    group: 'Configuration',
    useAsTitle: 'useCase',
    description: 'Maps model aliases (best, fast, cheap, overall) to actual models',
  },
  access: {
    read: () => true,
    create: internalOrAdmin,
    update: internalOrAdmin,
    delete: internalOrAdmin,
  },
  fields: [
    {
      name: 'useCase',
      type: 'select',
      required: true,
      options: [
        { label: 'Best (top reasoning)', value: 'best' },
        { label: 'Fast (lowest latency)', value: 'fast' },
        { label: 'Cheap (lowest cost)', value: 'cheap' },
        { label: 'Overall (best value)', value: 'overall' },
      ],
      admin: {
        description: 'The model alias this default applies to',
      },
    },
    {
      name: 'taskType',
      type: 'select',
      options: [
        { label: 'Coding', value: 'coding' },
        { label: 'Research', value: 'research' },
        { label: 'Browser', value: 'browser' },
        { label: 'General', value: 'general' },
      ],
      admin: {
        description: 'Optional task type for more specific defaults',
      },
    },
    {
      name: 'model',
      type: 'relationship',
      relationTo: 'models',
      required: true,
      admin: {
        description: 'The actual model to use for this use case',
      },
    },
    {
      name: 'org',
      type: 'relationship',
      relationTo: 'installations',
      admin: {
        description: 'Optional org-level override',
      },
    },
  ],
  indexes: [
    {
      fields: ['useCase', 'taskType', 'org'],
      unique: true,
    },
  ],
  timestamps: true,
}
