# MVP Launch Roadmap

**Date:** 2025-12-20
**Status:** Approved

## Vision

MCP-first product where Claude manages issues autonomously:
- beads (local) syncs to GitHub Issues (cloud)
- Claude reads/writes issues via MCP
- Autonomous Claude sessions implement ready issues
- Human approves PRs, system handles the rest

## Current State

| Component | Status | Gap |
|-----------|--------|-----|
| Beads → GitHub sync | 60% | `updateGitHubIssue()` exists but never called |
| GitHub → Beads sync | 95% | Push webhook stubbed (detects but doesn't fetch) |
| ClaudeSandbox DO | 100% | Fully working |
| Cloudflare Workflows | 100% | Framework complete |
| Cloud Transport | 0% | `callClaude()`, `callGitHub()` throw errors |
| MCP Read Tools | 100% | search, list, ready, blocked, fetch, roadmap |
| MCP Write Tools | 0% | Tests expect create/update/close but not implemented |
| Workflow Triggers | 0% | No webhooks trigger DevelopWorkflow |

## Phased Approach: Outside-In

### Phase 1: Complete Sync Layer

**Goal**: Bidirectional beads ↔ GitHub sync works reliably

| Task | File | Change |
|------|------|--------|
| Wire `updateGitHubIssue()` on push | `worker/src/do/repo.ts` | In `onBeadsPush()`, call update for issues with `github_number` |
| Handle deleted issues | `worker/src/do/repo.ts` | Detect removed issues, close on GitHub |
| Complete push webhook | `worker/src/do/repo.ts` | Fetch `.beads/issues.jsonl` via GitHub API |
| Standardize label schema | `worker/src/do/repo.ts` | Map P0-P4 and status to GitHub labels |

**Verification**:
- `bd create` → appears in GitHub
- `bd update` → GitHub issue updated
- `bd close` → GitHub issue closed
- Edit in GitHub → appears in local beads after `bd sync`

---

### Phase 2: MCP Write Tools

**Goal**: Claude can manage issues via MCP directly

| Task | File | Change |
|------|------|--------|
| Add `create_issue` tool | `worker/src/mcp/index.ts` | Wrap RepoDO create endpoint |
| Add `update_issue` tool | `worker/src/mcp/index.ts` | Wrap RepoDO update endpoint |
| Add `close_issue` tool | `worker/src/mcp/index.ts` | Wrap RepoDO close endpoint |
| Add `add_dependency` tool | `worker/src/mcp/index.ts` | Wrap deps endpoint |
| Add `remove_dependency` tool | `worker/src/mcp/index.ts` | Wrap deps endpoint |

**Verification**:
- MCP `tools/list` shows new tools
- Claude can create, update, close issues via MCP
- E2E tests pass for all write operations

---

### Phase 3: Wire Autonomous Execution

**Goal**: Issues trigger Claude sessions automatically

| Task | File | Change |
|------|------|--------|
| Wire `callClaude()` | `packages/agents.mdx/src/cloud.ts` | Route to CLAUDE_SANDBOX DO |
| Wire `callGitHub()` | `packages/agents.mdx/src/cloud.ts` | Octokit + installation token |
| Issue-ready detection | `worker/src/do/repo.ts` | Check deps on issue close, emit event |
| Trigger DevelopWorkflow | `worker/src/index.ts` | Spawn workflow when issue ready |

**Verification**:
- Close blocking issue → dependent issue shows as ready
- Ready issue → DevelopWorkflow starts
- Workflow creates PR with Claude's implementation

---

### Phase 4: Close the Loop

**Goal**: Full autonomy with human approval gates

| Task | File | Change |
|------|------|--------|
| Handle PR webhooks | `worker/src/index.ts` | Add `pull_request` event handler |
| Detect PR approval | `worker/src/workflows/webhook-handlers.ts` | Parse review events |
| Resume workflow | `worker/src/workflows/develop.ts` | Send event to paused workflow |
| Auto-merge | `worker/src/workflows/develop.ts` | Call GitHub merge API |
| Auto-close issue | `worker/src/workflows/develop.ts` | Close beads issue after merge |

**Verification**:
- Approve PR → workflow resumes
- PR merges automatically
- Issue closes in beads and GitHub
- Dependent issues become ready

---

## Dependencies

```
Phase 1 (Sync)
    │
    ▼
Phase 2 (MCP Write) ←── Can run in parallel with Phase 1
    │
    ▼
Phase 3 (Autonomous Execution) ←── Requires Phase 1
    │
    ▼
Phase 4 (Close Loop) ←── Requires Phase 3
```

## Success Criteria

MVP is launched when:
1. User can `bd sync` and see issues in GitHub
2. Claude can manage issues via MCP (create, update, close)
3. Ready issues trigger autonomous Claude sessions
4. PRs get created with Claude's implementation
5. Approving PR merges and closes the issue

## Open Questions

1. **Cost controls** - How to limit Claude API spend per repo/user?
2. **Approval gates** - Should some issue types require human review before Claude starts?
3. **Rollback** - How to undo autonomous changes that went wrong?
4. **Multi-repo** - How do workflows span multiple repositories?
