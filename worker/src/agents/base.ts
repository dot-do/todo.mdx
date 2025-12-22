import { RpcTarget } from 'cloudflare:workers'

// Agent definition
export interface AgentDef {
  id: string
  name: string
  description: string
  tools: string[]
  tier: 'light' | 'worker' | 'sandbox'
  model: 'best' | 'fast' | 'cheap' | 'overall' | string
  framework: 'ai-sdk' | 'claude-agent-sdk' | 'openai-agents' | 'claude-code'
  instructions?: string
  maxSteps?: number
  timeout?: number
}

// Options
export interface DoOptions {
  stream?: boolean  // default: true
  onEvent?: (e: AgentEvent) => void
  timeout?: number
  maxSteps?: number
}

export interface AskOptions {
  stream?: boolean  // default: false
  onEvent?: (e: AgentEvent) => void
  timeout?: number
}

// Results
export interface DoResult {
  success: boolean
  output: string
  artifacts?: Artifact[]
  events: AgentEvent[]
}

export interface AskResult {
  answer: string
  sources?: Source[]
  confidence?: number
}

// Artifacts and Sources
export interface Artifact {
  type: 'pr' | 'commit' | 'file' | 'branch' | 'test-results'
  ref: string
  url?: string
  /** Additional data for complex artifacts (e.g., test results) */
  data?: unknown
}

export interface Source {
  title: string
  url?: string
  snippet?: string
}

// Events
export type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; tool: string; params: unknown; id: string }
  | { type: 'tool_result'; tool: string; result: unknown; id: string }
  | { type: 'message'; content: string }
  | { type: 'error'; error: string }
  | { type: 'done'; result: DoResult | AskResult }

// Abstract base class
export abstract class Agent extends RpcTarget {
  abstract readonly def: AgentDef

  abstract do(task: string, options?: DoOptions): Promise<DoResult>
  abstract ask(question: string, options?: AskOptions): Promise<AskResult>
}
