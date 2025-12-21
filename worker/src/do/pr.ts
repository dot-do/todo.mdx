/**
 * PRDO: Pull Request Durable Object
 *
 * Manages autonomous code review lifecycle using XState.
 * When an agent opens a PR, configured reviewers (agents and/or humans) review sequentially.
 * If changes are requested, the author agent is dispatched to fix issues.
 * Review cycle repeats until all reviewers approve.
 *
 * See: notes/plans/2025-12-20-prdo-code-review-sdlc-design.md
 */

import { DurableObject } from 'cloudflare:workers'
import { createActor, setup, assign } from 'xstate'

export interface Env {
  DB: D1Database
  REPO: DurableObjectNamespace
  PROJECT: DurableObjectNamespace
  PRDO: DurableObjectNamespace
  GITHUB_APP_ID: string
  GITHUB_PRIVATE_KEY: string
  // Sandbox binding for dispatching review/fix sessions
  SANDBOX?: {
    run(config: {
      agent: string
      pat: string
      task: 'review' | 'fix'
      prompt: string
      repo: string
      pr: number
      callback: string
    }): Promise<{ sessionId: string }>
  }
}

// =============================================================================
// Types (from design doc Section 2)
// =============================================================================

/**
 * Reviewer configuration
 */
export interface ReviewerConfig {
  agent: string
  type: 'agent' | 'human'
  pat?: string // encrypted, for agents
  canEscalate?: string[] // e.g., ['sam']
}

/**
 * Review outcome from a single reviewer
 */
export interface ReviewOutcome {
  reviewer: string
  decision: 'approved' | 'changes_requested'
  comment: string
  escalations: string[]
  timestamp: string
}

/**
 * PR state machine context
 */
export interface PRContext {
  // PR identity
  prNumber: number
  repoFullName: string
  installationId: number

  // Author (for dispatching fix sessions)
  authorAgent: string
  authorPAT: string // encrypted

  // Review configuration
  reviewers: ReviewerConfig[]
  currentReviewerIndex: number

  // Session tracking
  currentSessionId: string | null
  reviewOutcomes: ReviewOutcome[]

  // Error handling
  retryCount: number
  lastError: string | null

  // Audit
  mergeType: 'auto' | 'approved' | 'forced' | null
}

/**
 * PR state machine events
 */
export type PREvent =
  | { type: 'PR_OPENED'; prNumber: number; author: string; base: string; head: string; installationId: number; repoFullName: string }
  | { type: 'CONFIG_LOADED'; reviewers: ReviewerConfig[]; authorPAT: string }
  | { type: 'SESSION_STARTED'; sessionId: string }
  | { type: 'SESSION_FAILED'; error: string }
  | { type: 'REVIEW_COMPLETE'; reviewer: string; decision: 'approved' | 'changes_requested'; body: string }
  | { type: 'FIX_COMPLETE'; commits: any[] }
  | { type: 'CLOSE'; merged: boolean }
  | { type: 'RETRY' }
  | { type: 'MERGE' }

// =============================================================================
// Escalation Parsing
// =============================================================================

/**
 * Parse escalation markers from review comment body
 *
 * Supports formats:
 * - `<!-- escalate: sam -->`
 * - `<!-- escalate: sam, priya -->`
 * - Multiple markers in same comment
 *
 * @param body Review comment body (may contain HTML comments)
 * @returns Array of agent names to escalate to
 */
export function parseEscalations(body: string): string[] {
  if (!body) return []

  // Match all HTML comments with escalate: prefix
  const escalationRegex = /<!--\s*escalate:\s*([^-]+?)\s*-->/gi
  const matches = [...body.matchAll(escalationRegex)]

  if (matches.length === 0) return []

  // Extract agent names from all matches
  const agents: string[] = []
  for (const match of matches) {
    const agentList = match[1]
    // Split by comma, trim whitespace, filter empty strings
    const agentNames = agentList
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
    agents.push(...agentNames)
  }

  // Remove duplicates
  return [...new Set(agents)]
}

// =============================================================================
// Prompt Builders for Sandbox Sessions
// =============================================================================

/**
 * Build persona-specific review prompt for different reviewer types
 *
 * @param reviewer Reviewer configuration with agent persona
 * @param context Current PR context
 * @returns Formatted prompt for Claude Code session
 */
function buildReviewPrompt(reviewer: ReviewerConfig, context: PRContext): string {
  // Define persona-specific instructions
  const personas: Record<string, string> = {
    priya: `You are Priya, a Product reviewer. Review PR #${context.prNumber} for:
- Roadmap alignment and strategic fit
- User impact and experience improvements
- Product consistency and feature completeness
- Documentation and user-facing changes`,

    quinn: `You are Quinn, a QA reviewer. Review PR #${context.prNumber} for:
- Code quality and maintainability
- Test coverage (unit, integration, E2E)
- Edge cases and error handling
- Performance implications`,

    sam: `You are Sam, a Security reviewer. Review PR #${context.prNumber} for:
- Security vulnerabilities and attack vectors
- Authentication and authorization issues
- Data exposure and privacy concerns
- Input validation and sanitization`,
  }

  // Default persona if not recognized
  const personaPrompt =
    personas[reviewer.agent] ||
    `You are ${reviewer.agent}, a code reviewer. Review PR #${context.prNumber} thoroughly.`

  // Build escalation instructions if configured
  const escalationInstructions = reviewer.canEscalate?.length
    ? `\n5. If you identify concerns requiring ${reviewer.canEscalate.join(' or ')} review, include: <!-- escalate: ${reviewer.canEscalate.join(', ')} -->`
    : ''

  return `${personaPrompt}

Repository: ${context.repoFullName}
PR: #${context.prNumber}

Instructions:
1. Clone the repo and checkout the PR branch
2. Review the changes thoroughly according to your role
3. Run tests and verify functionality
4. Submit a GitHub review with APPROVE or REQUEST_CHANGES
5. Be specific about what needs to change if requesting changes${escalationInstructions}

Remember: You must submit your review as ${reviewer.agent} using the GitHub review API.`
}

/**
 * Build fix prompt for author to address review feedback
 *
 * @param review Most recent review outcome with feedback
 * @param context Current PR context
 * @returns Formatted prompt for fix session
 */
function buildFixPrompt(review: ReviewOutcome, context: PRContext): string {
  return `You are the author of PR #${context.prNumber} in ${context.repoFullName}.

${review.reviewer} requested changes with the following feedback:

---
${review.comment}
---

Instructions:
1. Clone the repo and checkout your PR branch
2. Address ALL the feedback above
3. Make necessary code changes, add tests, update documentation
4. Commit and push your fixes
5. Do NOT submit a review - just push the fixes

The review cycle will automatically continue once you push your changes.`
}


// =============================================================================
// XState Machine (placeholder - full implementation in future issue)
// =============================================================================

/**
 * PR Review State Machine
 *
 * States: pending → reviewing → checkingApproval → approved → merged
 *         reviewing → fixing → reviewing (if changes requested)
 *         any → closed/error (global transitions)
 */
const prMachine = setup({
  types: {
    context: {} as PRContext,
    events: {} as PREvent,
  },
  guards: {
    isApproved: ({ event }) => event.type === 'REVIEW_COMPLETE' && event.decision === 'approved',
    isChangesRequested: ({ event }) => event.type === 'REVIEW_COMPLETE' && event.decision === 'changes_requested',
    hasMoreReviewers: ({ context }) => context.currentReviewerIndex < context.reviewers.length - 1,
    allApproved: ({ context }) => context.currentReviewerIndex >= context.reviewers.length - 1,
    canRetry: ({ context }) => context.retryCount < 3,
    wasMerged: ({ event }) => event.type === 'CLOSE' && event.merged === true,
  },
  actions: {
    loadRepoConfig: assign({
      // Placeholder: will fetch config from Payload CMS
    }),
    dispatchReviewSession: ({ context }) => {
      // Get current reviewer config
      const reviewer = context.reviewers[context.currentReviewerIndex]
      if (!reviewer) {
        console.error('[PRDO] No reviewer found at index', context.currentReviewerIndex)
        return
      }

      const callbackUrl = `https://api.todo.mdx.do/pr/${context.repoFullName}/${context.prNumber}/session`

      // Set global flag for PRDO to intercept and dispatch sandbox session
      ;(globalThis as any).__sandboxSession = {
        agent: reviewer.agent,
        pat: reviewer.pat || '', // TODO: decrypt with env.ENCRYPTION_KEY
        task: 'review' as const,
        prompt: buildReviewPrompt(reviewer, context),
        repo: context.repoFullName,
        pr: context.prNumber,
        callback: callbackUrl,
      }
    },
    dispatchFixSession: ({ context }) => {
      // Get most recent review feedback
      const lastReview = context.reviewOutcomes.at(-1)
      if (!lastReview) {
        console.error('[PRDO] No review outcome found for fix session')
        return
      }

      const callbackUrl = `https://api.todo.mdx.do/pr/${context.repoFullName}/${context.prNumber}/session`

      // Set global flag for PRDO to intercept and dispatch sandbox session
      ;(globalThis as any).__sandboxSession = {
        agent: context.authorAgent,
        pat: context.authorPAT, // TODO: decrypt with env.ENCRYPTION_KEY
        task: 'fix' as const,
        prompt: buildFixPrompt(lastReview, context),
        repo: context.repoFullName,
        pr: context.prNumber,
        callback: callbackUrl,
      }
    },
    recordOutcome: assign({
      reviewOutcomes: ({ context, event }) => {
        if (event.type !== 'REVIEW_COMPLETE') return context.reviewOutcomes
        const escalations = parseEscalations(event.body)
        return [
          ...context.reviewOutcomes,
          {
            reviewer: event.reviewer,
            decision: event.decision,
            comment: event.body,
            escalations,
            timestamp: new Date().toISOString(),
          },
        ]
      },
    }),
    addEscalations: assign({
      reviewers: ({ context, event }) => {
        if (event.type !== 'REVIEW_COMPLETE') return context.reviewers

        // Parse escalations from review body
        const escalations = parseEscalations(event.body)
        if (escalations.length === 0) return context.reviewers

        // Get current reviewer's config to check canEscalate permissions
        const currentReviewer = context.reviewers[context.currentReviewerIndex]
        if (!currentReviewer || !currentReviewer.canEscalate) return context.reviewers

        // Filter escalations to only those the current reviewer can escalate to
        const allowedEscalations = escalations.filter((agent) =>
          currentReviewer.canEscalate?.includes(agent)
        )

        if (allowedEscalations.length === 0) return context.reviewers

        // Get current reviewer names to avoid duplicates
        const existingReviewers = new Set(context.reviewers.map((r) => r.agent))

        // Create new reviewer configs for valid escalations not already in list
        const newReviewers: ReviewerConfig[] = allowedEscalations
          .filter((agent) => !existingReviewers.has(agent))
          .map((agent) => ({
            agent,
            type: 'agent' as const,
            // Note: PAT will need to be loaded from Payload CMS in actual implementation
            // For now, we create the config without PAT - it will be enriched later
          }))

        // Insert new reviewers after the current reviewer
        // This ensures they review before advancing to any subsequent reviewers
        const insertIndex = context.currentReviewerIndex + 1
        return [
          ...context.reviewers.slice(0, insertIndex),
          ...newReviewers,
          ...context.reviewers.slice(insertIndex),
        ]
      },
    }),
    advanceReviewer: assign({
      currentReviewerIndex: ({ context }) => context.currentReviewerIndex + 1,
    }),
    resetToCurrentReviewer: assign({
      currentSessionId: () => null,
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    resetRetry: assign({
      retryCount: () => 0,
    }),
    recordError: assign({
      lastError: ({ event }) => (event.type === 'SESSION_FAILED' ? event.error : null),
    }),
    recordSessionId: assign({
      currentSessionId: ({ event }) => (event.type === 'SESSION_STARTED' ? event.sessionId : null),
    }),
    scheduleRetry: ({ context }) => {
      // Calculate exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, context.retryCount) * 1000
      // This is a marker action - actual alarm scheduling happens in PRDO via scheduleAlarm()
      // The PRDO class will intercept this action and schedule the alarm
      ;(globalThis as any).__scheduleAlarmDelay = delay
    },
  },
}).createMachine({
  id: 'prReview',
  initial: 'pending',
  context: {
    prNumber: 0,
    repoFullName: '',
    installationId: 0,
    authorAgent: '',
    authorPAT: '',
    reviewers: [],
    currentReviewerIndex: 0,
    currentSessionId: null,
    reviewOutcomes: [],
    retryCount: 0,
    lastError: null,
    mergeType: null,
  },

  // Global transitions - any state can transition to merged/closed
  // Note: XState 5 requires '.' prefix for sibling state targets in root-level transitions
  on: {
    CLOSE: [
      {
        guard: 'wasMerged',
        target: '.merged',
        actions: [
          assign({
            mergeType: () => 'forced' as const,
          }),
        ],
      },
      { target: '.closed' },
    ],
  },

  states: {
    pending: {
      // Placeholder: will load config from Payload CMS
      on: {
        CONFIG_LOADED: {
          target: 'reviewing',
          actions: ['dispatchReviewSession'],
        },
      },
    },

    reviewing: {
      // Placeholder: waiting for review from current reviewer
      on: {
        SESSION_STARTED: { actions: ['recordSessionId'] },
        SESSION_FAILED: [
          {
            guard: 'canRetry',
            target: 'reviewing',
            actions: ['incrementRetry', 'scheduleRetry'],
          },
          {
            target: 'error',
            actions: ['recordError'],
          },
        ],
        RETRY: {
          // Re-dispatch review session after alarm fires
          actions: ['dispatchReviewSession'],
        },
        REVIEW_COMPLETE: [
          {
            guard: 'isApproved',
            target: 'checkingApproval',
            actions: ['recordOutcome', 'advanceReviewer'],
          },
          {
            guard: 'isChangesRequested',
            target: 'fixing',
            actions: ['recordOutcome', 'addEscalations'],
          },
        ],
      },
    },

    checkingApproval: {
      // Immediate transition based on reviewer queue
      always: [
        {
          guard: 'hasMoreReviewers',
          target: 'reviewing',
          actions: ['dispatchReviewSession'],
        },
        {
          guard: 'allApproved',
          target: 'approved',
        },
      ],
    },

    fixing: {
      // Placeholder: author agent fixing issues
      entry: ['dispatchFixSession'],
      on: {
        SESSION_STARTED: { actions: ['recordSessionId'] },
        SESSION_FAILED: [
          {
            guard: 'canRetry',
            target: 'fixing',
            actions: ['incrementRetry', 'scheduleRetry'],
          },
          {
            target: 'error',
            actions: ['recordError'],
          },
        ],
        RETRY: {
          // Re-dispatch fix session after alarm fires
          actions: ['dispatchFixSession'],
        },
        FIX_COMPLETE: {
          target: 'reviewing',
          actions: ['resetRetry', 'resetToCurrentReviewer'],
        },
      },
    },

    approved: {
      // Placeholder: will attempt auto-merge if configured
      on: {
        MERGE: { target: '#prReview.merged' },
      },
    },

    merged: {
      type: 'final',
    },

    closed: {
      type: 'final',
    },

    error: {
      type: 'final',
    },
  },
})

// =============================================================================
// PRDO Class
// =============================================================================

export class PRDO extends DurableObject<Env> {
  private sql: SqlStorage
  private initialized = false
  private prActor: ReturnType<typeof createActor<typeof prMachine>> | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
  }

  /**
   * Initialize SQL storage for PRDO-specific data (future: review outcomes, session logs)
   */
  private ensureInitialized() {
    if (this.initialized) return

    this.sql.exec(`
      -- PR review sessions log
      CREATE TABLE IF NOT EXISTS review_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        task_type TEXT NOT NULL, -- 'review' | 'fix'
        started_at TEXT NOT NULL,
        completed_at TEXT,
        outcome TEXT,
        error TEXT
      );

      -- Review outcomes
      CREATE TABLE IF NOT EXISTS review_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reviewer TEXT NOT NULL,
        decision TEXT NOT NULL, -- 'approved' | 'changes_requested'
        comment TEXT NOT NULL,
        escalations TEXT, -- JSON array
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON review_sessions(session_id);
    `)

    this.initialized = true
  }

  /**
   * Initialize the XState PR review actor
   */
  private async initPRReviewActor() {
    if (this.prActor) return

    // Restore persisted state if available
    const persistedState = await this.ctx.storage.get<any>('prState')

    this.prActor = createActor(prMachine, {
      snapshot: persistedState || undefined,
    })

    // Persist state on every change and intercept scheduleRetry and sandbox actions
    this.prActor.subscribe((state) => {
      this.ctx.storage.put('prState', state.toJSON())

      // Check if we need to schedule a retry alarm
      // The scheduleRetry action sets a global flag with the delay
      const delay = (globalThis as any).__scheduleAlarmDelay
      if (delay !== undefined) {
        this.ctx.storage.setAlarm(Date.now() + delay)
        ;(globalThis as any).__scheduleAlarmDelay = undefined
      }

      // Check if we need to dispatch a sandbox session
      // The dispatchReviewSession/dispatchFixSession actions set this flag
      const sandboxSession = (globalThis as any).__sandboxSession
      if (sandboxSession !== undefined) {
        if (this.env.SANDBOX) {
          this.env.SANDBOX.run(sandboxSession).catch((error) => {
            console.error('[PRDO] Failed to dispatch sandbox session:', error)
          })
        } else {
          console.error('[PRDO] SANDBOX binding not available')
        }
        ;(globalThis as any).__sandboxSession = undefined
      }
    })

    this.prActor.start()
  }

  /**
   * HTTP API for receiving events, status queries, and sandbox callbacks
   */
  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized()
    await this.initPRReviewActor()

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // POST /event - Receive state machine events (from GitHub webhooks)
      if (path === '/event' && request.method === 'POST') {
        const event = (await request.json()) as PREvent
        return this.handleEvent(event)
      }

      // GET /status - Return current state and context
      if (path === '/status' && request.method === 'GET') {
        return this.getStatus()
      }

      // POST /session - Receive sandbox callbacks (session started/failed/complete)
      if (path === '/session' && request.method === 'POST') {
        const callback = (await request.json()) as {
          sessionId: string
          status: 'started' | 'failed' | 'complete'
          error?: string
          result?: any
        }
        return this.handleSessionCallback(callback)
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('[PRDO] Error:', error)
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  /**
   * Handle state machine events
   */
  private async handleEvent(event: PREvent): Promise<Response> {
    if (!this.prActor) {
      return new Response('PR actor not initialized', { status: 500 })
    }

    // Check if we're in a terminal state - ignore all events
    const currentState = this.prActor.getSnapshot()
    const terminalStates = ['merged', 'closed', 'error']
    if (terminalStates.includes(currentState.value as string)) {
      return Response.json({
        ok: false,
        ignored: true,
        reason: 'PR is in terminal state',
        state: currentState.value,
        context: currentState.context,
      })
    }

    // Send event to state machine
    this.prActor.send(event)

    // Get updated state
    const state = this.prActor.getSnapshot()

    return Response.json({
      ok: true,
      state: state.value,
      context: state.context,
    })
  }

  /**
   * Get current PR review status
   */
  private getStatus(): Response {
    if (!this.prActor) {
      return new Response('PR actor not initialized', { status: 500 })
    }

    const state = this.prActor.getSnapshot()

    return Response.json({
      state: state.value,
      context: state.context,
      canTransition: state.can,
    })
  }

  /**
   * Handle sandbox session callbacks
   */
  private async handleSessionCallback(callback: {
    sessionId: string
    status: 'started' | 'failed' | 'complete'
    error?: string
    result?: any
  }): Promise<Response> {
    if (!this.prActor) {
      return new Response('PR actor not initialized', { status: 500 })
    }

    // Log session event
    const now = new Date().toISOString()

    switch (callback.status) {
      case 'started':
        this.prActor.send({ type: 'SESSION_STARTED', sessionId: callback.sessionId })
        this.sql.exec(
          `INSERT INTO review_sessions (session_id, reviewer, task_type, started_at)
           VALUES (?, ?, ?, ?)`,
          callback.sessionId,
          'unknown', // Will be enriched by actual implementation
          'unknown',
          now
        )
        break

      case 'failed':
        this.prActor.send({ type: 'SESSION_FAILED', error: callback.error || 'Unknown error' })
        this.sql.exec(
          `UPDATE review_sessions SET error = ?, completed_at = ? WHERE session_id = ?`,
          callback.error || 'Unknown error',
          now,
          callback.sessionId
        )
        break

      case 'complete':
        // Placeholder: will parse result and send appropriate event
        // (REVIEW_COMPLETE, FIX_COMPLETE, etc.)
        this.sql.exec(
          `UPDATE review_sessions SET outcome = ?, completed_at = ? WHERE session_id = ?`,
          'complete',
          now,
          callback.sessionId
        )
        break
    }

    const state = this.prActor.getSnapshot()

    return Response.json({
      ok: true,
      state: state.value,
      context: state.context,
    })
  }

  /**
   * Durable Object alarm handler for retry logic
   *
   * Called when a scheduled alarm fires. Checks current state and sends
   * RETRY event to re-dispatch the failed session.
   */
  async alarm() {
    this.ensureInitialized()
    await this.initPRReviewActor()

    if (!this.prActor) {
      console.error('[PRDO] alarm() called but actor not initialized')
      return
    }

    const state = this.prActor.getSnapshot()
    const currentState = state.value as string

    // Only retry if we're in reviewing or fixing state
    if (currentState === 'reviewing' || currentState === 'fixing') {
      console.log(`[PRDO] alarm() firing RETRY event in state: ${currentState}`)
      this.prActor.send({ type: 'RETRY' })
    } else {
      console.log(`[PRDO] alarm() ignored - not in retryable state: ${currentState}`)
    }
  }
}
