// Export all collections for use in workers
export { Users } from './Users'
export { Media } from './Media'
export { Installations } from './Installations'
export { Repos } from './Repos'
export { Issues } from './Issues'
export { Milestones } from './Milestones'
export { SyncEvents } from './SyncEvents'
export { LinearIntegrations } from './LinearIntegrations'
export { Agents } from './Agents'
export { DurableObjects } from './DurableObjects'
export { Connections } from './Connections'
export { ToolExecutions } from './ToolExecutions'
export { Models } from './Models'
export { ModelDefaults } from './ModelDefaults'
export { AuditLogs } from './AuditLogs'

// Re-export for convenience
export const collections = [
  'users',
  'media',
  'installations',
  'repos',
  'issues',
  'milestones',
  'syncEvents',
  'linearIntegrations',
  'agents',
  'durableObjects',
  'connections',
  'toolExecutions',
  'models',
  'model-defaults',
  'audit-logs',
] as const

export type CollectionSlug = (typeof collections)[number]
