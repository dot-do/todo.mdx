import type { Connection, Integration, Tool } from './types'
import { ToolRegistry } from './registry'
import { toBindingName } from './naming'

/**
 * Create tool bindings for sandbox execution.
 * Returns an object like { github: { createBranch, createPullRequest, ... }, ... }
 */
export function createToolBindings(
  connections: Connection[],
  registry: ToolRegistry,
  env?: any,
  logToolExecution?: (tool: string, params: any, result: any, error?: string, durationMs?: number) => Promise<void>
): Record<string, Record<string, (params: any) => Promise<any>>> {
  const bindings: Record<string, Record<string, (params: any) => Promise<any>>> = {}

  for (const conn of connections) {
    const integration = registry.get(conn.app)
    if (!integration) continue

    const bindingName = toBindingName(conn.app)  // 'GitHub' → 'github'
    bindings[bindingName] = {}

    for (const tool of integration.tools) {
      bindings[bindingName][tool.name] = async (params: any) => {
        const startTime = Date.now()
        try {
          // Validate params against schema
          const validated = tool.schema.parse(params)
          const result = await tool.execute(validated, conn, env)

          if (logToolExecution) {
            await logToolExecution(tool.fullName, params, result, undefined, Date.now() - startTime)
          }

          return result
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          if (logToolExecution) {
            await logToolExecution(tool.fullName, params, undefined, errorMsg, Date.now() - startTime)
          }
          throw error
        }
      }
    }
  }

  return bindings
}
