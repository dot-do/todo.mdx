---
id: todo-jui0
title: "Implement tool execution in Claude agent"
state: closed
priority: 0
type: feature
labels: []
createdAt: "2025-12-21T23:22:49.219Z"
updatedAt: "2025-12-21T23:36:16.840Z"
closedAt: "2025-12-21T23:36:16.840Z"
source: "beads"
---

# Implement tool execution in Claude agent

claude-agent.ts emits tool_call events but never executes tools or emits tool_result. Need to implement actual tool resolution and execution following the Anthropic SDK patterns.