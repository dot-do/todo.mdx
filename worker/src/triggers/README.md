# Assignment Trigger

Automatically triggers `DevelopWorkflow` when issues are assigned to agents.

## How It Works

When an issue is assigned to a builtin agent (e.g., `cody`, `priya`, `dana`):

1. **Check Conditions**: Verifies the issue is ready for work
   - Assignee is a builtin agent
   - Issue is not closed
   - Issue has no open blockers

2. **Cancel Previous Workflow** (on reassignment)
   - If the issue was previously assigned to a different agent
   - Terminates the old workflow before starting new one

3. **Trigger DevelopWorkflow**
   - Passes agent config (capabilities, tier, model, tools)
   - Workflow uses agent config to customize execution

## Usage

### In a webhook handler or issue watcher:

```typescript
import { handleAssignment } from './triggers/assignment'
import type { Issue } from 'beads-workflows'

// When an issue.updated event occurs
async function onIssueUpdated(
  issue: Issue,
  changes: Changes,
  env: WorkflowEnv
) {
  // Check if assignee changed
  if (changes.assignee) {
    const issuesMap = await loadAllIssues()

    await handleAssignment({
      issue,
      issuesMap,
      env,
      repo: { owner: 'myorg', name: 'myrepo' },
      installationId: 12345,
      previousAssignee: changes.assignee.from as string | undefined,
    })
  }
}
```

### With beads-workflows hooks:

```typescript
import { createHooks } from 'beads-workflows'
import { handleAssignment } from './triggers/assignment'

const hooks = createHooks()

hooks.on.issue.updated(async (issue, changes) => {
  if (changes?.assignee) {
    await handleAssignment({
      issue,
      issuesMap: await loadAllIssues(),
      env,
      repo,
      installationId,
      previousAssignee: changes.assignee.from as string | undefined,
    })
  }
})
```

## Agent Assignment

Assign an issue to an agent via:

```bash
# Using beads CLI
bd update todo-123 --assignee=cody

# Or edit issue directly in .beads/issues.jsonl
```

Available agents:
- `priya` - Product Priya (TODO tracking)
- `reed` - Research Reed (Web/internal search)
- `benny` - Browser Benny (Browser automation)
- `cody` - Coder Cody (General development)
- `dana` - Developer Dana (Code and PRs)
- `fiona` - Full-Stack Fiona (Complex multi-file work)

## Testing

```bash
cd worker
pnpm test -- src/triggers/assignment.test.ts
```

## Example: End-to-End Flow

1. Issue created: `bd create --title="Add login feature"`
2. Issue assigned: `bd update todo-xyz --assignee=cody`
3. Trigger fires: `handleAssignment()` checks conditions
4. Agent config loaded: Cody's capabilities, model, tools
5. Workflow started: `DevelopWorkflow` with Cody's config
6. Cody implements: Uses Claude Sonnet 4.5, GitHub tools
7. PR created: Workflow creates PR for review
8. Issue closed: After PR merged

## Reassignment

If you reassign an issue:

```bash
bd update todo-xyz --assignee=fiona
```

The trigger will:
1. Terminate Cody's workflow
2. Start Fiona's workflow with her config (sandbox tier, best model)

This allows switching from lightweight to heavyweight agents as needed.
