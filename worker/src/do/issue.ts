/**
 * IssueDO: Issue Durable Object
 *
 * Manages task execution lifecycle using XState machine.
 * Coordinates agent assignment, tool preparation, execution, and verification.
 *
 * State machine: idle → preparing → executing → verifying → done
 * Also handles: blocked (missing tools), failed (execution errors)
 */

import { DurableObject } from 'cloudflare:workers'
import { createActor } from 'xstate'
import { StatefulDO } from './base'
import { issueMachine, type IssueContext, type IssueEvent } from './machines/issue'
import type { Env } from '../types/env'

// =============================================================================
// IssueDO Class
// =============================================================================

export class IssueDO extends StatefulDO {
  protected readonly doType = 'issue' as const
  protected ref: string = ''

  private sql: SqlStorage
  private initialized = false
  private issueActor: ReturnType<typeof createActor<typeof issueMachine>> | null = null

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.sql = state.storage.sql
    // Extract issue ID from DO name/id for ref
    this.ref = state.id.toString()
  }

  /**
   * Initialize SQL storage for execution logs and audit trail
   */
  private ensureInitialized() {
    if (this.initialized) return

    this.sql.exec(`
      -- Execution sessions log
      CREATE TABLE IF NOT EXISTS execution_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL, -- 'running' | 'completed' | 'failed' | 'timeout'
        error TEXT,
        pr_number INTEGER,
        commits TEXT, -- JSON array
        test_results TEXT -- JSON object
      );

      -- Tool availability checks
      CREATE TABLE IF NOT EXISTS tool_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT NOT NULL,
        required_tools TEXT NOT NULL, -- JSON array
        available_tools TEXT NOT NULL, -- JSON array
        missing_tools TEXT NOT NULL, -- JSON array
        checked_at TEXT NOT NULL
      );

      -- Verification attempts
      CREATE TABLE IF NOT EXISTS verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number INTEGER NOT NULL,
        status TEXT NOT NULL, -- 'passed' | 'rejected'
        reason TEXT,
        verified_at TEXT NOT NULL
      );

      -- State transitions audit log
      CREATE TABLE IF NOT EXISTS state_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        event_type TEXT NOT NULL,
        context TEXT, -- JSON snapshot
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON execution_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_verifications_pr ON verifications(pr_number);
    `)

    this.initialized = true
  }

  /**
   * Initialize the XState issue execution actor
   */
  private async initIssueActor() {
    if (this.issueActor) return

    // Restore persisted state if available
    const persistedState = await this.loadState()

    this.issueActor = createActor(issueMachine, {
      snapshot: persistedState || undefined,
    })

    // Subscribe to state changes
    this.issueActor.subscribe((state) => {
      // Persist state using StatefulDO base class
      this.onTransition(state.toJSON())

      // Log state transition
      const prevValue = this.machineState?.value
      const newValue = state.value
      if (prevValue !== newValue) {
        this.logStateTransition(
          prevValue || 'none',
          newValue as string,
          'transition',
          state.context
        )
      }

      // Handle global flags set by actions

      // Check if we need to schedule a retry alarm
      const delay = (globalThis as any).__scheduleAlarmDelay
      if (delay !== undefined) {
        this.state.storage.setAlarm(Date.now() + delay)
        ;(globalThis as any).__scheduleAlarmDelay = undefined
      }

      // Check if we need to check tools
      const checkTools = (globalThis as any).__checkTools
      if (checkTools !== undefined) {
        this.handleCheckTools(checkTools).catch((error) => {
          console.error('[IssueDO] Failed to check tools:', error)
          this.issueActor?.send({ type: 'TOOLS_MISSING', missing: [] })
        })
        ;(globalThis as any).__checkTools = undefined
      }

      // Check if we need to execute task
      const executeTask = (globalThis as any).__executeTask
      if (executeTask !== undefined) {
        this.handleExecuteTask(executeTask).catch((error) => {
          console.error('[IssueDO] Failed to execute task:', error)
          this.issueActor?.send({ type: 'FAILED', error: String(error) })
        })
        ;(globalThis as any).__executeTask = undefined
      }

      // Check if we need to verify results
      const verifyResults = (globalThis as any).__verifyResults
      if (verifyResults !== undefined) {
        this.handleVerifyResults(verifyResults).catch((error) => {
          console.error('[IssueDO] Failed to verify results:', error)
          this.issueActor?.send({ type: 'REJECTED', reason: String(error) })
        })
        ;(globalThis as any).__verifyResults = undefined
      }
    })

    this.issueActor.start()
  }

  /**
   * Handle tool availability check
   */
  private async handleCheckTools(params: {
    issueId: string
    agent: string
    requiredTools: string[]
  }): Promise<void> {
    // TODO: Implement actual tool checking via agent sandbox
    // For now, simulate tool check
    const availableTools = params.requiredTools // Assume all tools available for now
    const missingTools: string[] = []

    const now = new Date().toISOString()
    this.sql.exec(
      `INSERT INTO tool_checks (agent, required_tools, available_tools, missing_tools, checked_at)
       VALUES (?, ?, ?, ?, ?)`,
      params.agent,
      JSON.stringify(params.requiredTools),
      JSON.stringify(availableTools),
      JSON.stringify(missingTools),
      now
    )

    if (missingTools.length > 0) {
      this.issueActor?.send({ type: 'TOOLS_MISSING', missing: missingTools })
    } else {
      this.issueActor?.send({ type: 'TOOLS_READY', tools: availableTools })
    }
  }

  /**
   * Handle task execution dispatch
   */
  private async handleExecuteTask(params: {
    issueId: string
    agent: string
    pat: string
    repo: string
    installationId: number
    prompt: string
  }): Promise<void> {
    // Generate session ID
    const sessionId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Log session start
    this.sql.exec(
      `INSERT INTO execution_sessions (session_id, agent, started_at, status)
       VALUES (?, ?, ?, ?)`,
      sessionId,
      params.agent,
      now,
      'running'
    )

    // Send START_EXECUTION event
    this.issueActor?.send({ type: 'START_EXECUTION', sessionId })

    // TODO: Dispatch actual execution via sandbox/container
    // For now, simulate execution completion after 5 seconds
    // In production, this would call env.CLAUDE_SANDBOX or similar
    console.log('[IssueDO] Simulating task execution for session:', sessionId)

    // Simulate async execution (in real implementation, this would be handled by sandbox callbacks)
    setTimeout(() => {
      // Simulate successful completion
      const prNumber = Math.floor(Math.random() * 1000) + 1
      const commits = [{ sha: 'abc123', message: 'Implement feature' }]
      const testResults = { passed: 10, failed: 0, skipped: 0 }

      // Update session
      this.sql.exec(
        `UPDATE execution_sessions SET completed_at = ?, status = ?, pr_number = ?, commits = ?, test_results = ?
         WHERE session_id = ?`,
        new Date().toISOString(),
        'completed',
        prNumber,
        JSON.stringify(commits),
        JSON.stringify(testResults),
        sessionId
      )

      // Send COMPLETED event
      this.issueActor?.send({
        type: 'COMPLETED',
        prNumber,
        commits,
        testResults,
      })
    }, 5000)
  }

  /**
   * Handle result verification
   */
  private async handleVerifyResults(params: {
    issueId: string
    prNumber: number | null
    testResults: any | null
    commits: any[]
  }): Promise<void> {
    const now = new Date().toISOString()

    // Verify PR exists
    if (!params.prNumber) {
      this.sql.exec(
        `INSERT INTO verifications (pr_number, status, reason, verified_at)
         VALUES (?, ?, ?, ?)`,
        0,
        'rejected',
        'No PR created',
        now
      )
      this.issueActor?.send({ type: 'REJECTED', reason: 'No PR created' })
      return
    }

    // Verify tests passed
    if (!params.testResults || params.testResults.failed > 0) {
      this.sql.exec(
        `INSERT INTO verifications (pr_number, status, reason, verified_at)
         VALUES (?, ?, ?, ?)`,
        params.prNumber,
        'rejected',
        'Tests failed',
        now
      )
      this.issueActor?.send({ type: 'REJECTED', reason: 'Tests failed' })
      return
    }

    // Verify commits exist
    if (!params.commits || params.commits.length === 0) {
      this.sql.exec(
        `INSERT INTO verifications (pr_number, status, reason, verified_at)
         VALUES (?, ?, ?, ?)`,
        params.prNumber,
        'rejected',
        'No commits found',
        now
      )
      this.issueActor?.send({ type: 'REJECTED', reason: 'No commits found' })
      return
    }

    // All verifications passed
    this.sql.exec(
      `INSERT INTO verifications (pr_number, status, verified_at)
       VALUES (?, ?, ?)`,
      params.prNumber,
      'passed',
      now
    )
    this.issueActor?.send({ type: 'VERIFIED' })
  }

  /**
   * Log state transition for audit trail
   */
  private logStateTransition(
    fromState: string,
    toState: string,
    eventType: string,
    context: IssueContext
  ): void {
    this.sql.exec(
      `INSERT INTO state_transitions (from_state, to_state, event_type, context, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      fromState,
      toState,
      eventType,
      JSON.stringify(context),
      new Date().toISOString()
    )
  }

  /**
   * Durable Object alarm handler for retry logic
   */
  async alarm() {
    this.ensureInitialized()
    await this.initIssueActor()

    if (!this.issueActor) {
      console.error('[IssueDO] alarm() called but actor not initialized')
      return
    }

    const state = this.issueActor.getSnapshot()
    const currentState = state.value as string

    // Only retry if we're in executing state
    if (currentState === 'executing') {
      console.log(`[IssueDO] alarm() firing RETRY event in state: ${currentState}`)
      this.issueActor.send({ type: 'RETRY' })
    } else {
      console.log(`[IssueDO] alarm() ignored - not in retryable state: ${currentState}`)
    }
  }

  /**
   * HTTP API for managing issue execution
   */
  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized()
    await this.initIssueActor()

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // POST /assign-agent - Trigger agent assignment
      if (path === '/assign-agent' && request.method === 'POST') {
        return this.assignAgent(request)
      }

      // GET /state - Return current XState snapshot
      if (path === '/state' && request.method === 'GET') {
        return this.getState()
      }

      // POST /cancel - Abort execution
      if (path === '/cancel' && request.method === 'POST') {
        return this.cancel()
      }

      // GET /logs - Get execution logs
      if (path === '/logs' && request.method === 'GET') {
        return this.getLogs()
      }

      // GET /transitions - Get state transition audit log
      if (path === '/transitions' && request.method === 'GET') {
        return this.getTransitions()
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('[IssueDO] Error:', error)
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  /**
   * Assign agent to issue and start execution
   */
  private async assignAgent(request: Request): Promise<Response> {
    if (!this.issueActor) {
      return new Response('Issue actor not initialized', { status: 500 })
    }

    const body = (await request.json()) as {
      agent: string
      pat: string
      issueId: string
      repoFullName: string
      installationId: number
      title: string
      description: string
      acceptanceCriteria?: string
      design?: string
      requiredTools?: string[]
    }

    // Initialize context if this is first time
    const currentState = this.issueActor.getSnapshot()
    if (currentState.value === 'idle') {
      // Update context with issue details
      this.issueActor.send({
        type: 'ASSIGN_AGENT',
        agent: body.agent,
        pat: body.pat,
      })

      // Set the ref for persistence
      this.ref = body.issueId

      return Response.json({
        ok: true,
        message: 'Agent assigned, preparing execution',
        state: this.issueActor.getSnapshot().value,
      })
    }

    return Response.json({
      ok: false,
      error: 'Issue already has agent assigned',
      state: currentState.value,
    })
  }

  /**
   * Get current state and context
   */
  private getState(): Response {
    if (!this.issueActor) {
      return new Response('Issue actor not initialized', { status: 500 })
    }

    const state = this.issueActor.getSnapshot()

    return Response.json({
      state: state.value,
      context: state.context,
      canTransition: {
        ASSIGN_AGENT: state.can({ type: 'ASSIGN_AGENT', agent: '', pat: '' }),
        CANCEL: state.can({ type: 'CANCEL' }),
      },
    })
  }

  /**
   * Cancel execution
   */
  private cancel(): Response {
    if (!this.issueActor) {
      return new Response('Issue actor not initialized', { status: 500 })
    }

    this.issueActor.send({ type: 'CANCEL' })

    return Response.json({
      ok: true,
      message: 'Execution cancelled',
      state: this.issueActor.getSnapshot().value,
    })
  }

  /**
   * Get execution logs
   */
  private getLogs(): Response {
    const sessions = this.sql
      .exec('SELECT * FROM execution_sessions ORDER BY started_at DESC')
      .toArray()

    const toolChecks = this.sql
      .exec('SELECT * FROM tool_checks ORDER BY checked_at DESC')
      .toArray()

    const verifications = this.sql
      .exec('SELECT * FROM verifications ORDER BY verified_at DESC')
      .toArray()

    return Response.json({
      sessions,
      toolChecks,
      verifications,
    })
  }

  /**
   * Get state transition audit log
   */
  private getTransitions(): Response {
    const transitions = this.sql
      .exec('SELECT * FROM state_transitions ORDER BY created_at DESC LIMIT 50')
      .toArray()

    return Response.json({ transitions })
  }
}
