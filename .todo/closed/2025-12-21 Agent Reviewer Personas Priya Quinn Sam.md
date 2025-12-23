---
id: todo-gavy
title: "Agent reviewer personas: Priya, Quinn, Sam"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-21T18:42:20.431Z"
updatedAt: "2025-12-21T19:49:53.513Z"
closedAt: "2025-12-21T19:49:53.513Z"
source: "beads"
dependsOn: ["todo-o9pp"]
blocks: ["todo-tpef"]
---

# Agent reviewer personas: Priya, Quinn, Sam

Create agent persona configurations for code review:

- **Priya** (priya-product-bot): Product reviewer - roadmap alignment, user impact
- **Quinn** (quinn-qa-bot): QA reviewer - code quality, test coverage
- **Sam** (sam-security-bot): Security reviewer - vulnerabilities, auth issues

Each needs:
- GitHub bot account with PAT
- Persona prompt template
- Escalation rules (e.g., Quinn can escalate to Sam)

### Related Issues

**Depends on:**
- [todo-o9pp](./todo-o9pp.md)

**Blocks:**
- [todo-tpef](./todo-tpef.md)