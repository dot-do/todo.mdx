import { getComposio } from './client'
import type { Connection } from '../types'
import type { Env } from '../../types/env'

/**
 * Execute a Composio tool
 *
 * @param toolName - Original Composio tool name (e.g., "GITHUB_CREATE_ISSUE")
 * @param params - Tool parameters
 * @param connection - Connection with entityId for Composio
 * @param env - Worker environment
 * @returns Tool execution result
 */
export async function executeComposioTool(
  toolName: string,
  params: any,
  connection: Connection,
  env: Env
): Promise<any> {
  const composio = getComposio(env)

  // The entityId should be stored in the connection's externalId or externalRef
  // For Composio, the entityId is typically the user's ID or connection-specific ID
  const entityId = connection.externalRef?.composioEntityId || connection.externalId

  if (!entityId) {
    throw new Error('Connection missing Composio entityId')
  }

  try {
    // Execute the tool via Composio SDK
    const result = await composio.tools.execute({
      action: toolName,
      params,
      entityId,
    })

    return result
  } catch (error) {
    console.error(`Composio tool execution failed for ${toolName}:`, error)
    throw error
  }
}
