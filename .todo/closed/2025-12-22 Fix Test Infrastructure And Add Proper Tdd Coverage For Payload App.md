---
id: todo-ozi4
title: "Fix test infrastructure and add proper TDD coverage for Payload app"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T07:22:37.457Z"
updatedAt: "2025-12-22T07:30:17.578Z"
closedAt: "2025-12-22T07:30:17.578Z"
source: "beads"
---

# Fix test infrastructure and add proper TDD coverage for Payload app

Current state is broken:
1. Integration tests fail due to esbuild/vitest environment misconfiguration
2. E2E tests timeout waiting for dev server (60s not enough)
3. Tests assert wrong values ("Payload Blank Template" instead of "TODO.mdx")
4. No coverage for collections (Issues, Milestones, encryption utils, etc.)

Fix with proper RED-GREEN-REFACTOR:
- Tests define ideal final state (title should be "TODO.mdx")
- Fix test infrastructure so tests can run
- Add coverage for all collections and utilities
- Tests fail first (RED), then fix code to pass (GREEN)