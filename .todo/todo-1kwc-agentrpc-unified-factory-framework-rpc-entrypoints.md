---
id: todo-1kwc
title: "AgentRPC unified factory + framework RPC entrypoints"
state: closed
priority: 1
type: task
labels: ["agents", "rpc"]
createdAt: "2025-12-21T18:47:51.192Z"
updatedAt: "2025-12-21T19:59:02.807Z"
closedAt: "2025-12-21T19:59:02.807Z"
source: "beads"
---

# AgentRPC unified factory + framework RPC entrypoints

Create RPC layer for agent creation:

`worker/src/agents/rpc/index.ts` - AgentRPC
- create(def): routes to framework-specific RPC
- get(agentId, context): resolves def with inheritance, then creates

`worker/src/agents/rpc/ai-sdk.ts` - AiSdkAgentRPC
`worker/src/agents/rpc/claude-code.ts` - ClaudeCodeAgentRPC
`worker/src/agents/rpc/claude-agent.ts` - ClaudeAgentRPC
`worker/src/agents/rpc/openai-agents.ts` - OpenAiAgentRPC

Update wrangler.jsonc with service bindings:
- AGENT → AgentRPC
- AI_SDK_AGENT → AiSdkAgentRPC
- CLAUDE_CODE_AGENT → ClaudeCodeAgentRPC
- etc.

### Related Issues

**Depends on:**
- **todo-ygfz**
- **todo-jlxj**
- **todo-nvxq**

**Blocks:**
- **todo-bmtu**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
