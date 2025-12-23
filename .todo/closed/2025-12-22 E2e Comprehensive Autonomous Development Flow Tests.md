---
id: todo-gjl2
title: "E2E: Comprehensive autonomous development flow tests"
state: closed
priority: 1
type: task
labels: []
createdAt: "2025-12-22T13:01:08.121Z"
updatedAt: "2025-12-22T13:06:51.166Z"
closedAt: "2025-12-22T13:06:51.166Z"
source: "beads"
---

# E2E: Comprehensive autonomous development flow tests

End-to-end tests covering the full autonomous development lifecycle:

## Happy Path
1. **Assignment → Dispatch**: Assign agent → DevelopWorkflow starts
2. **Execution**: Sandbox runs → code generated → tests pass
3. **PR Creation**: Branch pushed → PR opened with diff
4. **Review Cycle**: 
   - Reviewer requests changes
   - Agent implements requested changes
   - Agent pushes new commits
   - Re-review triggered
5. **Approval**: Reviewer approves
6. **Merge**: PR merged automatically
7. **Closure**: Issue closed, dependencies unblocked

## Edge Cases
- Re-assignment mid-workflow (cancel + restart)
- Blocked issue (should not dispatch)
- Test failures (retry or escalate)
- Review rejection (implement fixes)
- Merge conflicts (rebase or escalate)
- Timeout handling
- Agent not found (error handling)
- Multiple issues ready simultaneously

## Infrastructure
- Use real GitHub test repo (dot-do/test.mdx)
- Real Claude sandbox execution
- Actual PR workflow with reviewers
- Cleanup after each test