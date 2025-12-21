/**
 * Custom Workflow Definitions
 *
 * Allows users to define custom automation workflows using .workflows/*.mdx files.
 *
 * Example workflow definition:
 * ```mdx
 * ---
 * name: deploy-preview
 * triggers:
 *   - pr.opened
 *   - pr.synchronize
 * ---
 *
 * # Deploy Preview Workflow
 *
 * <Step name="build">
 *   <Claude task="Build the project and create a preview deployment" />
 * </Step>
 *
 * <Step name="deploy" after="build">
 *   <GitHub action="comment" body="Preview deployed to: {preview_url}" />
 * </Step>
 * ```
 */

// ============================================================================
// Workflow Definition Types
// ============================================================================

/**
 * Trigger events that can start a workflow
 */
export type WorkflowTrigger =
  | 'issue.ready'
  | 'issue.created'
  | 'issue.updated'
  | 'issue.closed'
  | 'pr.opened'
  | 'pr.synchronize'
  | 'pr.merged'
  | 'pr.closed'
  | 'push'
  | 'schedule'
  | 'manual'

/**
 * Step action types
 */
export type StepAction =
  | { type: 'claude'; task: string; context?: string; push?: boolean }
  | { type: 'github'; action: 'create_pr' | 'merge_pr' | 'comment' | 'label'; params: Record<string, any> }
  | { type: 'slack'; channel: string; message: string }
  | { type: 'linear'; action: 'create_issue' | 'update_issue' | 'comment'; params: Record<string, any> }
  | { type: 'webhook'; url: string; method?: 'GET' | 'POST'; body?: Record<string, any> }
  | { type: 'wait'; event: string; timeout?: string }
  | { type: 'parallel'; steps: WorkflowStep[] }

/**
 * A single step in a workflow
 */
export interface WorkflowStep {
  name: string
  action: StepAction
  condition?: {
    if?: string  // Expression to evaluate
    unless?: string
  }
  after?: string | string[]  // Dependencies on other steps
  retries?: number
  timeout?: string  // e.g., '5m', '1h', '1d'
}

/**
 * Complete workflow definition
 */
export interface WorkflowDefinition {
  name: string
  description?: string
  triggers: WorkflowTrigger[]
  inputs?: Record<string, { type: string; required?: boolean; default?: any }>
  steps: WorkflowStep[]
  on_error?: 'continue' | 'abort' | 'retry'
}

// ============================================================================
// Workflow Parser
// ============================================================================

/**
 * Parse a .workflows/*.mdx file into a WorkflowDefinition
 */
export function parseWorkflowMdx(content: string): WorkflowDefinition {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!frontmatterMatch) {
    throw new Error('Workflow file must have frontmatter')
  }

  const frontmatter = parseFrontmatter(frontmatterMatch[1])
  const body = content.slice(frontmatterMatch[0].length).trim()

  // Parse steps from MDX body
  const steps = parseSteps(body)

  return {
    name: frontmatter.name || 'unnamed-workflow',
    description: frontmatter.description,
    triggers: frontmatter.triggers || ['manual'],
    inputs: frontmatter.inputs,
    steps,
    on_error: frontmatter.on_error || 'abort',
  }
}

/**
 * Parse YAML-like frontmatter
 */
function parseFrontmatter(yaml: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = yaml.split('\n')
  let currentKey = ''
  let inArray = false
  let arrayItems: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Array item
    if (trimmed.startsWith('- ')) {
      arrayItems.push(trimmed.slice(2).trim())
      continue
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      // Save previous array if any
      if (inArray && currentKey) {
        result[currentKey] = arrayItems
        arrayItems = []
        inArray = false
      }

      const key = trimmed.slice(0, colonIndex).trim()
      const value = trimmed.slice(colonIndex + 1).trim()

      if (value === '') {
        // Might be start of array or nested object
        currentKey = key
        inArray = true
      } else {
        result[key] = value
      }
    }
  }

  // Save final array if any
  if (inArray && currentKey) {
    result[currentKey] = arrayItems
  }

  return result
}

/**
 * Parse workflow steps from MDX body
 */
function parseSteps(mdx: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  // Simple regex-based parsing for Step components
  const stepRegex = /<Step\s+([^>]+)>([\s\S]*?)<\/Step>/g
  let match

  while ((match = stepRegex.exec(mdx)) !== null) {
    const attrs = parseAttributes(match[1])
    const body = match[2].trim()

    const step: WorkflowStep = {
      name: attrs.name || `step-${steps.length}`,
      action: parseAction(body),
    }

    if (attrs.after) {
      step.after = attrs.after.includes(',')
        ? attrs.after.split(',').map((s: string) => s.trim())
        : attrs.after
    }

    if (attrs.if) step.condition = { if: attrs.if }
    if (attrs.unless) step.condition = { ...step.condition, unless: attrs.unless }
    if (attrs.retries) step.retries = parseInt(attrs.retries, 10)
    if (attrs.timeout) step.timeout = attrs.timeout

    steps.push(step)
  }

  return steps
}

/**
 * Parse JSX-like attributes
 */
function parseAttributes(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRegex = /(\w+)=["']([^"']+)["']|(\w+)=\{([^}]+)\}/g
  let match

  while ((match = attrRegex.exec(str)) !== null) {
    const key = match[1] || match[3]
    const value = match[2] || match[4]
    attrs[key] = value
  }

  return attrs
}

/**
 * Parse action from step body
 */
function parseAction(body: string): StepAction {
  // Parse Claude action
  if (body.includes('<Claude')) {
    const attrs = parseAttributes(body)
    return {
      type: 'claude',
      task: attrs.task || '',
      context: attrs.context,
      push: attrs.push === 'true',
    }
  }

  // Parse GitHub action
  if (body.includes('<GitHub')) {
    const attrs = parseAttributes(body)
    return {
      type: 'github',
      action: attrs.action as any,
      params: attrs,
    }
  }

  // Parse Slack action
  if (body.includes('<Slack')) {
    const attrs = parseAttributes(body)
    return {
      type: 'slack',
      channel: attrs.channel || '#general',
      message: attrs.message || '',
    }
  }

  // Parse Linear action
  if (body.includes('<Linear')) {
    const attrs = parseAttributes(body)
    return {
      type: 'linear',
      action: attrs.action as any,
      params: attrs,
    }
  }

  // Parse Webhook action
  if (body.includes('<Webhook')) {
    const attrs = parseAttributes(body)
    return {
      type: 'webhook',
      url: attrs.url || '',
      method: (attrs.method as any) || 'POST',
    }
  }

  // Parse Wait action
  if (body.includes('<Wait')) {
    const attrs = parseAttributes(body)
    return {
      type: 'wait',
      event: attrs.event || '',
      timeout: attrs.timeout,
    }
  }

  // Parse Parallel action
  if (body.includes('<Parallel')) {
    const innerSteps = parseSteps(body)
    return {
      type: 'parallel',
      steps: innerSteps,
    }
  }

  throw new Error(`Unknown action in step body: ${body.slice(0, 100)}...`)
}

// ============================================================================
// Workflow Registry
// ============================================================================

/**
 * Registry of custom workflows loaded from .workflows/ directory
 */
export class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition> = new Map()

  /**
   * Load workflows from a directory (fetched from GitHub)
   */
  async loadFromRepo(files: Array<{ path: string; content: string }>): Promise<void> {
    for (const file of files) {
      if (!file.path.endsWith('.mdx')) continue

      try {
        const workflow = parseWorkflowMdx(file.content)
        this.workflows.set(workflow.name, workflow)
        console.log(`[WorkflowRegistry] Loaded workflow: ${workflow.name}`)
      } catch (error) {
        console.error(`[WorkflowRegistry] Failed to parse ${file.path}:`, error)
      }
    }
  }

  /**
   * Get a workflow by name
   */
  get(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name)
  }

  /**
   * Get all workflows that match a trigger
   */
  getByTrigger(trigger: WorkflowTrigger): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
      .filter(w => w.triggers.includes(trigger))
  }

  /**
   * List all registered workflows
   */
  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }
}

// ============================================================================
// Workflow Executor
// ============================================================================

export interface ExecutionContext {
  repo: { owner: string; name: string }
  issue?: { id: string; title: string }
  pr?: { number: number; url: string }
  commit?: { sha: string; message: string }
  inputs: Record<string, any>
  outputs: Record<string, any>  // Step outputs keyed by step name
}

/**
 * Execute a workflow definition
 */
export async function executeWorkflow(
  definition: WorkflowDefinition,
  context: ExecutionContext,
  executor: {
    runStep: (step: WorkflowStep, context: ExecutionContext) => Promise<any>
  }
): Promise<{ success: boolean; outputs: Record<string, any>; error?: string }> {
  const outputs: Record<string, any> = {}
  const completedSteps = new Set<string>()

  // Build dependency graph
  const stepMap = new Map(definition.steps.map(s => [s.name, s]))

  // Topological sort and execute
  const pending = [...definition.steps]

  while (pending.length > 0) {
    // Find steps that can run (all dependencies satisfied)
    const ready = pending.filter(step => {
      if (!step.after) return true
      const deps = Array.isArray(step.after) ? step.after : [step.after]
      return deps.every(d => completedSteps.has(d))
    })

    if (ready.length === 0 && pending.length > 0) {
      return {
        success: false,
        outputs,
        error: `Circular dependency or unsatisfied dependencies: ${pending.map(s => s.name).join(', ')}`,
      }
    }

    // Execute ready steps (could be parallel)
    for (const step of ready) {
      try {
        // Check conditions
        if (step.condition?.if && !evaluateCondition(step.condition.if, context)) {
          console.log(`[Workflow] Skipping ${step.name}: condition not met`)
          completedSteps.add(step.name)
          continue
        }
        if (step.condition?.unless && evaluateCondition(step.condition.unless, context)) {
          console.log(`[Workflow] Skipping ${step.name}: unless condition met`)
          completedSteps.add(step.name)
          continue
        }

        const result = await executor.runStep(step, { ...context, outputs })
        outputs[step.name] = result
        completedSteps.add(step.name)
        console.log(`[Workflow] Completed step: ${step.name}`)
      } catch (error) {
        console.error(`[Workflow] Step ${step.name} failed:`, error)

        if (definition.on_error === 'abort') {
          return { success: false, outputs, error: String(error) }
        }
        // 'continue' - mark as complete and move on
        completedSteps.add(step.name)
      }

      // Remove from pending
      const idx = pending.indexOf(step)
      if (idx >= 0) pending.splice(idx, 1)
    }
  }

  return { success: true, outputs }
}

/**
 * Simple condition evaluator
 */
function evaluateCondition(expr: string, context: ExecutionContext): boolean {
  // Very simple: just check for truthy values in context
  // In a real implementation, use a proper expression parser
  const parts = expr.split('.')
  let value: any = context

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part]
    } else {
      return false
    }
  }

  return Boolean(value)
}
