---
id: todo-ggz7
title: "Cost controls: budget per repo, daily limits"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T18:43:13.281Z"
updatedAt: "2025-12-21T20:01:48.550Z"
closedAt: "2025-12-21T20:01:48.550Z"
source: "beads"
dependsOn: ["todo-3auj"]
---

# Cost controls: budget per repo, daily limits

Implement cost controls to prevent runaway API spending:

1. **Budget per repo** - Max Claude API spend per repo per month
2. **Daily limits** - Max autonomous sessions per day
3. **Rate limiting** - Max concurrent agent sessions
4. **Alerts** - Notify at 50%, 80%, 100% of budget
5. **Hard stop** - Pause autonomy when budget exceeded

Store in Payload CMS, enforce in workflow dispatch.

### Related Issues

**Depends on:**
- [todo-3auj](./todo-3auj.md)