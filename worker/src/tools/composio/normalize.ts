import { z } from 'zod'
import type { Tool, Connection } from '../types'
import type { Env } from '../../types/env'
import { toFullToolName } from '../naming'
import { executeComposioTool } from './execute'

/**
 * Composio tool structure (simplified)
 */
export interface ComposioTool {
  name: string // e.g., "GITHUB_CREATE_ISSUE" or "GITHUB_CREATE_PULL_REQUEST"
  description?: string
  parameters?: {
    type?: string
    properties?: Record<string, any>
    required?: string[]
  }
  [key: string]: any
}

/**
 * Normalize Composio's SCREAMING_SNAKE_CASE tool names to camelCase
 *
 * Examples:
 * - GITHUB_CREATE_ISSUE → github.createIssue
 * - GITHUB_CREATE_PULL_REQUEST → github.createPullRequest
 * - LINEAR_CREATE_ISSUE → linear.createIssue
 * - SLACK_SEND_MESSAGE → slack.sendMessage
 *
 * @param toolName - Composio tool name in SCREAMING_SNAKE_CASE
 * @returns Object with app name (PascalCase) and action name (camelCase)
 */
export function parseComposioToolName(toolName: string): {
  app: string
  action: string
} {
  // Split by underscore
  const parts = toolName.split('_')

  if (parts.length < 2) {
    throw new Error(`Invalid Composio tool name: ${toolName}`)
  }

  // First part is the app name - use lowercase to map to known apps
  // Known apps: github → GitHub, linear → Linear, slack → Slack, etc.
  const appLower = parts[0].toLowerCase()

  // Map known apps to their proper PascalCase names
  const appMap: Record<string, string> = {
    'github': 'GitHub',
    'linear': 'Linear',
    'slack': 'Slack',
    'googledrive': 'GoogleDrive',
    'microsoftteams': 'MicrosoftTeams',
  }

  const app = appMap[appLower] ?? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()

  // Rest is the action name - convert to camelCase
  const actionParts = parts.slice(1)
  const action =
    actionParts[0].toLowerCase() +
    actionParts
      .slice(1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('')

  return { app, action }
}

/**
 * Convert Composio parameter schema to Zod schema
 *
 * This is a simplified conversion. For production use, you'd want more
 * sophisticated handling of nested objects, arrays, enums, etc.
 */
function composioSchemaToZod(parameters?: ComposioTool['parameters']): z.ZodSchema {
  if (!parameters || !parameters.properties) {
    return z.object({})
  }

  const shape: Record<string, z.ZodTypeAny> = {}
  const required = new Set(parameters.required || [])

  for (const [key, prop] of Object.entries(parameters.properties)) {
    let zodType: z.ZodTypeAny

    switch (prop.type) {
      case 'string':
        zodType = z.string()
        if (prop.description) {
          zodType = zodType.describe(prop.description)
        }
        break
      case 'number':
      case 'integer':
        zodType = z.number()
        if (prop.description) {
          zodType = zodType.describe(prop.description)
        }
        break
      case 'boolean':
        zodType = z.boolean()
        if (prop.description) {
          zodType = zodType.describe(prop.description)
        }
        break
      case 'array':
        // Simplified: assume array of strings
        zodType = z.array(z.string())
        if (prop.description) {
          zodType = zodType.describe(prop.description)
        }
        break
      case 'object':
        // Simplified: accept any object
        zodType = z.record(z.any())
        if (prop.description) {
          zodType = zodType.describe(prop.description)
        }
        break
      default:
        zodType = z.any()
    }

    // Make optional if not required
    if (!required.has(key)) {
      zodType = zodType.optional()
    }

    shape[key] = zodType
  }

  return z.object(shape)
}

/**
 * Normalize a Composio tool to our Tool interface
 *
 * @param composioTool - Raw tool from Composio API
 * @param connection - Connection for execution context
 * @param env - Worker environment
 * @returns Normalized Tool
 */
export function normalizeComposioTool(
  composioTool: ComposioTool,
  connection: Connection,
  env: Env
): Tool {
  const { app, action } = parseComposioToolName(composioTool.name)
  const fullName = toFullToolName(app, action)
  const schema = composioSchemaToZod(composioTool.parameters)

  return {
    name: action,
    fullName,
    schema,
    execute: async (params: any) => {
      return executeComposioTool(composioTool.name, params, connection, env)
    },
  }
}
