# Agent System Design

> **Date**: 2025-12-21
> **Status**: Approved
> **Goal**: Tiered agent system with named agents, dynamic model selection, and unified do/ask interface

## Overview

A tiered agent system where named agents are assigned to issues like team members. Each agent has specific tools, an execution tier, and dynamically resolved model preferences.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           todo.mdx Agent System                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐         ┌──────────────────────────────────────┐  │
│  │   IssueDO/PRDO   │         │            AgentRPC                  │  │
│  │                  │  RPC    │  ┌────────────────────────────────┐  │  │
│  │  - XState        │────────▶│  │  create(def) → Agent stub      │  │  │
│  │  - Session state │         │  │  Routes by def.framework       │  │  │
│  │  - Event history │         │  └───────────────┬────────────────┘  │  │
│  └──────────────────┘         │                  │                   │  │
│           │                   │    ┌─────────────┼─────────────┐     │  │
│           │                   │    ▼             ▼             ▼     │  │
│           │                   │ AiSdkRPC   ClaudeCodeRPC  OpenAiRPC  │  │
│           │                   │    │             │             │     │  │
│           │                   └────┼─────────────┼─────────────┼─────┘  │
│           │                        ▼             ▼             ▼        │
│           │                   ┌─────────────────────────────────────┐   │
│           │                   │         Agent (abstract)            │   │
│           │                   │  do(task, opts) → DoResult          │   │
│           │                   │  ask(question, opts) → AskResult    │   │
│           │                   └─────────────────────────────────────┘   │
│           │                                     │                       │
│           │                                     ▼                       │
│           │                   ┌─────────────────────────────────────┐   │
│           │                   │         Tool Registry               │   │
│  broadcast(event)             │  Native (GitHub, Linear)            │   │
│           │                   │  Composio (250+ apps)               │   │
│           ▼                   │  Defaults (browser, search, file)   │   │
│      WebSocket                └─────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Decisions

### 1. Named Agents as Specialized Workers

Instead of one generic agent, we have named agents with specific capabilities:

| Agent | Tools | Tier | Use Case |
|-------|-------|------|----------|
| Product Priya | todo.mdx.* | light | TODO management |
| Research Reed | search.* | light | Web/internal search |
| Browser Benny | stagehand.*, browserbase.* | light | Browser automation |
| Developer Dana | github.*, code.*, file.* | worker | Code + PRs |
| Full-Stack Fiona | * | sandbox | Complex development |

### 2. Unified Agent Interface

All agents implement the same interface regardless of framework:

```typescript
abstract class Agent extends RpcTarget {
  abstract def: AgentDef

  do(task: string, options?: DoOptions): Promise<DoResult>
  ask(question: string, options?: AskOptions): Promise<AskResult>
}
```

- `do()` - Execute tasks (streaming by default)
- `ask()` - Get information (blocking by default)
- Both support `{ stream: boolean, onEvent: callback }` options
- Task input is always a string (use YAML for structured context)

### 3. Framework-Specific Implementations

```typescript
class AiSdkAgent extends Agent { ... }      // Vercel AI SDK v6
class ClaudeCodeAgent extends Agent { ... } // Claude Code sandbox
class ClaudeAgentSdkAgent extends Agent { ... }  // Claude Agent SDK v2
class OpenAiAgentsAgent extends Agent { ... }    // OpenAI Agents SDK
```

### 4. Workers RPC Architecture

AgentRPC is the unified factory, wrapping framework-specific entrypoints:

```typescript
export class AgentRPC extends WorkerEntrypoint<Env> {
  create(def: AgentDef): Agent {
    switch (def.framework) {
      case 'ai-sdk': return this.env.AI_SDK_AGENT.create(def)
      case 'claude-code': return this.env.CLAUDE_CODE_AGENT.create(def)
      case 'openai-agents': return this.env.OPENAI_AGENT.create(def)
      case 'claude-agent-sdk': return this.env.CLAUDE_AGENT.create(def)
    }
  }

  async get(agentId: string, context: { orgId?, repoId? }): Promise<Agent> {
    const def = await this.resolveAgentDef(agentId, context)
    return this.create(def)
  }
}
```

### 5. Sessions in DOs

Sessions live in their respective DOs (not a separate SessionDO):

- `IssueDO.session` → issue-level agent conversation
- `PRDO.session` → PR-level agent conversation

An issue can have multiple PRs, each with its own session.

### 6. Dynamic Model Selection

Models synced hourly from OpenRouter, with curated defaults:

```typescript
model: 'best' | 'fast' | 'cheap' | 'overall' | string
```

- **best** - Top reasoning, cost be damned
- **fast** - Lowest latency
- **cheap** - Lowest cost per token
- **overall** - Best value (quality × speed / cost)

Orgs can override defaults in Payload.

### 7. Agent Definition Inheritance

Resolution order: repo agents → org agents → built-in agents

## Types

```typescript
interface AgentDef {
  id: string                    // 'priya', 'reed', 'dana'
  name: string                  // 'Product Priya'
  description: string
  tools: string[]               // ['todo.mdx.*', 'search.*']
  tier: 'light' | 'worker' | 'sandbox'
  model: 'best' | 'fast' | 'cheap' | 'overall' | string
  framework: 'ai-sdk' | 'claude-agent-sdk' | 'openai-agents' | 'claude-code'
  instructions?: string
  maxSteps?: number
  timeout?: number
}

interface DoOptions {
  stream?: boolean              // default: true
  onEvent?: (e: AgentEvent) => void
  timeout?: number
  maxSteps?: number
}

interface AskOptions {
  stream?: boolean              // default: false
  onEvent?: (e: AgentEvent) => void
  timeout?: number
}

interface DoResult {
  success: boolean
  output: string
  artifacts?: Artifact[]        // PRs, commits, files changed
  events: AgentEvent[]
}

interface AskResult {
  answer: string
  sources?: Source[]
  confidence?: number
}

type AgentEvent =
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; tool: string; params: unknown }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'message'; content: string }
  | { type: 'error'; error: string }
  | { type: 'done'; result: DoResult | AskResult }
```

## IssueDO Integration

```typescript
export class IssueDO extends StatefulDO {
  private session?: Agent

  async assignAgent(agentId: string): Promise<void> {
    this.session = await this.env.AGENT.get(agentId, {
      orgId: this.issue.orgId,
      repoId: this.issue.repoId
    })
    this.machine.send({ type: 'ASSIGN_AGENT', agent: this.session.def })
  }

  async startWork(): Promise<void> {
    if (!this.session) throw new Error('No agent assigned')

    this.machine.send({ type: 'START' })

    const task = yaml.stringify({
      title: this.issue.title,
      description: this.issue.description,
      acceptance_criteria: this.issue.acceptance,
      repo: this.issue.repo,
      context: this.issue.design
    })

    const result = await this.session.do(task, {
      stream: true,
      onEvent: (event) => {
        this.env.PERSISTENCE.logEvent({ doId: this.id, issueId: this.issue.id, event })
        this.broadcast(event)
      }
    })

    if (result.success) {
      this.machine.send({ type: 'COMPLETED', result })
    } else {
      this.machine.send({ type: 'FAILED', error: result.output })
    }
  }
}
```

## Built-in Agents

```typescript
export const builtinAgents: AgentDef[] = [
  {
    id: 'priya',
    name: 'Product Priya',
    description: 'Manages TODOs and project tracking',
    tools: ['todo.mdx.*'],
    tier: 'light',
    model: 'fast',
    framework: 'ai-sdk',
    instructions: 'You are a product manager. Create, update, and organize TODOs.'
  },
  {
    id: 'reed',
    name: 'Research Reed',
    description: 'Searches web and internal docs',
    tools: ['search.web', 'search.internal'],
    tier: 'light',
    model: 'fast',
    framework: 'ai-sdk',
    instructions: 'You are a research assistant. Find and summarize information.'
  },
  {
    id: 'benny',
    name: 'Browser Benny',
    description: 'Automates browser tasks via Stagehand',
    tools: ['stagehand.*', 'browserbase.*'],
    tier: 'light',
    model: 'overall',
    framework: 'ai-sdk',
    instructions: 'You automate browser tasks. Navigate pages, fill forms, extract data.'
  },
  {
    id: 'dana',
    name: 'Developer Dana',
    description: 'Writes code, creates PRs',
    tools: ['github.*', 'code.*', 'file.*'],
    tier: 'worker',
    model: 'overall',
    framework: 'ai-sdk',
    instructions: 'You are a developer. Write clean code, create branches, open PRs.'
  },
  {
    id: 'fiona',
    name: 'Full-Stack Fiona',
    description: 'Complex multi-file development with full sandbox',
    tools: ['*'],
    tier: 'sandbox',
    model: 'best',
    framework: 'claude-code',
    instructions: 'You are a senior full-stack engineer. Handle complex tasks requiring deep codebase understanding.'
  }
]
```

## Payload Collections

### Agents

```typescript
export const Agents: CollectionConfig = {
  slug: 'agents',
  admin: { useAsTitle: 'name', group: 'Configuration' },
  fields: [
    { name: 'agentId', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'tools', type: 'json', defaultValue: [] },
    { name: 'tier', type: 'select', options: ['light', 'worker', 'sandbox'] },
    { name: 'model', type: 'text', defaultValue: 'overall' },
    { name: 'framework', type: 'select', options: ['ai-sdk', 'claude-agent-sdk', 'openai-agents', 'claude-code'] },
    { name: 'instructions', type: 'code', admin: { language: 'markdown' } },
    { name: 'maxSteps', type: 'number', defaultValue: 10 },
    { name: 'timeout', type: 'number', defaultValue: 300000 },
    { name: 'org', type: 'relationship', relationTo: 'installations' },
    { name: 'repo', type: 'relationship', relationTo: 'repos' },
  ]
}
```

### Models

```typescript
export const Models: CollectionConfig = {
  slug: 'models',
  admin: { useAsTitle: 'name', group: 'Configuration' },
  fields: [
    // From OpenRouter API
    { name: 'modelId', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text' },
    { name: 'provider', type: 'text' },
    { name: 'contextLength', type: 'number' },
    { name: 'pricing', type: 'json' },
    { name: 'capabilities', type: 'json' },
    { name: 'lastSyncedAt', type: 'date' },
    // Manual curation
    { name: 'status', type: 'select', options: ['available', 'recommended', 'deprecated', 'hidden'] },
    { name: 'tier', type: 'select', options: ['fast', 'balanced', 'reasoning', 'specialized'] },
    { name: 'bestFor', type: 'json' },
    { name: 'notes', type: 'textarea' },
  ]
}
```

### ModelDefaults

```typescript
export const ModelDefaults: CollectionConfig = {
  slug: 'model-defaults',
  admin: { group: 'Configuration' },
  fields: [
    { name: 'useCase', type: 'select', options: ['best', 'fast', 'cheap', 'overall'], required: true },
    { name: 'taskType', type: 'select', options: ['coding', 'research', 'browser', 'general'] },
    { name: 'model', type: 'relationship', relationTo: 'models', required: true },
    { name: 'org', type: 'relationship', relationTo: 'installations' },
  ]
}
```

## File Structure

```
worker/src/
├── agents/
│   ├── base.ts                 # abstract Agent, AgentDef, interfaces
│   ├── models.ts               # resolveModel() logic
│   │
│   ├── builtin/
│   │   └── index.ts            # priya, reed, benny, dana, fiona
│   │
│   ├── impl/
│   │   ├── ai-sdk.ts           # AiSdkAgent
│   │   ├── claude-code.ts      # ClaudeCodeAgent
│   │   ├── claude-agent.ts     # ClaudeAgentSdkAgent
│   │   └── openai-agents.ts    # OpenAiAgentsAgent
│   │
│   └── rpc/
│       ├── index.ts            # AgentRPC (unified factory)
│       ├── ai-sdk.ts           # AiSdkAgentRPC
│       ├── claude-code.ts      # ClaudeCodeAgentRPC
│       ├── claude-agent.ts     # ClaudeAgentRPC
│       └── openai-agents.ts    # OpenAiAgentRPC
│
├── jobs/
│   └── sync-models.ts          # Hourly OpenRouter sync

apps/admin/src/collections/
├── Agents.ts                   # Custom agents (org/repo level)
├── Models.ts                   # Synced from OpenRouter
├── ModelDefaults.ts            # best/fast/cheap/overall mappings
```

## wrangler.jsonc Service Bindings

```jsonc
{
  "services": [
    { "binding": "AGENT", "service": "todo-mdx-worker", "entrypoint": "AgentRPC" },
    { "binding": "AI_SDK_AGENT", "service": "todo-mdx-worker", "entrypoint": "AiSdkAgentRPC" },
    { "binding": "CLAUDE_AGENT", "service": "todo-mdx-worker", "entrypoint": "ClaudeAgentRPC" },
    { "binding": "OPENAI_AGENT", "service": "todo-mdx-worker", "entrypoint": "OpenAiAgentRPC" },
    { "binding": "CLAUDE_CODE_AGENT", "service": "todo-mdx-worker", "entrypoint": "ClaudeCodeAgentRPC" }
  ]
}
```

## Implementation Phases

### Phase 1: Foundation
- Agent base class and types
- AgentDef interface
- Built-in agent definitions

### Phase 2: AI SDK Agent
- AiSdkAgent implementation
- AiSdkAgentRPC entrypoint
- Tool integration

### Phase 3: Payload Collections
- Agents collection
- Models collection
- ModelDefaults collection
- OpenRouter sync job

### Phase 4: RPC Layer
- AgentRPC unified factory
- Framework-specific RPC entrypoints
- Wrangler service bindings

### Phase 5: IssueDO Integration
- Agent assignment flow
- Session management in DOs
- Event streaming + persistence

### Phase 6: Additional Frameworks
- ClaudeCodeAgent (existing sandbox)
- ClaudeAgentSdkAgent
- OpenAiAgentsAgent

## Sources

- [Cloudflare Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)
- [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)
- [Claude Agent SDK v2](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [OpenRouter API](https://openrouter.ai/api/v1/models)
