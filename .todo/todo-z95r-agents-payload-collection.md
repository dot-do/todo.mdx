---
id: todo-z95r
title: "Agents Payload collection"
state: closed
priority: 1
type: task
labels: ["agents", "payload"]
createdAt: "2025-12-21T18:47:33.509Z"
updatedAt: "2025-12-21T19:08:43.586Z"
closedAt: "2025-12-21T19:08:43.586Z"
source: "beads"
---

# Agents Payload collection

Create Agents collection for custom org/repo agents:

`apps/admin/src/collections/Agents.ts`

Fields:
- agentId: text (unique)
- name: text
- description: textarea
- tools: json
- tier: select [light, worker, sandbox]
- model: text (default: 'overall')
- framework: select [ai-sdk, claude-agent-sdk, openai-agents, claude-code]
- instructions: code (markdown)
- maxSteps: number
- timeout: number
- org: relationship to installations
- repo: relationship to repos

Add to payload.config.ts

### Related Issues

**Depends on:**
- **todo-ygfz**

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
