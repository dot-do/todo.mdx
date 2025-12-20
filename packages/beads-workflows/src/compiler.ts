/**
 * Workflow Compiler
 * Compiles parsed workflow MDX files into executable modules
 */

import type { ParsedWorkflow } from './parser.js'

/** Compiled workflow module */
export interface CompiledWorkflow {
  /** Workflow name */
  name: string
  /** Original file path */
  path: string
  /** Workflow metadata */
  metadata: ParsedWorkflow['metadata']
  /** Compiled TypeScript/JavaScript source */
  source: string
  /** Whether compilation succeeded */
  success: boolean
  /** Compilation errors if any */
  errors: CompilationError[]
}

/** Compilation error */
export interface CompilationError {
  message: string
  line?: number
  column?: number
}

/** Registered event handlers from a compiled workflow */
export interface WorkflowHandlers {
  /** Issue event handlers */
  issue: {
    ready: Array<(issue: unknown) => Promise<void>>
    created: Array<(issue: unknown) => Promise<void>>
    updated: Array<(issue: unknown, changes: unknown) => Promise<void>>
    closed: Array<(issue: unknown) => Promise<void>>
    blocked: Array<(issue: unknown, blockedBy: string[]) => Promise<void>>
    reopened: Array<(issue: unknown) => Promise<void>>
  }
  /** Epic event handlers */
  epic: {
    completed: Array<(epic: unknown) => Promise<void>>
    progress: Array<(epic: unknown, progress: unknown) => Promise<void>>
  }
  /** Scheduled handlers */
  schedule: {
    day: Array<{ time: string; handler: () => Promise<void> }>
    hour: Array<() => Promise<void>>
    minute: Array<() => Promise<void>>
    week: Array<{ day: string; time: string; handler: () => Promise<void> }>
  }
}

/**
 * Create empty handler registry
 */
export function createHandlerRegistry(): WorkflowHandlers {
  return {
    issue: {
      ready: [],
      created: [],
      updated: [],
      closed: [],
      blocked: [],
      reopened: [],
    },
    epic: {
      completed: [],
      progress: [],
    },
    schedule: {
      day: [],
      hour: [],
      minute: [],
      week: [],
    },
  }
}

/**
 * Wrap workflow source with module boilerplate
 * This creates the `on` and `every` globals that register handlers
 */
export function wrapWorkflowSource(source: string, workflowName: string): string {
  return `
// Compiled workflow: ${workflowName}
// This module registers event handlers when executed

(function(handlers) {
  // Create the 'on' trigger object
  const on = {
    issue: {
      ready: (handler) => handlers.issue.ready.push(handler),
      created: (handler) => handlers.issue.created.push(handler),
      updated: (handler) => handlers.issue.updated.push(handler),
      closed: (handler) => handlers.issue.closed.push(handler),
      blocked: (handler) => handlers.issue.blocked.push(handler),
      reopened: (handler) => handlers.issue.reopened.push(handler),
    },
    epic: {
      completed: (handler) => handlers.epic.completed.push(handler),
      progress: (handler) => handlers.epic.progress.push(handler),
    },
  };

  // Create the 'every' schedule object
  const every = {
    day: (time, handler) => handlers.schedule.day.push({ time, handler }),
    hour: (handler) => handlers.schedule.hour.push(handler),
    minute: (handler) => handlers.schedule.minute.push(handler),
    week: (day, time, handler) => handlers.schedule.week.push({ day, time, handler }),
  };

  // Make on and every available to the workflow code
  globalThis.on = on;
  globalThis.every = every;

  // Execute the workflow code to register handlers
  ${source}
})
`
}

/**
 * Compile a parsed workflow into an executable module
 */
export function compileWorkflow(workflow: ParsedWorkflow): CompiledWorkflow {
  const errors: CompilationError[] = []

  // Validate that we have code to compile
  if (!workflow.source.trim()) {
    errors.push({ message: 'No TypeScript code blocks found in workflow' })
    return {
      name: workflow.name,
      path: workflow.path,
      metadata: workflow.metadata,
      source: '',
      success: false,
      errors,
    }
  }

  // Validate basic syntax (check for common issues)
  const syntaxIssues = validateWorkflowSyntax(workflow.source)
  errors.push(...syntaxIssues)

  // Wrap the source with module boilerplate
  const compiledSource = wrapWorkflowSource(workflow.source, workflow.name)

  return {
    name: workflow.name,
    path: workflow.path,
    metadata: workflow.metadata,
    source: compiledSource,
    success: errors.length === 0,
    errors,
  }
}

/**
 * Basic syntax validation for workflow code
 */
function validateWorkflowSyntax(source: string): CompilationError[] {
  const errors: CompilationError[] = []

  // Check for common workflow patterns
  const hasEventHandler = /on\.(issue|epic)\.(\w+)\s*\(/.test(source)
  const hasSchedule = /every\.(day|hour|minute|week)\s*\(/.test(source)

  if (!hasEventHandler && !hasSchedule) {
    errors.push({
      message: 'Workflow must contain at least one event handler (on.issue.*, on.epic.*) or schedule (every.*)',
    })
  }

  // Check for unbalanced braces/parens (basic check)
  const openBraces = (source.match(/\{/g) || []).length
  const closeBraces = (source.match(/\}/g) || []).length
  if (openBraces !== closeBraces) {
    errors.push({
      message: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
    })
  }

  const openParens = (source.match(/\(/g) || []).length
  const closeParens = (source.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    errors.push({
      message: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
    })
  }

  return errors
}

/**
 * Compile multiple workflows
 */
export function compileWorkflows(workflows: ParsedWorkflow[]): CompiledWorkflow[] {
  return workflows.map(compileWorkflow)
}
