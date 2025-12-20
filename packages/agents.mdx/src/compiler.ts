/**
 * Workflow Compiler
 * Compiles parsed workflow MDX files into executable modules
 *
 * Key insight: Return a function (not IIFE) so we can:
 * 1. Log what handlers were registered
 * 2. Inspect the workflow before running
 * 3. Control execution timing
 */

import type { ParsedWorkflow } from './parser.js'
import type { WorkflowRuntime, Issue } from './types.js'

/** Compiled workflow module */
export interface CompiledWorkflow {
  /** Workflow name */
  name: string
  /** Original file path */
  path: string
  /** Workflow metadata */
  metadata: ParsedWorkflow['metadata']
  /** Compiled source (the registrar function) */
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

/** Handler function types */
export type IssueHandler = (issue: Issue, runtime: WorkflowRuntime) => Promise<void>
export type ScheduleHandler = (runtime: WorkflowRuntime) => Promise<void>

/** What the compiled workflow function returns */
export interface WorkflowRegistration {
  name: string
  handlers: {
    'issue.ready': IssueHandler[]
    'issue.closed': IssueHandler[]
    'issue.created': IssueHandler[]
    'issue.updated': IssueHandler[]
    'epic.completed': IssueHandler[]
  }
  schedules: {
    cron: string
    handler: ScheduleHandler
  }[]
}

/** The function signature that compiled workflows return */
export type WorkflowRegistrar = (runtime: WorkflowRuntime) => WorkflowRegistration

/**
 * Wrap workflow source with registrar boilerplate
 *
 * Instead of an IIFE, we return a function that:
 * 1. Takes the runtime as input
 * 2. Executes the workflow code
 * 3. Returns what was registered (for logging/inspection)
 */
export function wrapWorkflowSource(source: string, workflowName: string): string {
  return `
// Compiled workflow: ${workflowName}
// Returns a registrar function that can be called with runtime

(function createWorkflowRegistrar() {
  return function registerWorkflow(runtime) {
    // Registration storage
    const registration = {
      name: '${workflowName}',
      handlers: {
        'issue.ready': [],
        'issue.closed': [],
        'issue.created': [],
        'issue.updated': [],
        'epic.completed': [],
      },
      schedules: [],
    };

    // Create the 'on' trigger object
    const on = {
      issue: {
        ready: (handler) => {
          registration.handlers['issue.ready'].push(handler);
          return on; // chainable
        },
        closed: (handler) => {
          registration.handlers['issue.closed'].push(handler);
          return on;
        },
        created: (handler) => {
          registration.handlers['issue.created'].push(handler);
          return on;
        },
        updated: (handler) => {
          registration.handlers['issue.updated'].push(handler);
          return on;
        },
      },
      epic: {
        completed: (handler) => {
          registration.handlers['epic.completed'].push(handler);
          return on;
        },
      },
    };

    // Create the 'every' schedule object
    const every = {
      day: (time, handler) => {
        // Convert time like '9am' to cron
        const cron = timeToCron(time, 'day');
        registration.schedules.push({ cron, handler });
        return every;
      },
      hour: (handler) => {
        registration.schedules.push({ cron: '0 * * * *', handler });
        return every;
      },
      minute: (handler) => {
        registration.schedules.push({ cron: '* * * * *', handler });
        return every;
      },
      week: (day, time, handler) => {
        const cron = timeToCron(time, 'week', day);
        registration.schedules.push({ cron, handler });
        return every;
      },
    };

    // Simple time to cron converter
    function timeToCron(time, period, day) {
      const match = time.match(/(\\d+)(am|pm)?/i);
      if (!match) return '0 9 * * *'; // default 9am

      let hour = parseInt(match[1]);
      if (match[2]?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
      if (match[2]?.toLowerCase() === 'am' && hour === 12) hour = 0;

      if (period === 'week') {
        const days = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const dayNum = days[day?.toLowerCase()] ?? 1;
        return \`0 \${hour} * * \${dayNum}\`;
      }

      return \`0 \${hour} * * *\`;
    }

    // Make runtime globals available to workflow code
    const { repo, issue, claude, pr, issues, epics, git, todo } = runtime;

    // Execute the workflow code to register handlers
    ${source}

    // Return what was registered (for logging/inspection)
    return registration;
  };
})()
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

  // Wrap the source with registrar boilerplate
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

/**
 * Execute a compiled workflow and return the registration
 *
 * @example
 * const compiled = compileWorkflow(parsed)
 * const registration = executeWorkflow(compiled, runtime)
 * console.log(`Registered ${registration.handlers['issue.ready'].length} ready handlers`)
 */
export function executeWorkflow(
  compiled: CompiledWorkflow,
  runtime: WorkflowRuntime
): WorkflowRegistration | null {
  if (!compiled.success || !compiled.source) {
    return null
  }

  try {
    // Evaluate the compiled source to get the registrar function
    const registrar = eval(compiled.source) as WorkflowRegistrar

    // Execute the registrar with the runtime
    const registration = registrar(runtime)

    return registration
  } catch (error) {
    console.error(`Failed to execute workflow ${compiled.name}:`, error)
    return null
  }
}
