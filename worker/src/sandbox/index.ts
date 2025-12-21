/**
 * Sandbox Module
 *
 * Provides CapnWeb-based sandboxing for secure workflow code execution.
 * All calls from sandboxed code are proxied through capability-controlled RPC.
 */

export { SandboxedWorkflowAPI, handleSandboxRpc } from './server'
export {
  SandboxOutboundProxy,
  loadSandboxedWorker,
  executeSandboxedWorkflow,
  executeWorkflowTrigger,
  WorkflowRegistry,
  workflowRegistry,
} from './loader'
export type { SandboxConfig, WorkflowTrigger, WorkflowModule } from './loader'

// Re-export Sandbox from Cloudflare SDK (required for DO class)
export { Sandbox } from '@cloudflare/sandbox'

// Alias for migration from ClaudeSandbox to Sandbox
// Can be removed after migration completes
import { Sandbox as _Sandbox } from '@cloudflare/sandbox'
export const ClaudeSandbox = _Sandbox

// Claude Code Sandbox types
export type { ExecuteOptions, ExecuteResult, StreamEvent, Session } from './claude'
