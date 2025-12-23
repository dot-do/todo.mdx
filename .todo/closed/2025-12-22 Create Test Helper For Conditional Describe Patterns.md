---
id: todo-osn5
title: "Create test helper for conditional describe patterns"
state: closed
priority: 1
type: chore
labels: ["dedup", "refactor", "tests"]
createdAt: "2025-12-22T08:05:26.519Z"
updatedAt: "2025-12-22T08:12:39.125Z"
closedAt: "2025-12-22T08:12:39.125Z"
source: "beads"
---

# Create test helper for conditional describe patterns

Credential checking pattern duplicated in 10+ test files. Create:
- tests/helpers/descriptors.ts with createConditionalDescribe()
- Pre-built exports: describeWithGitHub, describeWithWorker, describeWithBoth, describeWithSandbox

Update all test files to use shared descriptors.