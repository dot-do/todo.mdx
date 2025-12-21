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
import type { Agent, AgentEvent, DoResult } from '../agents/base'
import { serializeYaml } from '../../../packages/shared/src/yaml'

// =============================================================================
// IssueDO Class
// =============================================================================

export class IssueDO extends StatefulDO {
  protected readonly doType = 'issue' as const
  protected ref: string = ''

  private sql: SqlStorage
  private initialized = false
  private issueActor: ReturnType<typeof createActor<typeof issueMachine>> | null = null
  private agentSession?: Agent
  private webSockets: Set<WebSocket> = new Set()

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

      -- Agent events log (streaming events during execution)
      CREATE TABLE IF NOT EXISTS agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL, -- 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'done'
        event_data TEXT NOT NULL, -- JSON event payload
        timestamp TEXT NOT NULL
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
      CREATE INDEX IF NOT EXISTS idx_agent_events_session ON agent_events(session_id);
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
   * Handle task execution dispatch via agent
   */
  private async handleExecuteTask(params: {
    issueId: string
    agent: string
    pat: string
    repo: string
    installationId: number
    prompt: string
  }): Promise<void> {
    if (!this.agentSession) {
      throw new Error('Agent session not initialized - call assignAgent() first')
    }

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

    console.log('[IssueDO] Starting agent execution for session:', sessionId)

    try {
      // Format task as YAML with repo context
      const context = this.issueActor?.getSnapshot().context
      const taskYaml = serializeYaml({
        issueId: params.issueId,
        repo: params.repo,
        title: context?.title || '',
        description: context?.description || '',
        acceptanceCriteria: context?.acceptanceCriteria || '',
        design: context?.design || '',
      })

      const taskPrompt = `${taskYaml}\n\n${params.prompt}`

      // Execute task via agent with streaming
      const result = await this.agentSession.do(taskPrompt, {
        stream: true,
        onEvent: (event: AgentEvent) => {
          // Log event to SQL storage
          this.logAgentEvent(sessionId, event)

          // Broadcast to WebSocket clients
          this.broadcastEvent({
            type: 'agent_event',
            sessionId,
            event,
          })
        },
        timeout: 600000, // 10 minutes
        maxSteps: 50,
      })

      // Extract artifacts from result
      const prNumber = this.extractPRNumber(result)
      const commits = this.extractCommits(result)
      const testResults = this.extractTestResults(result)

      // Update session with results
      this.sql.exec(
        `UPDATE execution_sessions
         SET completed_at = ?, status = ?, pr_number = ?, commits = ?, test_results = ?
         WHERE session_id = ?`,
        new Date().toISOString(),
        result.success ? 'completed' : 'failed',
        prNumber || null,
        JSON.stringify(commits),
        JSON.stringify(testResults),
        sessionId
      )

      if (result.success) {
        // Send COMPLETED event
        this.issueActor?.send({
          type: 'COMPLETED',
          prNumber: prNumber || 0,
          commits,
          testResults,
        })
      } else {
        // Send FAILED event
        this.issueActor?.send({
          type: 'FAILED',
          error: result.output,
        })
      }
    } catch (error) {
      console.error('[IssueDO] Agent execution failed:', error)

      // Update session with error
      this.sql.exec(
        `UPDATE execution_sessions SET completed_at = ?, status = ?, error = ?
         WHERE session_id = ?`,
        new Date().toISOString(),
        'failed',
        String(error),
        sessionId
      )

      // Send FAILED event
      this.issueActor?.send({
        type: 'FAILED',
        error: String(error),
      })
    }
  }

  /**
   * Log agent event to SQL storage
   */
  private logAgentEvent(sessionId: string, event: AgentEvent): void {
    this.sql.exec(
      `INSERT INTO agent_events (session_id, event_type, event_data, timestamp)
       VALUES (?, ?, ?, ?)`,
      sessionId,
      event.type,
      JSON.stringify(event),
      new Date().toISOString()
    )
  }

  /**
   * Broadcast event to all connected WebSocket clients
   */
  private broadcastEvent(event: any): void {
    const message = JSON.stringify(event)
    for (const ws of this.webSockets) {
      try {
        ws.send(message)
      } catch (error) {
        console.error('[IssueDO] Failed to send WebSocket message:', error)
        this.webSockets.delete(ws)
      }
    }
  }

  /**
   * Extract PR number from DoResult artifacts
   */
  private extractPRNumber(result: DoResult): number | null {
    if (!result.artifacts) return null
    const prArtifact = result.artifacts.find((a) => a.type === 'pr')
    if (!prArtifact) return null
    // Parse PR number from ref (e.g., "owner/repo#123" → 123)
    const match = prArtifact.ref.match(/#(\d+)$/)
    return match ? parseInt(match[1], 10) : null
  }

  /**
   * Extract commits from DoResult artifacts
   */
  private extractCommits(result: DoResult): any[] {
    if (!result.artifacts) return []
    return result.artifacts
      .filter((a) => a.type === 'commit')
      .map((a) => ({
        sha: a.ref,
        message: a.url || '',
      }))
  }

  /**
   * Extract test results from DoResult events
   */
  private extractTestResults(result: DoResult): any {
    // Look for test results in events or output
    // This is a simplified implementation - in practice you'd parse agent output
    return { passed: 0, failed: 0, skipped: 0 }
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
      // WebSocket upgrade for real-time event streaming
      if (path === '/ws' && request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocket(request)
      }

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

      // GET /events/:sessionId - Get agent events for a session
      if (path.startsWith('/events/') && request.method === 'GET') {
        const sessionId = path.split('/')[2]
        return this.getAgentEvents(sessionId)
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
   * Handle WebSocket connection for real-time event streaming
   */
  private handleWebSocket(request: Request): Response {
    const { 0: client, 1: server } = new WebSocketPair()

    // Accept the WebSocket connection
    server.accept()

    // Add to active connections
    this.webSockets.add(server)

    // Send current state on connection
    const state = this.issueActor?.getSnapshot()
    if (state) {
      server.send(
        JSON.stringify({
          type: 'state',
          state: state.value,
          context: state.context,
        })
      )
    }

    // Handle client disconnect
    server.addEventListener('close', () => {
      this.webSockets.delete(server)
    })

    server.addEventListener('error', () => {
      this.webSockets.delete(server)
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  /**
   * Get agent events for a specific session
   */
  private getAgentEvents(sessionId: string): Response {
    const events = this.sql
      .exec('SELECT * FROM agent_events WHERE session_id = ? ORDER BY timestamp ASC', sessionId)
      .toArray()

    return Response.json({ events })
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
      orgId?: string
      repoId?: string
    }

    // Initialize context if this is first time
    const currentState = this.issueActor.getSnapshot()
    if (currentState.value === 'idle') {
      try {
        // Get agent via RPC with context-based resolution
        const agentContext = {
          orgId: body.orgId,
          repoId: body.repoId,
        }

        console.log('[IssueDO] Resolving agent:', body.agent, 'with context:', agentContext)
        this.agentSession = await this.env.AGENT.get(body.agent, agentContext)

        console.log('[IssueDO] Agent resolved:', this.agentSession.def.name)

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
          agent: this.agentSession
            ? {
                id: this.agentSession.def.id,
                name: this.agentSession.def.name,
                tier: this.agentSession.def.tier,
                framework: this.agentSession.def.framework,
              }
            : undefined,
        })
      } catch (error) {
        console.error('[IssueDO] Failed to assign agent:', error)
        return Response.json(
          {
            ok: false,
            error: `Failed to assign agent: ${error}`,
          },
          { status: 500 }
        )
      }
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
