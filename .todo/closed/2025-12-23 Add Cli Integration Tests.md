---
id: todo-wu4t
title: "Add CLI integration tests"
state: closed
priority: 0
type: task
labels: ["critical", "tdd", "testing"]
createdAt: "2025-12-23T13:04:49.632Z"
updatedAt: "2025-12-23T13:09:38.763Z"
closedAt: "2025-12-23T13:09:38.763Z"
source: "beads"
---

# Add CLI integration tests

CLI is completely untested - 3 tests are skipped and CLI is excluded from coverage. Need to: 1) Un-skip existing tests 2) Add tests for buildCommand, syncCommand, watchCommand, initCommand 3) Remove CLI exclusion from vitest coverage config