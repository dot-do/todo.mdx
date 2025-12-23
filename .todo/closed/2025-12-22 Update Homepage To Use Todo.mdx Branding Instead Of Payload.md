---
id: todo-m4zt
title: "Update homepage to use TODO.mdx branding instead of Payload"
state: closed
priority: 3
type: chore
labels: []
createdAt: "2025-12-22T08:05:30.769Z"
updatedAt: "2025-12-22T08:07:23.583Z"
closedAt: "2025-12-22T08:07:23.583Z"
source: "beads"
---

# Update homepage to use TODO.mdx branding instead of Payload

Refactoring: Replace Payload branding with TODO.mdx on homepage

Current issues in apps/admin/src/app/(frontend)/page.tsx:
1. Shows Payload favicon logo - should show TODO.mdx logo or remove
2. Links to Payload docs - should link to TODO.mdx docs or remove
3. target="_blank" on admin panel link - unnecessary for same-site navigation

Use TDD approach:
1. Write E2E test assertions for correct branding (RED)
2. Update page.tsx to pass tests (GREEN)
3. Verify all tests pass