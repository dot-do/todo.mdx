/**
 * MCP (Model Context Protocol) types
 */

// MCP tool names
export type MCPToolName = 'search' | 'fetch' | 'roadmap' | 'do'

// MCP tool parameters
export interface SearchToolParams {
  query: string
  limit?: number
}

export interface FetchToolParams {
  uri: string
}

export interface RoadmapToolParams {
  repo?: string
}

export interface DoToolParams {
  repo: string
  code: string
}

export type MCPToolParams =
  | SearchToolParams
  | FetchToolParams
  | RoadmapToolParams
  | DoToolParams

// MCP tool response
export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'resource'
    text?: string
    resource?: {
      uri: string
      mimeType?: string
      text?: string
    }
  }>
  isError?: boolean
}

// MCP resource
export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

// MCP tool definition
export interface MCPToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
}

// MCP session props (from OAuth or WorkOS JWT)
export interface MCPSessionProps {
  user?: {
    id: string
    email?: string
    firstName?: string
    lastName?: string
  }
  organization?: {
    id: string
    name?: string
  }
  role?: string
  permissions?: string[]
}

// WorkOS JWT payload
export interface WorkOSJWTPayload {
  sub: string
  sid: string
  org_id?: string
  role?: string
  permissions?: string[]
  email?: string
  first_name?: string
  last_name?: string
  iat: number
  exp: number
  iss: string
  aud: string
}
