# Priya - Planner Agent

Event-driven triggers for autonomous roadmap management and agent assignment.

## Overview

Priya is the Planner Agent that reacts to beads events to manage autonomous development. It uses DAG analysis and capability matching to intelligently assign work to agents.

## Architecture

### Core Capabilities

- **DAG Analysis**: Find ready issues, identify critical path, analyze blockers
- **Agent Matching**: Match issues to best-fit agents based on capabilities and focus areas
- **Dependency Review**: Suggest missing dependencies on issue creation
- **Capacity-Aware**: No artificial limits - the DAG is the throttle

### Event-Driven Triggers

Priya reacts to the following events:

#### 1. `issue.closed`
When an issue is closed, Priya:
1. Finds all issues that were blocked by the closed issue
2. Checks which of those are now ready (all blockers closed)
3. Matches each ready issue to the best-fit agent
4. Assigns the agent to the issue

**Implementation**: `onIssueClosed()`

#### 2. `epic.completed`
When all children of an epic are closed, Priya:
1. Verifies all children are actually closed (via `epics.progress()`)
2. Closes the epic
3. Posts a completion summary

**Implementation**: `onEpicCompleted()`

#### 3. `issue.blocked`
When an issue becomes blocked, Priya:
1. Clears the assignee (agent can't work on it)
2. Finds other ready work
3. Reassigns the agent to new ready work

**Implementation**: `onIssueBlocked()`

#### 4. `pr.merged`
When a PR is merged, Priya:
1. Extracts issue reference from PR body (e.g., "Closes #test-123")
2. Verifies the linked issue is closed
3. If not closed, closes it

**Implementation**: `onPRMerged()`

## Integration

### Registering Triggers

To wire Priya's triggers to the beads-workflows hooks system:

```typescript
import { createHooks } from 'beads-workflows'
import { onIssueClosed, onEpicCompleted, onIssueBlocked, onPRMerged } from './agents/priya'

// Create hooks instance
const hooks = createHooks()

// Register Priya's triggers
hooks.on.issue.closed(async (issue) => {
  await onIssueClosed(runtime, issue)
})

hooks.on.epic.completed(async (epic, children) => {
  await onEpicCompleted(runtime, epic, children)
})

hooks.on.issue.blocked(async (issue, blocker) => {
  await onIssueBlocked(runtime, issue, blocker)
})

// PR merged is typically triggered from GitHub webhook handler
// See worker/src/index.ts for GitHub webhook integration
```

### Emitting Events

Events can be emitted from various parts of the system:

```typescript
// From issue close operation
await hooks.emitAsync('issue.closed', closedIssue)

// From epic progress check
const progress = await epics.progress(epicId)
if (progress.percentage === 100) {
  await hooks.emitAsync('epic.completed', epic, children)
}

// From dependency addition
await hooks.emitAsync('issue.blocked', issue, blocker)

// From GitHub webhook
if (payload.action === 'closed' && payload.pull_request.merged) {
  await onPRMerged(runtime, {
    number: payload.pull_request.number,
    title: payload.pull_request.title,
    body: payload.pull_request.body,
    branch: payload.pull_request.head.ref,
    url: payload.pull_request.html_url,
    state: 'merged'
  })
}
```

## Testing

All trigger handlers have comprehensive unit tests:

```bash
pnpm --filter @todo.mdx/worker test -- src/agents/priya/triggers.test.ts
```

Test coverage includes:
- Happy path scenarios
- Edge cases (no matches, still blocked, etc.)
- Error handling (graceful degradation)
- Agent reassignment logic

## Dependencies

Priya's triggers depend on:
- `packages/agents.mdx/src/dag.ts` - DAG analysis (ready(), unblocks(), etc.)
- `packages/agents.mdx/src/matcher.ts` - Agent matching (matchAgent())
- `packages/agents.mdx/src/capabilities.ts` - Capability parsing
- `packages/beads-workflows/src/hooks.ts` - Event hooks API

## Future Enhancements

- **Scheduled Triggers**:
  - Daily standup: Status summary
  - Weekly planning: Groom backlog

- **On-Demand Triggers**:
  - "Priya, review the roadmap"
  - "Priya, plan next sprint"

- **Advanced Features**:
  - Suggest missing dependencies on `issue.created`
  - Critical path optimization
  - Capacity planning and forecasting
