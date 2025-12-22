import {
  Agent,
  AgentDef,
  DoOptions,
  AskOptions,
  DoResult,
  AskResult,
  AgentEvent,
  Artifact,
} from '../base'
import type { Env } from '../../types/env'
import type { ExecuteResult, ExecuteOptions, StreamEvent, TestResult, TestOptions } from '../../sandbox/claude'

/**
 * Extended DoOptions for ClaudeCodeAgent with test runner support
 */
export interface ClaudeCodeDoOptions extends DoOptions {
  /** Run tests after execution completes */
  runTests?: boolean
  /** Options for test execution */
  testOptions?: TestOptions
}

/**
 * Options for sandbox execution
 */
export interface SandboxExecuteOptions {
  /** GitHub repository (owner/repo format) */
  repo?: string
  /** Additional context to provide */
  context?: string
  /** GitHub installation ID for private repos */
  installationId?: number
  /** Branch to work on */
  branch?: string
  /** Whether to push changes */
  push?: boolean
  /** Target branch for push */
  targetBranch?: string
  /** Commit message */
  commitMessage?: string
}

/**
 * Claude Code Agent implementation for sandbox-tier development
 *
 * This agent provides a full development environment for complex multi-file tasks.
 * It leverages sandboxed execution (containers/VMs) with the Claude Code CLI for:
 * - Complex refactoring across multiple files
 * - Full-stack feature implementation
 * - Deep codebase exploration and modification
 * - Creating comprehensive PRs with multiple commits
 *
 * Architecture:
 * - Spawns sandboxed environment (container/VM)
 * - Clones repository into sandbox
 * - Runs Claude Code CLI with full file system access
 * - Streams events back to caller
 * - Returns artifacts (commits, PRs, files changed)
 *
 * Integration options:
 * - Cloudflare Code Mode: https://blog.cloudflare.com/code-mode/
 * - Container services: fly.io machines, modal.com
 * - Custom sandbox infrastructure
 */
export class ClaudeCodeAgent extends Agent {
  readonly def: AgentDef
  private env?: Env
  private sandboxOptions?: SandboxExecuteOptions

  constructor(def: AgentDef, env?: Env, sandboxOptions?: SandboxExecuteOptions) {
    super()
    this.def = def
    this.env = env
    this.sandboxOptions = sandboxOptions
  }

  /**
   * Set sandbox execution options after construction
   *
   * Use this to configure the agent with repo, branch, and other options
   * when they're not known at construction time (e.g., when creating via RPC).
   *
   * @param options - Sandbox execution options
   */
  setSandboxOptions(options: SandboxExecuteOptions): void {
    this.sandboxOptions = options
  }

  /**
   * Get current sandbox options
   */
  getSandboxOptions(): SandboxExecuteOptions | undefined {
    return this.sandboxOptions
  }

  /**
   * Execute task in Claude Code sandbox
   *
   * For complex multi-file development tasks:
   * - Spawns a sandboxed environment (Cloudflare Sandbox container)
   * - Clones repository into sandbox
   * - Runs Claude Code CLI with full file system access
   * - Streams events back to caller
   * - Optionally runs tests after execution
   * - Returns artifacts (commits, PRs, files changed, test results)
   *
   * @param task - The development task (YAML-formatted context recommended)
   * @param options - Execution options (streaming, callbacks, timeouts, runTests)
   * @returns DoResult with artifacts and event history
   */
  async do(task: string, options?: ClaudeCodeDoOptions): Promise<DoResult> {
    const events: AgentEvent[] = []
    const artifacts: Artifact[] = []
    const onEvent = options?.onEvent
    const stream = options?.stream ?? true

    // Validate environment binding is available
    if (!this.env) {
      const errorEvent: AgentEvent = {
        type: 'error',
        error: 'Environment bindings not provided to ClaudeCodeAgent',
      }
      events.push(errorEvent)
      onEvent?.(errorEvent)
      return {
        success: false,
        output: 'Environment bindings not provided to ClaudeCodeAgent',
        artifacts: [],
        events,
      }
    }

    // Validate required sandbox options
    if (!this.sandboxOptions?.repo) {
      const errorEvent: AgentEvent = {
        type: 'error',
        error: 'Repository not specified in sandbox options',
      }
      events.push(errorEvent)
      onEvent?.(errorEvent)
      return {
        success: false,
        output: 'Repository not specified. Provide sandboxOptions.repo when creating the agent.',
        artifacts: [],
        events,
      }
    }

    // Emit thinking event
    const thinkingEvent: AgentEvent = {
      type: 'thinking',
      content: `Preparing sandbox environment for ${this.sandboxOptions.repo}...`,
    }
    events.push(thinkingEvent)
    onEvent?.(thinkingEvent)

    try {
      // Generate a unique session ID for this execution
      const sessionId = crypto.randomUUID()

      // Get the Sandbox Durable Object stub
      const doId = this.env.Sandbox.idFromName(sessionId)
      const sandbox = this.env.Sandbox.get(doId)

      // Build execution options for the sandbox
      const executeOpts: ExecuteOptions = {
        repo: this.sandboxOptions.repo,
        task,
        context: this.sandboxOptions.context,
        installationId: this.sandboxOptions.installationId,
        branch: this.sandboxOptions.branch ?? 'main',
        push: this.sandboxOptions.push,
        targetBranch: this.sandboxOptions.targetBranch,
        commitMessage: this.sandboxOptions.commitMessage,
      }

      let result: ExecuteResult

      if (stream && onEvent) {
        // Use streaming endpoint for real-time updates
        result = await this.executeWithStreaming(sandbox, executeOpts, events, onEvent)
      } else {
        // Use headless endpoint for simple execution
        result = await this.executeHeadless(sandbox, executeOpts, events, onEvent)
      }

      // Build artifacts from the result
      if (result.filesChanged.length > 0) {
        for (const file of result.filesChanged) {
          artifacts.push({
            type: 'file',
            ref: file,
          })
        }
      }

      if (result.pushedToBranch) {
        artifacts.push({
          type: 'branch',
          ref: result.pushedToBranch,
          url: `https://github.com/${this.sandboxOptions.repo}/tree/${result.pushedToBranch}`,
        })
      }

      if (result.commitSha) {
        artifacts.push({
          type: 'commit',
          ref: result.commitSha,
          url: `https://github.com/${this.sandboxOptions.repo}/commit/${result.commitSha}`,
        })
      }

      // Run tests if requested
      let testResult: TestResult | undefined
      if (options?.runTests) {
        const testEvent: AgentEvent = {
          type: 'thinking',
          content: 'Running tests...',
        }
        events.push(testEvent)
        onEvent?.(testEvent)

        try {
          testResult = await this.runTests(sandbox, options.testOptions)

          // Add test results artifact
          const testSummary = testResult.failed > 0
            ? `${testResult.failed} failed, ${testResult.passed} passed`
            : `${testResult.passed} passed`

          artifacts.push({
            type: 'test-results',
            ref: testSummary,
            data: testResult,
          })

          // Emit test result event
          const testResultEvent: AgentEvent = {
            type: 'message',
            content: `Tests: ${testResult.passed} passed, ${testResult.failed} failed, ${testResult.skipped} skipped (${testResult.duration}ms)`,
          }
          events.push(testResultEvent)
          onEvent?.(testResultEvent)
        } catch (testError) {
          const testErrorMessage = testError instanceof Error ? testError.message : String(testError)
          const testErrorEvent: AgentEvent = {
            type: 'error',
            error: `Test execution failed: ${testErrorMessage}`,
          }
          events.push(testErrorEvent)
          onEvent?.(testErrorEvent)

          // Add failed test artifact with error info
          artifacts.push({
            type: 'test-results',
            ref: 'error',
            data: { error: testErrorMessage },
          })
        }
      }

      // Determine overall success: execution succeeded and (no tests OR tests passed)
      const executionSuccess = result.exitCode === 0
      const testsPass = !options?.runTests || (testResult !== undefined && testResult.failed === 0)
      const success = executionSuccess && testsPass

      const doResult: DoResult = {
        success,
        output: result.summary || result.diff || 'No output from Claude Code',
        artifacts,
        events,
      }

      const doneEvent: AgentEvent = {
        type: 'done',
        result: doResult,
      }
      events.push(doneEvent)
      onEvent?.(doneEvent)

      return doResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorEvent: AgentEvent = {
        type: 'error',
        error: errorMessage,
      }
      events.push(errorEvent)
      onEvent?.(errorEvent)

      return {
        success: false,
        output: errorMessage,
        artifacts,
        events,
      }
    }
  }

  /**
   * Execute headlessly without streaming (simpler, faster for non-interactive use)
   */
  private async executeHeadless(
    sandbox: DurableObjectStub,
    opts: ExecuteOptions,
    events: AgentEvent[],
    onEvent?: (e: AgentEvent) => void
  ): Promise<ExecuteResult> {
    const messageEvent: AgentEvent = {
      type: 'message',
      content: `Executing Claude Code in sandbox for repo: ${opts.repo}`,
    }
    events.push(messageEvent)
    onEvent?.(messageEvent)

    const response = await sandbox.fetch(new Request('http://sandbox/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }))

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Sandbox execution failed: ${response.status} - ${errorBody}`)
    }

    const result = await response.json() as ExecuteResult | { error: string }

    if ('error' in result) {
      throw new Error(result.error)
    }

    return result
  }

  /**
   * Execute with SSE streaming for real-time updates
   */
  private async executeWithStreaming(
    sandbox: DurableObjectStub,
    opts: ExecuteOptions,
    events: AgentEvent[],
    onEvent: (e: AgentEvent) => void
  ): Promise<ExecuteResult> {
    const messageEvent: AgentEvent = {
      type: 'message',
      content: `Starting streaming execution for repo: ${opts.repo}`,
    }
    events.push(messageEvent)
    onEvent(messageEvent)

    const response = await sandbox.fetch(new Request('http://sandbox/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    }))

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Sandbox stream failed: ${response.status} - ${errorBody}`)
    }

    if (!response.body) {
      throw new Error('No response body from sandbox stream')
    }

    // Parse SSE stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalResult: ExecuteResult | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events from buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          // Event type line - we'll get data on next line
          continue
        }
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (!data) continue

          try {
            // Try to parse as StreamEvent
            const streamEvent = JSON.parse(data) as StreamEvent | { diff: string; filesChanged: string[] }

            if ('type' in streamEvent) {
              if (streamEvent.type === 'stdout') {
                const event: AgentEvent = {
                  type: 'message',
                  content: streamEvent.data || '',
                }
                events.push(event)
                onEvent(event)
              } else if (streamEvent.type === 'stderr') {
                const event: AgentEvent = {
                  type: 'message',
                  content: `[stderr] ${streamEvent.data || ''}`,
                }
                events.push(event)
                onEvent(event)
              } else if (streamEvent.type === 'complete') {
                // Complete event has embedded result data
                if (streamEvent.data) {
                  const completionData = JSON.parse(streamEvent.data) as { diff: string; filesChanged: string[] }
                  finalResult = {
                    diff: completionData.diff,
                    summary: '',
                    filesChanged: completionData.filesChanged,
                    exitCode: streamEvent.exitCode ?? 0,
                  }
                }
              } else if (streamEvent.type === 'error') {
                throw new Error(streamEvent.error || 'Unknown stream error')
              }
            } else if ('diff' in streamEvent) {
              // Direct completion data format
              finalResult = {
                diff: streamEvent.diff,
                summary: '',
                filesChanged: streamEvent.filesChanged,
                exitCode: 0,
              }
            }
          } catch (parseError) {
            // Non-JSON data, treat as raw output
            const event: AgentEvent = {
              type: 'message',
              content: data,
            }
            events.push(event)
            onEvent(event)
          }
        }
      }
    }

    if (!finalResult) {
      throw new Error('Stream completed without final result')
    }

    return finalResult
  }

  /**
   * Run tests in the sandbox environment
   *
   * Calls the sandbox's /test endpoint which executes vitest and returns
   * structured test results including passed/failed/skipped counts and
   * detailed failure information.
   *
   * @param sandbox - The sandbox Durable Object stub
   * @param options - Optional test configuration (filter, timeout, cwd)
   * @returns TestResult with pass/fail counts and failure details
   */
  private async runTests(
    sandbox: DurableObjectStub,
    options?: TestOptions
  ): Promise<TestResult> {
    const response = await sandbox.fetch(new Request('http://sandbox/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {}),
    }))

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Test execution failed: ${response.status} - ${errorBody}`)
    }

    const result = await response.json() as TestResult | { error: string }

    if ('error' in result) {
      throw new Error(result.error)
    }

    return result
  }

  /**
   * Answer a question (not recommended for sandbox agents)
   *
   * Claude Code sandbox is heavyweight for simple questions.
   * For ask(), we recommend using a lighter-weight agent.
   *
   * This implementation returns a suggestion to use a different agent.
   *
   * @param question - The question to answer
   * @param options - Ask options
   * @returns AskResult with suggestion
   */
  async ask(question: string, options?: AskOptions): Promise<AskResult> {
    // For ask(), the sandbox tier is overkill
    // Suggest using a lighter agent like Research Reed or Developer Dana

    const event: AgentEvent = {
      type: 'message',
      content: 'Claude Code sandbox is optimized for development tasks, not quick queries.',
    }
    options?.onEvent?.(event)

    return {
      answer:
        'Claude Code sandbox is designed for complex, multi-file development tasks. For questions and quick queries, consider using a lighter-tier agent like Research Reed (web/docs search) or Developer Dana (code questions). Sandbox execution incurs significant overhead and is not cost-effective for simple information retrieval.',
      confidence: 0.9, // High confidence in this recommendation
    }
  }
}
