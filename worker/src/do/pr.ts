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
    dispatchReviewSession: assign({
      // Placeholder: will call env.SANDBOX.run()
    }),
    dispatchFixSession: assign({
      // Placeholder: will call env.SANDBOX.run() as author
    }),
    recordOutcome: assign({
      reviewOutcomes: ({ context, event }) => {
        if (event.type !== 'REVIEW_COMPLETE') return context.reviewOutcomes
        return [
          ...context.reviewOutcomes,
          {
            reviewer: event.reviewer,
            decision: event.decision,
            comment: event.body,
            escalations: [],
            timestamp: new Date().toISOString(),
          },
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
            actions: ['incrementRetry'],
          },
          {
            target: 'error',
            actions: ['recordError'],
          },
        ],
        REVIEW_COMPLETE: [
          {
            guard: 'isApproved',
            target: 'checkingApproval',
            actions: ['recordOutcome', 'advanceReviewer'],
          },
          {
            guard: 'isChangesRequested',
            target: 'fixing',
            actions: ['recordOutcome'],
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
            actions: ['incrementRetry'],
          },
          {
            target: 'error',
            actions: ['recordError'],
          },
        ],
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

    // Persist state on every change
    this.prActor.subscribe((state) => {
      this.ctx.storage.put('prState', state.toJSON())
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
}
