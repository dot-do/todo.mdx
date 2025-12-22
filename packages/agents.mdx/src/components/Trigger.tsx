import type { TriggerConfig } from '../types'

/**
 * Trigger MDX component
 *
 * Declares an event or schedule trigger for agent automation.
 *
 * @example
 * // Event trigger
 * ```tsx
 * <Trigger event="issue.ready" />
 * ```
 *
 * @example
 * // Event trigger with condition
 * ```tsx
 * <Trigger
 *   event="issue.ready"
 *   condition="priority >= 3"
 * />
 * ```
 *
 * @example
 * // Schedule trigger with cron
 * ```tsx
 * <Trigger
 *   event="schedule"
 *   cron="0 9 * * *"
 * />
 * ```
 *
 * @example
 * // With handler function
 * ```tsx
 * <Trigger
 *   event="issue.closed"
 *   handler={async (event, runtime) => {
 *     await runtime.claude.do`celebrate completion`
 *   }}
 * />
 * ```
 */
export function Trigger(props: TriggerConfig): TriggerConfig {
  return {
    event: props.event,
    ...(props.condition && { condition: props.condition }),
    ...(props.cron && { cron: props.cron }),
    ...(props.handler && { handler: props.handler }),
  }
}
