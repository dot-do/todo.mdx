/**
 * XState machine for IssueDO task execution lifecycle
 *
 * States: idle → preparing → executing → verifying → done
 * Also: blocked, failed
 *
 * This machine coordinates:
 * 1. Agent assignment and tool preparation
 * 2. Task execution (code generation, testing, PR creation)
 * 3. Verification of results
 * 4. Error handling and retries
 */

import { setup, assign } from 'xstate'

// =============================================================================
// Types
// =============================================================================

/**
 * Pending action types for DO to handle
 */
export type PendingAction =
  | { type: 'scheduleAlarm'; delay: number }
  | { type: 'checkTools'; issueId: string; agent: string; requiredTools: string[] }
  | { type: 'executeTask'; issueId: string; agent: string; pat: string; repo: string; installationId: number; prompt: string }
  | { type: 'verifyResults'; issueId: string; prNumber: number | null; testResults: any; commits: any[] }

/**
 * Issue execution context
 */
export interface IssueContext {
  // Issue identity
  issueId: string
  repoFullName: string
  installationId: number

  // Issue metadata
  title: string
  description: string
  acceptanceCriteria: string | null
  design: string | null

  // Agent assignment
  assignedAgent: string | null
  agentPAT: string | null // Encrypted PAT for agent

  // Tool availability
  requiredTools: string[]
  availableTools: string[]
  missingTools: string[]

  // Execution tracking
  sessionId: string | null
  startedAt: string | null
  completedAt: string | null

  // Results
  prNumber: number | null
  commits: any[]
  testResults: any | null

  // Error handling
  errorCount: number
  lastError: string | null
  maxRetries: number

  // Verification
  verificationAttempts: number
  verificationErrors: string[]

  // Pending actions queue (replaces unsafe globalThis pattern)
  pendingActions: PendingAction[]
}

/**
 * Issue execution events
 */
export type IssueEvent =
  | { type: 'ASSIGN_AGENT'; agent: string; pat: string }
  | { type: 'TOOLS_READY'; tools: string[] }
  | { type: 'TOOLS_MISSING'; missing: string[] }
  | { type: 'START_EXECUTION'; sessionId: string }
  | { type: 'COMPLETED'; prNumber: number; commits: any[]; testResults: any }
  | { type: 'FAILED'; error: string }
  | { type: 'TIMEOUT' }
  | { type: 'VERIFIED' }
  | { type: 'REJECTED'; reason: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }

// =============================================================================
// Guards
// =============================================================================

const guards = {
  hasAllTools: ({ context }: { context: IssueContext }) => {
    return context.missingTools.length === 0
  },

  canRetry: ({ context }: { context: IssueContext }) => {
    return context.errorCount < context.maxRetries
  },

  hasAgent: ({ context }: { context: IssueContext }) => {
    return context.assignedAgent !== null && context.agentPAT !== null
  },

  verificationPassed: ({ context }: { context: IssueContext }) => {
    return context.prNumber !== null && context.testResults !== null
  },

  maxVerificationAttempts: ({ context }: { context: IssueContext }) => {
    return context.verificationAttempts >= 3
  },
}

// =============================================================================
// Actions
// =============================================================================

const actions = {
  assignAgent: assign(({ event }) => {
    if (event.type !== 'ASSIGN_AGENT') return {}
    return {
      assignedAgent: event.agent,
      agentPAT: event.pat,
    }
  }),

  recordToolsReady: assign(({ event }) => {
    if (event.type !== 'TOOLS_READY') return {}
    return {
      availableTools: event.tools,
      missingTools: [],
    }
  }),

  recordToolsMissing: assign(({ event }) => {
    if (event.type !== 'TOOLS_MISSING') return {}
    return {
      missingTools: event.missing,
    }
  }),

  startExecution: assign(({ event }) => {
    if (event.type !== 'START_EXECUTION') return {}
    return {
      sessionId: event.sessionId,
      startedAt: new Date().toISOString(),
    }
  }),

  recordCompletion: assign(({ event }) => {
    if (event.type !== 'COMPLETED') return {}
    return {
      prNumber: event.prNumber,
      commits: event.commits,
      testResults: event.testResults,
      completedAt: new Date().toISOString(),
    }
  }),

  recordError: assign(({ event, context }) => {
    let lastError = null
    if (event.type === 'FAILED') {
      lastError = event.error
    } else if (event.type === 'REJECTED') {
      lastError = event.reason
    } else if (event.type === 'TIMEOUT') {
      lastError = 'Execution timeout'
    }
    return {
      lastError,
      errorCount: context.errorCount + 1,
    }
  }),

  incrementVerificationAttempts: assign(({ context }) => ({
    verificationAttempts: context.verificationAttempts + 1,
  })),

  recordVerificationError: assign(({ context, event }) => {
    if (event.type !== 'REJECTED') return {}
    return {
      verificationErrors: [...context.verificationErrors, event.reason],
    }
  }),

  resetRetries: assign({
    errorCount: 0,
    lastError: null,
  }),

  scheduleRetry: assign(({ context }: { context: IssueContext }) => {
    // Calculate exponential backoff: 1s, 2s, 4s, 8s
    const delay = Math.pow(2, context.errorCount) * 1000
    // Queue action for IssueDO to handle (safe alternative to globalThis)
    return {
      pendingActions: [...context.pendingActions, { type: 'scheduleAlarm' as const, delay }],
    }
  }),

  dispatchExecution: assign(({ context }: { context: IssueContext }) => {
    // Queue execution task for IssueDO to handle
    return {
      pendingActions: [
        ...context.pendingActions,
        {
          type: 'executeTask' as const,
          issueId: context.issueId,
          agent: context.assignedAgent!,
          pat: context.agentPAT!,
          repo: context.repoFullName,
          installationId: context.installationId,
          prompt: buildExecutionPrompt(context),
        },
      ],
    }
  }),

  checkTools: assign(({ context }: { context: IssueContext }) => {
    // Queue tool check for IssueDO to handle
    return {
      pendingActions: [
        ...context.pendingActions,
        {
          type: 'checkTools' as const,
          issueId: context.issueId,
          agent: context.assignedAgent!,
          requiredTools: context.requiredTools,
        },
      ],
    }
  }),

  verifyResults: assign(({ context }: { context: IssueContext }) => {
    // Queue verification for IssueDO to handle
    return {
      pendingActions: [
        ...context.pendingActions,
        {
          type: 'verifyResults' as const,
          issueId: context.issueId,
          prNumber: context.prNumber,
          testResults: context.testResults,
          commits: context.commits,
        },
      ],
    }
  }),

  // Clear pending actions after they've been processed
  clearPendingActions: assign({
    pendingActions: [],
  }),
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build execution prompt for task implementation
 */
function buildExecutionPrompt(context: IssueContext): string {
  let prompt = `You are implementing issue ${context.issueId} in ${context.repoFullName}.

Title: ${context.title}

Description:
${context.description}
`

  if (context.design) {
    prompt += `\nDesign Notes:
${context.design}
`
  }

  if (context.acceptanceCriteria) {
    prompt += `\nAcceptance Criteria:
${context.acceptanceCriteria}
`
  }

  prompt += `\nInstructions:
1. Clone the repo and create a new branch for this issue
2. Implement the changes according to the description and design
3. Write tests to verify your implementation
4. Run all tests and ensure they pass
5. Commit your changes with a descriptive message
6. Push your branch and create a pull request
7. The PR should reference this issue number

Your work will be verified automatically. Make sure all tests pass before creating the PR.`

  return prompt
}

// =============================================================================
// State Machine Definition
// =============================================================================

/**
 * Issue Task Execution State Machine
 *
 * States:
 * - idle: Waiting for agent assignment
 * - preparing: Checking tool availability and preparing execution environment
 * - executing: Agent is executing the task
 * - verifying: Verifying results (PR created, tests pass, etc.)
 * - done: Task completed successfully
 * - blocked: Missing required tools or dependencies
 * - failed: Execution failed after retries
 *
 * Note: Using `as any` casts to work around XState v5 type inference complexity
 */
export const issueMachine = setup({
  types: {} as {
    context: IssueContext
    events: IssueEvent
  },
  guards,
  actions: actions as any,
// @ts-ignore - XState v5 type inference is complex, using runtime types
}).createMachine({
  id: 'issueExecution',
  initial: 'idle',
  context: {
    issueId: '',
    repoFullName: '',
    installationId: 0,
    title: '',
    description: '',
    acceptanceCriteria: null,
    design: null,
    assignedAgent: null,
    agentPAT: null,
    requiredTools: [],
    availableTools: [],
    missingTools: [],
    sessionId: null,
    startedAt: null,
    completedAt: null,
    prNumber: null,
    commits: [],
    testResults: null,
    errorCount: 0,
    lastError: null,
    maxRetries: 3,
    verificationAttempts: 0,
    verificationErrors: [],
    pendingActions: [],
  },

  states: {
    idle: {
      on: {
        ASSIGN_AGENT: {
          target: 'preparing',
          actions: ['assignAgent', 'checkTools'],
        },
      },
    },

    preparing: {
      on: {
        TOOLS_READY: {
          target: 'executing',
          actions: ['recordToolsReady', 'dispatchExecution'],
        },
        TOOLS_MISSING: {
          target: 'blocked',
          actions: ['recordToolsMissing'],
        },
        CANCEL: {
          target: 'failed',
          actions: [
            assign({
              lastError: () => 'Cancelled by user',
            }),
          ],
        },
      },
    },

    executing: {
      on: {
        START_EXECUTION: {
          actions: ['startExecution'],
        },
        COMPLETED: {
          target: 'verifying',
          actions: ['recordCompletion', 'resetRetries', 'verifyResults'],
        },
        FAILED: [
          {
            guard: 'canRetry',
            target: 'executing',
            actions: ['recordError', 'scheduleRetry'],
          },
          {
            target: 'failed',
            actions: ['recordError'],
          },
        ],
        TIMEOUT: [
          {
            guard: 'canRetry',
            target: 'executing',
            actions: ['recordError', 'scheduleRetry'],
          },
          {
            target: 'failed',
            actions: ['recordError'],
          },
        ],
        CANCEL: {
          target: 'failed',
          actions: [
            assign({
              lastError: () => 'Cancelled by user',
            }),
          ],
        },
      },
    },

    verifying: {
      on: {
        VERIFIED: {
          target: 'done',
        },
        REJECTED: [
          {
            guard: 'maxVerificationAttempts',
            target: 'failed',
            actions: ['recordVerificationError', 'incrementVerificationAttempts'],
          },
          {
            target: 'executing',
            actions: [
              'recordVerificationError',
              'incrementVerificationAttempts',
              'dispatchExecution',
            ],
          },
        ],
        CANCEL: {
          target: 'failed',
          actions: [
            assign({
              lastError: () => 'Cancelled during verification',
            }),
          ],
        },
      },
    },

    blocked: {
      on: {
        TOOLS_READY: {
          target: 'executing',
          actions: ['recordToolsReady', 'dispatchExecution'],
        },
        CANCEL: {
          target: 'failed',
          actions: [
            assign({
              lastError: () => 'Cancelled while blocked',
            }),
          ],
        },
      },
    },

    done: {
      type: 'final',
    },

    failed: {
      type: 'final',
    },
  },

  // Global transitions
  on: {
    CANCEL: {
      target: '.failed',
      actions: [
        assign({
          lastError: () => 'Cancelled',
        }),
      ],
    },
  },
})
