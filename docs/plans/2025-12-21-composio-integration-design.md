# Composio Integration Design

> **Date**: 2025-12-21
> **Status**: Approved
> **Goal**: Enable AI agents to execute TODOs using tools (GitHub, Slack, Linear, etc.)

## Overview

Integrate Composio and native tool integrations so AI agents can autonomously complete tasks. The public MCP server assigns tasks to internal agent workers, which execute using available tools.

```
┌────────────────────────────────────────────────────────────────┐
│                     todo.mdx Platform                           │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐ │
│  │ Public MCP  │────▶│   Orchestrator   │────▶│   Agent     │ │
│  │  (issue     │     │   (XState in DO) │     │   Worker    │ │
│  │   tracking) │     │                  │     │  (sandbox)  │ │
│  └─────────────┘     └──────────────────┘     └──────┬──────┘ │
│                                                       │        │
│                              ┌────────────────────────┘        │
│                              ▼                                  │
│                    ┌─────────────────────┐                     │
│                    │   Tool Registry     │                     │
│                    │   ┌───────────────┐ │                     │
│                    │   │ Default Tools │ │  (no auth)          │
│                    │   │ • browser     │ │                     │
│                    │   │ • code        │ │                     │
│                    │   │ • search      │ │                     │
│                    │   └───────────────┘ │                     │
│                    │   ┌───────────────┐ │                     │
│                    │   │ Native        │ │  (preferred)        │
│                    │   │ • github      │ │                     │
│                    │   │ • linear      │ │                     │
│                    │   │ • slack       │ │                     │
│                    │   └───────────────┘ │                     │
│                    │   ┌───────────────┐ │                     │
│                    │   │ Composio      │ │  (fallback)         │
│                    │   │ • 250+ apps   │ │                     │
│                    │   └───────────────┘ │                     │
│                    └─────────────────────┘                     │
└────────────────────────────────────────────────────────────────┘
```

## Key Decisions

### 1. Provider Priority: Native > Composio

First-party integrations (GitHub App, Linear OAuth, etc.) are preferred. Composio provides breadth (250+ apps) as fallback.

### 2. Code Mode (Not Tool Flooding)

Instead of 250+ tool definitions flooding agent context, we use [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/):

- Generate TypeScript type definitions from available tools
- Agent writes code that calls tools via bindings
- Code executes in sandboxed V8 isolate
- Tools accessed via `env.github.createPullRequest()` etc.

### 3. Naming Convention

**In code (bindings):** `camelCase.verbObject`
```typescript
await github.createIssue({ title: 'Fix bug' })
await slack.postMessage({ channel: '#eng', text: 'Done!' })
```

**In storage (DB, enums):** `PascalCase`
```typescript
{ app: 'GitHub', provider: 'native', status: 'active' }
```

### 4. XState Orchestrators in Durable Objects

Each level has its own DO with XState machine:

```
OrgDO (per GitHub org/user)
├── State: { connectedApps, defaultTools, limits, billing }
│
└──▶ RepoDO (per repo)
     ├── State: { toolConfig, autoAssign, triggers }
     │
     ├──▶ ProjectDO (per project)
     │    └── State: { workflow, columns, automation }
     │
     ├──▶ PRDO (per PR)
     │    └── State: { review, checks, mergeability }
     │
     └──▶ IssueDO (per issue)
          └── State: { execution, agent, tools, attempts }
```

### 5. IssueDO State Machine

```typescript
const issueMachine = createMachine({
  id: 'issue',
  initial: 'idle',
  states: {
    idle: {
      on: { ASSIGN_AGENT: 'preparing' }
    },
    preparing: {
      // Resolve tool config (inherit from org→repo→project→issue)
      // Check user has required apps connected
      on: {
        TOOLS_READY: 'executing',
        TOOLS_MISSING: 'blocked'
      }
    },
    executing: {
      // Agent running in sandbox with tools
      on: {
        COMPLETED: 'verifying',
        FAILED: 'failed',
        TIMEOUT: 'failed'
      }
    },
    verifying: {
      // Run tests, check PR, validate output
      on: {
        VERIFIED: 'done',
        REJECTED: 'executing' // retry
      }
    },
    blocked: { /* waiting for user to connect apps */ },
    failed: { /* max retries, needs human */ },
    done: { type: 'final' }
  }
})
```

### 6. Tool Configuration Inheritance

```typescript
interface ToolConfig {
  enabled?: string[]        // ['GitHub', 'Slack']
  disabled?: string[]       // ['Twitter']
  includeDefaults?: boolean // default: true
  requiredApps?: string[]   // Agent won't start without these
}

// Resolution: org → repo → project → issue → assignment
```

### 7. DO → Worker RPC for Persistence

DOs never touch D1 directly. All writes go through worker RPC:

```typescript
export class PersistenceRPC extends WorkerEntrypoint<Env> {
  async persistDOState(params: {
    doId: string
    type: 'org' | 'repo' | 'project' | 'pr' | 'issue'
    ref: string
    state: any
  }): Promise<{ success: boolean; error?: string }>

  async logToolExecution(params: { ... }): Promise<void>

  async getConnections(userId: string, apps?: string[]): Promise<Connection[]>
}
```

Retry with steep logarithmic backoff (10 attempts, up to ~100s delay).

## File Structure

```
worker/src/
├── tools/
│   ├── registry.ts              # ToolRegistry - manages all integrations
│   ├── naming.ts                # toBindingName, toStorageName utilities
│   ├── bindings.ts              # createToolBindings for sandbox
│   ├── types.ts                 # Integration, Tool, Connection types
│   │
│   ├── native/                  # First-party integrations (preferred)
│   │   ├── index.ts
│   │   ├── github.ts            # github.createBranch, github.createPullRequest
│   │   ├── linear.ts            # linear.createIssue, linear.updateStatus
│   │   ├── slack.ts             # slack.postMessage, slack.createChannel
│   │   └── stripe.ts            # stripe.createCustomer, stripe.listInvoices
│   │
│   ├── defaults/                # Always available (no auth)
│   │   ├── index.ts
│   │   ├── browser.ts           # browser.fetchPage, browser.screenshot
│   │   ├── code.ts              # code.execute, code.installPackage
│   │   ├── search.ts            # search.web, search.images
│   │   └── file.ts              # file.read, file.write, file.list
│   │
│   └── composio/                # Composio SDK integration
│       ├── client.ts            # getComposio, getComposioTools
│       ├── normalize.ts         # normalizeComposioTool
│       └── execute.ts           # executeComposioTool
│
├── do/
│   ├── base.ts                  # StatefulDO base class with RPC persistence
│   ├── org.ts                   # OrgDO - org-level config & limits
│   ├── repo.ts                  # RepoDO (existing, enhanced)
│   ├── project.ts               # ProjectDO (existing, enhanced)
│   ├── pr.ts                    # PRDO (existing, enhanced)
│   ├── issue.ts                 # IssueDO - task execution state machine
│   │
│   └── machines/                # XState machine definitions
│       ├── org.ts
│       ├── repo.ts
│       ├── project.ts
│       ├── pr.ts
│       └── issue.ts
│
├── rpc/
│   └── persistence.ts           # PersistenceRPC - centralized D1 access
│
├── codegen/
│   └── typedefs.ts              # Generate .d.ts for agent from connections

apps/admin/src/collections/
├── Connections.ts               # User app connections (native + composio)
├── DurableObjects.ts            # Track all active DOs
├── ToolExecutions.ts            # Audit log of tool calls
```

## Payload Collections

### Connections (NEW)

```typescript
const Connections: CollectionConfig = {
  slug: 'connections',
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'org', type: 'relationship', relationTo: 'installations' },
    { name: 'app', type: 'text' },  // 'GitHub', 'Slack', etc.
    { name: 'provider', type: 'select', options: ['native', 'composio'] },
    { name: 'externalId', type: 'text' },
    { name: 'externalRef', type: 'json' },
    { name: 'status', type: 'select', options: ['active', 'expired', 'revoked'] },
    { name: 'scopes', type: 'json' },
    { name: 'connectedAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
  ]
}
```

### DurableObjects (NEW)

```typescript
const DurableObjects: CollectionConfig = {
  slug: 'durable-objects',
  fields: [
    { name: 'type', type: 'select', options: ['org', 'repo', 'project', 'pr', 'issue'] },
    { name: 'doId', type: 'text', unique: true },
    { name: 'ref', type: 'text' },
    { name: 'state', type: 'json' },
    { name: 'lastHeartbeat', type: 'date' },
    { name: 'org', type: 'relationship', relationTo: 'installations' },
    { name: 'repo', type: 'relationship', relationTo: 'repos' },
    { name: 'issue', type: 'relationship', relationTo: 'issues' },
  ]
}
```

### ToolExecutions (NEW)

```typescript
const ToolExecutions: CollectionConfig = {
  slug: 'tool-executions',
  fields: [
    { name: 'doId', type: 'text' },
    { name: 'tool', type: 'text' },      // 'GitHub.createPullRequest'
    { name: 'params', type: 'json' },
    { name: 'result', type: 'json' },
    { name: 'error', type: 'text' },
    { name: 'durationMs', type: 'number' },
    { name: 'executedAt', type: 'date' },
  ]
}
```

## Implementation Phases

### Phase 1: Foundation
- Tool types and registry
- Naming utilities
- Default tools (browser, code, search, file)
- Connections collection

### Phase 2: Native Integrations
- GitHub tools (using existing GitHub App)
- Linear tools (using existing OAuth)
- Slack tools
- Stripe tools

### Phase 3: Composio Integration
- Composio SDK client
- Tool normalization
- OAuth callback flow

### Phase 4: XState Orchestrators
- StatefulDO base class
- PersistenceRPC
- IssueDO with state machine
- Enhanced RepoDO, ProjectDO

### Phase 5: Code Mode Execution
- TypeScript codegen from connections
- Sandbox bindings
- Agent execution with tools

## Future: Agent SDK Support

Phase 1 uses existing Claude Code sandbox. Future phases add:
- [Claude Agent SDK (TypeScript v2)](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/)
- Running within [Cloudflare Agents](https://developers.cloudflare.com/agents/)

## Sources

- [Composio GitHub](https://github.com/ComposioHQ/composio)
- [Composio Docs](https://docs.composio.dev/)
- [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)
- [Cloudflare Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
