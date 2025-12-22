/**
 * Agent MDX Components
 *
 * Components for defining agent configurations in MDX files.
 *
 * @example
 * ```mdx
 * import { Agent, Capability, Trigger } from 'agents.mdx/components'
 *
 * <Agent
 *   name="cody"
 *   autonomy="full"
 *   capabilities={[
 *     { name: 'git', operations: ['commit', 'push'] },
 *     { name: 'github', operations: ['*'] }
 *   ]}
 *   focus={['typescript', 'testing']}
 *   triggers={[
 *     { event: 'issue.ready', condition: 'priority >= 3' }
 *   ]}
 * />
 * ```
 */

export { Agent } from './Agent'
export { Capability } from './Capability'
export { Trigger } from './Trigger'
