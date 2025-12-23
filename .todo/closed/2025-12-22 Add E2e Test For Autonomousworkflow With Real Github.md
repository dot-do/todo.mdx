---
id: todo-l5ix
title: "Add E2E test for AutonomousWorkflow with real GitHub"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-22T07:25:41.493Z"
updatedAt: "2025-12-22T07:31:50.845Z"
closedAt: "2025-12-22T07:31:50.845Z"
source: "beads"
---

# Add E2E test for AutonomousWorkflow with real GitHub

Create comprehensive E2E test that verifies AutonomousWorkflow works end-to-end with real GitHub operations:

1. Add API route POST /api/workflows/autonomous to trigger the workflow
2. Create E2E test that:
   - Creates a real GitHub issue in test repo
   - Triggers AutonomousWorkflow via API
   - Waits for Claude to execute in sandbox
   - Verifies tests run and pass
   - Verifies PR is created
   - Verifies PR can be merged
   - Verifies issue is closed

Must use NO mocks - real GitHub API, real sandbox execution, real PR merge.