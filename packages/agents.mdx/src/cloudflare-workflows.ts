/**
 * Cloudflare Workflows Integration
 *
 * Wraps the cloud transport with Cloudflare Workflows durability features:
 * - step.do() for automatic retries on transient failures
 * - step.waitForEvent() for pausing execution (e.g., waiting for PR approval)
 * - step.sleep() for delays
 *
 * This enables workflows to:
 * - Survive worker restarts
 * - Wait days/weeks for PR approvals without holding resources
 * - Retry failed API calls automatically
 * - Resume from exact point of failure
 *
 * @example
 * // In worker workflow
 * import { Workflow, WorkflowStep } from 'cloudflare:workflows'
 * import { durableTransport } from 'agents.mdx/cloudflare-workflows'
 *
 * export class DevelopWorkflow extends Workflow {
 *   async run(event, step) {
 *     const runtime = createRuntime({
 *       repo: event.payload.repo,
 *       transport: durableTransport(step, config)
 *     })
 *
 *     // All calls are now durable!
 *     await runtime.claude.do({ task: 'implement feature' })
 *     const pr = await runtime.pr.create({ ... })
 *     await runtime.pr.waitForApproval(pr) // Uses step.waitForEvent!
 *   }
 * }
 */

import type { Transport, Repo, PR } from './types'
import type { CloudTransportConfig } from './cloud'

// Cloudflare Workflows types
// Compatible with cloudflare:workers WorkflowStep
// Uses a flexible interface that works with the actual Cloudflare API
export interface WorkflowStep {
  /**
   * Execute a step with automatic retries
   * If the function throws, Workflows will retry with exponential backoff
   */
  do<T>(name: string, fn: () => Promise<T>): Promise<T>

  /**
   * Wait for an external event
   * Pauses workflow execution until the event is received or timeout expires
   *
   * Note: Cloudflare's actual API requires { type: string } in options.
   * We accept any options object for compatibility.
   */
  waitForEvent<T = unknown>(
    eventName: string,
    options?: Record<string, unknown>
  ): Promise<T | { payload: T }>

  /**
   * Sleep for a duration
   */
  sleep(duration: string): Promise<void>
}

export interface WorkflowEvent<T = unknown> {
  payload: T
  timestamp: Date
}

// ============================================================================
// Durable Transport Configuration
// ============================================================================

export interface DurableTransportConfig extends CloudTransportConfig {
  /**
   * Prefix for step names (helps with debugging in Workflows dashboard)
   */
  stepPrefix?: string

  /**
   * Whether to use step.do for all calls (default: true)
   * Set to false to disable durability (useful for testing)
   */
  useDurableSteps?: boolean

  /**
   * Custom event name mapping for special operations
   * Used by waitForEvent (e.g., PR approval)
   */
  eventNames?: {
    prApproval?: (pr: PR) => string
  }
}

// ============================================================================
// Durable Transport Factory
// ============================================================================

/**
 * Create a durable transport that wraps cloud transport with Workflows
 *
 * Every transport.call() is wrapped in step.do() for automatic retries.
 * Special methods (like pr.waitForApproval) use step.waitForEvent().
 *
 * @example
 * const transport = durableTransport(step, {
 *   repo,
 *   payloadBinding: env.PAYLOAD,
 *   installationId: event.payload.installationId,
 * })
 */
export function durableTransport(
  step: WorkflowStep,
  config: DurableTransportConfig
): Transport {
  const {
    repo,
    payloadBinding,
    claudeBinding,
    installationId,
    apiBaseUrl = 'https://todo.mdx.do/api',
    stepPrefix = '',
    useDurableSteps = true,
    eventNames = {},
  } = config

  // Helper to create step names
  const stepName = (method: string, suffix?: string): string => {
    const parts = [stepPrefix, method, suffix].filter(Boolean)
    return parts.join('.')
  }

  // Helper to wrap any call in step.do
  const durableCall = async <T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    if (!useDurableSteps) {
      return fn()
    }
    return step.do(name, fn)
  }

  return {
    async call(method: string, args: unknown[]): Promise<unknown> {
      const [namespace, ...rest] = method.split('.')
      const action = rest.join('.')

      // Special handling for pr.waitForApproval - use step.waitForEvent
      if (method === 'pr.waitForApproval') {
        const pr = args[0] as PR
        const opts = (args[1] as { timeout?: string }) || {}

        const eventName =
          eventNames.prApproval?.(pr) || `pr.${pr.number}.approved`

        // Cloudflare's waitForEvent requires 'type' in options
        const result = await step.waitForEvent(eventName, {
          type: 'pr_approval',
          timeout: opts.timeout || '7d',
        })

        // Handle both our interface and Cloudflare's { payload: T } return type
        return typeof result === 'object' && result !== null && 'payload' in result
          ? (result as { payload: unknown }).payload
          : result
      }

      // All other calls are wrapped in step.do for durability
      switch (namespace) {
        case 'claude':
          return durableCall(
            stepName('claude', action),
            () => callClaude(claudeBinding, action, args)
          )

        case 'git':
          // Git operations happen inside Claude sandbox
          return durableCall(
            stepName('git', action),
            () => callClaude(claudeBinding, `git.${action}`, args)
          )

        case 'issues':
        case 'epics':
          return durableCall(
            stepName(namespace, action),
            () => callPayload(payloadBinding, apiBaseUrl, method, args)
          )

        case 'pr':
          return durableCall(
            stepName('pr', action),
            () => callGitHub(installationId, repo, action, args)
          )

        case 'todo':
          return durableCall(
            stepName('todo', action),
            () => callTodoApi(apiBaseUrl, action, args)
          )

        default:
          throw new Error(`Unknown namespace: ${namespace}`)
      }
    },
  }
}

// ============================================================================
// Service Handlers (same as cloud.ts, but async)
// ============================================================================

async function callClaude(
  binding: unknown,
  action: string,
  args: unknown[]
): Promise<unknown> {
  if (!binding) {
    throw new Error('Claude sandbox binding not configured')
  }

  // binding is a DurableObjectNamespace for ClaudeSandbox
  const namespace = binding as {
    idFromName(name: string): { toString(): string }
    get(id: { toString(): string }): {
      fetch(request: Request): Promise<Response>
    }
  }

  // Create a unique sandbox instance for this execution
  const sandboxId = `claude-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const doId = namespace.idFromName(sandboxId)
  const sandbox = namespace.get(doId)

  // Route to appropriate handler based on action
  switch (action) {
    case 'do': {
      const [opts] = args as [{ task: string; context?: string; model?: string }]
      const response = await sandbox.fetch(new Request('http://sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: opts.task,
          context: opts.context,
          // repo and installationId should be passed via transport config
        }),
      }))

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude execution failed: ${error}`)
      }

      return response.json()
    }

    case 'research': {
      const [opts] = args as [{ topic: string; depth?: string; context?: string }]
      // Research uses the same execute endpoint with a research-focused prompt
      const response = await sandbox.fetch(new Request('http://sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: `Research: ${opts.topic}`,
          context: opts.context,
        }),
      }))

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude research failed: ${error}`)
      }

      const result = await response.json() as { summary: string; diff: string }
      return {
        findings: result.summary,
        sources: [], // Would need to parse from output
        confidence: 'medium' as const,
      }
    }

    case 'review': {
      const [opts] = args as [{ pr: { number: number; title: string; body: string } }]
      const response = await sandbox.fetch(new Request('http://sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: `Review PR #${opts.pr.number}: ${opts.pr.title}\n\n${opts.pr.body}`,
        }),
      }))

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude review failed: ${error}`)
      }

      const result = await response.json() as { summary: string }
      // Parse review output to determine approval
      const approved = !result.summary.toLowerCase().includes('reject') &&
                       !result.summary.toLowerCase().includes('changes requested')

      return {
        approved,
        comments: [], // Would need to parse from output
        summary: result.summary,
      }
    }

    case 'ask': {
      const [opts] = args as [{ question: string; context?: string }]
      const response = await sandbox.fetch(new Request('http://sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: opts.question,
          context: opts.context,
        }),
      }))

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude ask failed: ${error}`)
      }

      const result = await response.json() as { summary: string }
      return result.summary
    }

    default:
      throw new Error(`Unknown Claude action: ${action}`)
  }
}

async function callPayload(
  binding: unknown,
  apiBaseUrl: string,
  method: string,
  args: unknown[]
): Promise<unknown> {
  // If we have a service binding, use RPC
  if (binding) {
    // In real implementation:
    // const service = binding as Service<PayloadRPC>
    // return service[method](...args)
  }

  // Otherwise, fall back to HTTP API
  const response = await fetch(`${apiBaseUrl}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function callGitHub(
  installationId: number | undefined,
  repo: Repo,
  action: string,
  args: unknown[]
): Promise<unknown> {
  if (!installationId) {
    throw new Error('GitHub installation ID not configured')
  }

  // In real implementation, this would:
  // 1. Get installation access token
  // 2. Make GitHub API calls with Octokit
  // 3. Handle the specific action (create, merge, comment, etc.)

  throw new Error(`GitHub cloud transport not implemented: ${action}`)
}

async function callTodoApi(
  apiBaseUrl: string,
  action: string,
  args: unknown[]
): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl}/todo/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// ============================================================================
// Workflow Event Helpers
// ============================================================================

/**
 * Helper to create PR approval event names
 * Used by external systems to notify workflow of approval
 *
 * @example
 * // When PR is approved (webhook handler):
 * const eventName = prApprovalEvent(pr)
 * await workflow.sendEvent(eventName, { approved: true, reviewer: '...' })
 */
export function prApprovalEvent(pr: PR | { number: number }): string {
  return `pr.${pr.number}.approved`
}

/**
 * Helper to create issue ready event names
 * Used when issue becomes unblocked
 */
export function issueReadyEvent(issueId: string): string {
  return `issue.${issueId}.ready`
}

/**
 * Helper to create epic completed event names
 */
export function epicCompletedEvent(epicId: string): string {
  return `epic.${epicId}.completed`
}
