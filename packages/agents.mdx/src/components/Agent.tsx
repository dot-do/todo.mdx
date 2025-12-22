import type { AgentConfig } from '../types'

/**
 * Agent MDX component
 *
 * Defines an agent configuration with capabilities, focus areas, and autonomy level.
 *
 * @example
 * ```tsx
 * <Agent
 *   name="cody"
 *   capabilities={[
 *     { name: 'git', operations: ['commit', 'push'] },
 *     { name: 'github', operations: ['*'] }
 *   ]}
 *   focus={['typescript', 'testing']}
 *   autonomy="full"
 * />
 * ```
 *
 * @example
 * // Extend a pre-built cloud agent
 * ```tsx
 * <Agent
 *   name="custom-cody"
 *   extends="cloud:cody"
 *   autonomy="supervised"
 * />
 * ```
 */
export function Agent(props: AgentConfig): AgentConfig {
  return {
    name: props.name,
    ...(props.capabilities && { capabilities: props.capabilities }),
    ...(props.focus && { focus: props.focus }),
    ...(props.autonomy && { autonomy: props.autonomy }),
    ...(props.triggers && { triggers: props.triggers }),
    ...(props.description && { description: props.description }),
    ...(props.extends && { extends: props.extends }),
    ...(props.model && { model: props.model }),
    ...(props.instructions && { instructions: props.instructions }),
  }
}
