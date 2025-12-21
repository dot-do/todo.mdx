# Beads Sync Workflow Design

**Date:** 2025-12-21
**Status:** Approved

## Problem

221 beads issues exist in `.beads/issues.jsonl` but only 1 GitHub issue exists. The sync from beads → GitHub isn't triggered on installation.

## Solution

Create a durable Cloudflare Workflow that syncs all beads issues to GitHub on app installation.

## Architecture

```
GitHub App Installed
        ↓
  Installation Webhook (worker/src/index.ts)
        ↓
  Trigger BeadsSyncWorkflow
        ↓
  ┌─────────────────────────────────────┐
  │  BeadsSyncWorkflow (durable)        │
  │  1. Fetch .beads/issues.jsonl       │
  │  2. Import to RepoDO                │
  │  3. For each issue without GH#:     │
  │     - Create GitHub issue           │
  │     - Update DO with github_number  │
  │     - Sleep 500ms (rate limit)      │
  │  4. Commit updated JSONL to repo    │
  └─────────────────────────────────────┘
```

## Workflow Implementation

**File:** `worker/src/workflows/sync.ts`

```typescript
export class BeadsSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const { repoFullName, installationId } = event.payload

    // Step 1: Fetch JSONL from repo
    const jsonl = await step.do('fetch-jsonl', async () => {
      return await fetchBeadsJsonl(repoFullName, installationId)
    })

    // Step 2: Parse issues and find unsynced
    const issues = await step.do('parse-issues', () => {
      return parseJsonl(jsonl).filter(i => !i.github_number)
    })

    // Step 3: Create GitHub issues (batched with sleeps)
    for (const issue of issues) {
      await step.do(`create-gh-${issue.id}`, async () => {
        const ghNumber = await createGitHubIssue(issue, repoFullName, installationId)
        return { id: issue.id, github_number: ghNumber }
      })
      await step.sleep('rate-limit', '500ms')
    }

    // Step 4: Commit updated JSONL
    await step.do('commit-jsonl', async () => {
      await commitUpdatedJsonl(repoFullName, installationId)
    })
  }
}
```

Each `step.do()` is durable - if the workflow fails at step 150/221, it resumes from there on retry.

## Triggering

**Installation webhook handler:**

```typescript
async function handleInstallation(payload: InstallationPayload, env: Env) {
  if (payload.action === 'created') {
    for (const repo of payload.repositories || []) {
      const hasBeads = await checkForBeadsFile(repo.full_name, payload.installation.id)

      if (hasBeads) {
        await env.BEADS_SYNC_WORKFLOW.create({
          id: `sync-${repo.full_name}-${Date.now()}`,
          params: {
            repoFullName: repo.full_name,
            installationId: payload.installation.id,
          }
        })
      }
    }
  }
}
```

**Manual trigger endpoint:**
- `POST /api/repos/:owner/:name/sync/init` - triggers workflow for existing repos

## Configuration

**Add to `worker/wrangler.jsonc`:**

```jsonc
"workflows": [
  {
    "binding": "BEADS_SYNC_WORKFLOW",
    "name": "beads-sync-workflow",
    "class_name": "BeadsSyncWorkflow"
  }
]
```

## Testing Strategy (TDD)

1. **Unit test** - Workflow logic with mocked GitHub API
2. **Integration test** - Workflow runs against test.mdx repo
3. **E2E test** - Install app on new repo, verify all issues synced

Test file: `tests/e2e/beads-sync-workflow.test.ts`
