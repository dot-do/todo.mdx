---
id: todo-sccq
title: "Built-in agent definitions"
state: closed
priority: 1
type: task
labels: ["agents"]
createdAt: "2025-12-21T18:47:21.964Z"
updatedAt: "2025-12-21T19:18:00.910Z"
closedAt: "2025-12-21T19:18:00.910Z"
source: "beads"
---

# Built-in agent definitions

Create built-in agent roster:

`worker/src/agents/builtin/index.ts`

Agents:
- Product Priya: tools=[todo.mdx.*], tier=light, model=fast
- Research Reed: tools=[search.*], tier=light, model=fast
- Browser Benny: tools=[stagehand.*, browserbase.*], tier=light, model=overall
- Developer Dana: tools=[github.*, code.*, file.*], tier=worker, model=overall
- Full-Stack Fiona: tools=[*], tier=sandbox, model=best, framework=claude-code

Export as `builtinAgents: AgentDef[]`

### Related Issues

**Depends on:**
- **todo-ygfz**
- **todo-jlxj**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
