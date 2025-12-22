import type { CapabilityConfig } from '../types'

/**
 * Capability MDX component
 *
 * Declares a tool or capability that an agent can access, with optional
 * operation restrictions and constraints.
 *
 * @example
 * ```tsx
 * <Capability name="git" operations={['commit', 'push']} />
 * ```
 *
 * @example
 * // Wildcard - all operations allowed
 * ```tsx
 * <Capability name="github" operations={['*']} />
 * ```
 *
 * @example
 * // With constraints
 * ```tsx
 * <Capability
 *   name="github"
 *   operations={['pr', 'issues']}
 *   constraints={{ rateLimit: 100 }}
 * />
 * ```
 */
export function Capability(props: CapabilityConfig): CapabilityConfig {
  return {
    name: props.name,
    ...(props.operations && { operations: props.operations }),
    ...(props.description && { description: props.description }),
    ...(props.constraints && { constraints: props.constraints }),
  }
}
