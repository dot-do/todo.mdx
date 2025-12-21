import { z } from 'zod'

export interface Integration {
  name: string  // 'GitHub' (PascalCase for storage)
  tools: Tool[]
}

export interface Tool {
  name: string              // 'createPullRequest'
  fullName: string          // 'github.createPullRequest' (camelCase for bindings)
  schema: z.ZodSchema
  execute: (params: any, connection: Connection, env?: any) => Promise<any>
}

export interface Connection {
  id: string
  user: string
  app: string              // 'GitHub' (PascalCase)
  provider: 'native' | 'composio'
  externalId: string
  externalRef: Record<string, any>
  status: 'active' | 'expired' | 'revoked'
  scopes: string[]
}

export interface ToolConfig {
  enabled?: string[]
  disabled?: string[]
  includeDefaults?: boolean
  requiredApps?: string[]
}

export interface ResolvedTools {
  enabled: string[]
  required: string[]
  connections: Connection[]
}
