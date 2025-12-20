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
