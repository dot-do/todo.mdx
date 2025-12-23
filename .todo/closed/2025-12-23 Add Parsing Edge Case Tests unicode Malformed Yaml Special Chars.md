---
id: todo-7lm2
title: "Add parsing edge case tests (unicode, malformed YAML, special chars)"
state: closed
priority: 2
type: task
labels: ["phase-4", "testing"]
createdAt: "2025-12-23T13:46:04.037Z"
updatedAt: "2025-12-23T14:22:48.389Z"
closedAt: "2025-12-23T14:22:48.389Z"
source: "beads"
---

# Add parsing edge case tests (unicode, malformed YAML, special chars)

Expand tests/parser-edge-cases.test.ts with: empty frontmatter, missing required fields with fallback, malformed YAML graceful handling, unicode titles, special chars in ID sanitization, duplicate ID handling, very long title truncation.