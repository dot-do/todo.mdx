import type { Connection, Tool } from '../tools/types'
import { ToolRegistry } from '../tools/registry'
import { toBindingName } from '../tools/naming'

/**
 * Generate TypeScript declarations for agent context.
 * Agent sees: declare const github: { createBranch(...): Promise<...> }
 */
export function generateTypeDefs(
  connections: Connection[],
  registry: ToolRegistry
): string {
  const lines: string[] = ['// Auto-generated tool type definitions']

  for (const conn of connections) {
    const integration = registry.get(conn.app)
    if (!integration) continue

    const bindingName = toBindingName(conn.app)
    lines.push('')
    lines.push(`declare const ${bindingName}: {`)

    for (const tool of integration.tools) {
      // Convert zod schema to TypeScript type string
      const paramsType = zodToTypeString(tool.schema)
      lines.push(`  ${tool.name}(params: ${paramsType}): Promise<any>`)
    }

    lines.push('}')
  }

  return lines.join('\n')
}

function zodToTypeString(schema: any): string {
  // Simplified - could use zod-to-ts for full fidelity
  if (schema._def?.typeName === 'ZodObject') {
    const shape = schema._def.shape()
    const props = Object.entries(shape).map(([k, v]: [string, any]) => {
      const isOptional = v._def?.typeName === 'ZodOptional'
      return `${k}${isOptional ? '?' : ''}: ${zodToTypeString(isOptional ? v._def.innerType : v)}`
    })
    return `{ ${props.join('; ')} }`
  }
  if (schema._def?.typeName === 'ZodString') return 'string'
  if (schema._def?.typeName === 'ZodNumber') return 'number'
  if (schema._def?.typeName === 'ZodBoolean') return 'boolean'
  if (schema._def?.typeName === 'ZodArray') return `${zodToTypeString(schema._def.type)}[]`
  if (schema._def?.typeName === 'ZodAny') return 'any'
  return 'any'
}
