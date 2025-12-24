---
id: todo-n2kh
title: "Fix CLI version mismatch (0.1.0 vs 0.2.0)"
state: in_progress
priority: 2
type: bug
labels: ["bug", "cli"]
createdAt: "2025-12-24T11:05:53.668Z"
updatedAt: "2025-12-24T11:11:41.482Z"
source: "beads"
---

# Fix CLI version mismatch (0.1.0 vs 0.2.0)

src/cli.ts:14 hardcodes VERSION = '0.1.0' but package.json shows version 0.2.0. Should read version from package.json or be updated to match.