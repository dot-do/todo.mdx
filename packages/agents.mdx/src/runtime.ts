/**
 * Proxy Runtime - Creates WorkflowRuntime from a Transport
 *
 * The runtime turns property chains into RPC calls via the transport.
 * Supports both template literal and structured call styles for Claude methods.
 */

import type {
  WorkflowRuntime,
  RuntimeConfig,
  Transport,
  TransportFactory,
  Claude,
  ClaudeMethod,
  PRNamespace,
  IssuesNamespace,
  EpicsNamespace,
  GitNamespace,
  TodoNamespace,
  DAGNamespace,
  DoOpts,
  DoResult,
  ResearchOpts,
  ResearchResult,
  ReviewOpts,
  ReviewResult,
  AskOpts,
} from './types'

// ============================================================================
// Template Literal Helpers
// ============================================================================

/**
 * Combine template literal parts into a single string
 */
function templateToString(strings: TemplateStringsArray, values: unknown[]): string {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    // Convert objects to JSON, keep strings as-is
    const stringValue = typeof value === 'object' && value !== null
      ? JSON.stringify(value, null, 2)
      : String(value)
    result += stringValue + strings[i + 1]
  }
  return result
}

/**
 * Check if arguments are a template literal call
 */
function isTemplateLiteral(args: unknown[]): args is [TemplateStringsArray, ...unknown[]] {
  return (
    args.length >= 1 &&
    Array.isArray(args[0]) &&
    'raw' in args[0] &&
    Array.isArray((args[0] as TemplateStringsArray).raw)
  )
}

// ============================================================================
// Proxy Factory
// ============================================================================

/**
 * Create a method proxy that supports both template literal and structured calls
 */
function createClaudeMethod<TOpts, TResult>(
  transport: Transport,
  methodPath: string,
  optsKey: string // The key to use when converting template to opts (e.g., 'task', 'topic', 'question')
): ClaudeMethod<TOpts, TResult> {
  const handler = async (...args: unknown[]): Promise<TResult> => {
    let opts: TOpts

    if (isTemplateLiteral(args)) {
      const [strings, ...values] = args
      const text = templateToString(strings, values)
      opts = { [optsKey]: text } as TOpts
    } else {
      opts = args[0] as TOpts
    }

    return transport.call(methodPath, [opts]) as Promise<TResult>
  }

  // Make it callable as both function and template tag
  return handler as ClaudeMethod<TOpts, TResult>
}

/**
 * Create the Claude namespace with template literal support
 */
function createClaudeProxy(transport: Transport): Claude {
  const doMethod = createClaudeMethod<DoOpts, DoResult>(transport, 'claude.do', 'task')
  const researchMethod = createClaudeMethod<ResearchOpts, ResearchResult>(transport, 'claude.research', 'topic')
  const reviewMethod = createClaudeMethod<ReviewOpts, ReviewResult>(transport, 'claude.review', 'pr')
  const askMethod = createClaudeMethod<AskOpts, string>(transport, 'claude.ask', 'question')

  // Root callable that defaults to .do behavior
  const claude = ((stringsOrOpts: TemplateStringsArray | DoOpts, ...values: unknown[]) => {
    if (isTemplateLiteral([stringsOrOpts, ...values])) {
      return doMethod(stringsOrOpts as TemplateStringsArray, ...values)
    }
    return doMethod(stringsOrOpts as DoOpts)
  }) as Claude

  // Attach methods
  claude.do = doMethod
  claude.research = researchMethod
  claude.review = reviewMethod
  claude.ask = askMethod

  return claude
}

/**
 * Create a namespace proxy that routes method calls to transport
 */
function createNamespaceProxy<T extends object>(transport: Transport, namespace: string): T {
  return new Proxy({} as T, {
    get(_, prop: string) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return undefined // Not a promise
      }

      const path = `${namespace}.${prop}`

      // Check if this should be a nested namespace (e.g., git.worktree)
      // Return a proxy that can be either called or accessed further
      return new Proxy(
        (...args: unknown[]) => transport.call(path, args),
        {
          get(_, nestedProp: string) {
            if (nestedProp === 'then' || nestedProp === 'catch' || nestedProp === 'finally') {
              return undefined
            }
            const nestedPath = `${path}.${nestedProp}`
            return (...args: unknown[]) => transport.call(nestedPath, args)
          }
        }
      )
    }
  })
}

// ============================================================================
// Runtime Factory
// ============================================================================

/**
 * Create a WorkflowRuntime from a RuntimeConfig
 *
 * @example
 * const runtime = createRuntime({
 *   repo: { owner: 'dot-do', name: 'todo.mdx', defaultBranch: 'main', url: '...' },
 *   transport: localTransport()
 * })
 *
 * // Use in workflow
 * const result = await runtime.claude.do`implement ${feature}`
 */
export function createRuntime(config: RuntimeConfig): WorkflowRuntime {
  let transport: Transport
  let transportPromise: Promise<Transport> | null = null

  // Lazy transport initialization
  const getTransport = async (): Promise<Transport> => {
    if (transport) return transport
    if (transportPromise) return transportPromise

    if (typeof config.transport === 'function') {
      transportPromise = Promise.resolve(config.transport())
      transport = await transportPromise
      transportPromise = null
    } else {
      transport = config.transport
    }

    return transport
  }

  // For sync access, we need the transport to be initialized
  // In practice, the first await will initialize it
  const syncTransport: Transport = {
    call: async (method: string, args: unknown[]) => {
      const t = await getTransport()
      return t.call(method, args)
    }
  }

  return {
    // Context (static, from config)
    repo: config.repo,
    issue: config.issue,

    // Claude - with template literal support
    claude: createClaudeProxy(syncTransport),

    // Standard namespace proxies
    pr: createNamespaceProxy<PRNamespace>(syncTransport, 'pr'),
    issues: createNamespaceProxy<IssuesNamespace>(syncTransport, 'issues'),
    epics: createNamespaceProxy<EpicsNamespace>(syncTransport, 'epics'),
    git: createNamespaceProxy<GitNamespace>(syncTransport, 'git'),
    todo: createNamespaceProxy<TodoNamespace>(syncTransport, 'todo'),
    dag: createNamespaceProxy<DAGNamespace>(syncTransport, 'dag'),
  }
}

// ============================================================================
// Global Installation
// ============================================================================

/**
 * Install runtime namespaces on globalThis for workflow code
 *
 * @example
 * installGlobals(runtime)
 *
 * // Now available globally in workflow:
 * await claude.do`implement ${feature}`
 * await pr.create({ branch, title, body })
 */
export function installGlobals(runtime: WorkflowRuntime): void {
  const g = globalThis as unknown as Record<string, unknown>

  g.repo = runtime.repo
  g.issue = runtime.issue
  g.claude = runtime.claude
  g.pr = runtime.pr
  g.issues = runtime.issues
  g.epics = runtime.epics
  g.git = runtime.git
  g.todo = runtime.todo
  g.dag = runtime.dag
}

/**
 * Create runtime and install globals in one step
 */
export function initRuntime(config: RuntimeConfig): WorkflowRuntime {
  const runtime = createRuntime(config)
  installGlobals(runtime)
  return runtime
}
