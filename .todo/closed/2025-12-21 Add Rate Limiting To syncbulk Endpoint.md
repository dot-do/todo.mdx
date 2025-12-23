---
id: todo-jjtn
title: "Add rate limiting to /sync/bulk endpoint"
state: closed
priority: 1
type: bug
labels: ["rate-limiting", "security"]
createdAt: "2025-12-22T00:23:46.809Z"
updatedAt: "2025-12-22T06:49:53.150Z"
closedAt: "2025-12-22T06:49:53.150Z"
source: "beads"
---

# Add rate limiting to /sync/bulk endpoint

The /sync/bulk endpoint in RepoDO creates GitHub issues in a loop with only 500ms delay. No authentication is checked within the DO itself. Could exhaust GitHub API rate limits or enable spam.