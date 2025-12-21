import { Composio } from '@composio/core'
import type { Env } from '../../types/env'
import type { Integration, Connection } from '../types'
import { normalizeComposioTool } from './normalize'

/**
 * Get Composio client instance
 */
export function getComposio(env: Env): Composio {
  if (!env.COMPOSIO_API_KEY) {
    throw new Error('COMPOSIO_API_KEY is required')
  }
  return new Composio({ apiKey: env.COMPOSIO_API_KEY })
}

/**
 * Fetch and normalize Composio tools for specified apps
 *
 * @param env - Worker environment with COMPOSIO_API_KEY
 * @param apps - List of app names (e.g., ['github', 'linear'])
 * @param connection - Connection details for authentication
 * @returns Integration objects with normalized tools
 */
export async function getComposioTools(
  env: Env,
  apps: string[],
  connection: Connection
): Promise<Integration[]> {
  const composio = getComposio(env)
  const integrations: Integration[] = []

  for (const app of apps) {
    try {
      // Fetch tools from Composio for this app
      const composioTools = await composio.tools.get({
        apps: [app],
        useCase: '',
      })

      if (!composioTools || composioTools.length === 0) {
        continue
      }

      // Normalize each tool and group by app
      const tools = composioTools.map(composioTool =>
        normalizeComposioTool(composioTool, connection, env)
      )

      // Map known apps to their proper PascalCase names
      const appMap: Record<string, string> = {
        'github': 'GitHub',
        'linear': 'Linear',
        'slack': 'Slack',
        'googledrive': 'GoogleDrive',
        'microsoftteams': 'MicrosoftTeams',
      }

      integrations.push({
        name: appMap[app.toLowerCase()] ?? app.charAt(0).toUpperCase() + app.slice(1).toLowerCase(),
        tools,
      })
    } catch (error) {
      console.error(`Failed to fetch Composio tools for ${app}:`, error)
      // Continue with other apps even if one fails
    }
  }

  return integrations
}

/**
 * Get Composio tools for a specific connection
 *
 * @param env - Worker environment
 * @param connection - Connection with app and provider info
 * @returns Integration for the connection's app
 */
export async function getComposioToolsForConnection(
  env: Env,
  connection: Connection
): Promise<Integration | null> {
  const integrations = await getComposioTools(env, [connection.app.toLowerCase()], connection)
  return integrations.length > 0 ? integrations[0] : null
}
