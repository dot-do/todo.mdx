# agents.mdx Workflows Design

**Date:** 2025-01-20
**Status:** Draft

## Problem

We have unified TODOs, Roadmap, and realtime context for humans and AI agents. The missing piece is **orchestration** — enabling complete autonomy.

Today:
- Agent finishes work, merges PR
- Human notices, manually triggers next task
- Repeat for every issue in the roadmap

With workflows:
- Issue becomes unblocked → agent spawns automatically
- Agent completes → PR created, reviewed, merged
- Dependent issues unblock → more agents spawn
- Roadmap completes itself

## Core Insight

Workflows enable **autonomous development**:
1. Plan a roadmap with dependencies
2. Define automation rules
3. System executes end-to-end without human intervention

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    .workflows/develop.mdx                        │
│                                                                  │
│  ```typescript                                                   │
│  on.issue.ready(async (issue) => {                              │
│    const diff = await claude.spawn({ repo, task: issue })       │
│    const pr = await github.pr.create({ diff, issue })           │
│    await pr.waitForApproval()                                   │
│    await github.pr.merge(pr)                                    │
│    await beads.close(issue.id)                                  │
│  })                                                              │
│  ```                                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Runtime Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Workflow Definition | `.workflows/*.mdx` | TypeScript code in MDX files |
| Durable Execution | Cloudflare Workflows | `step.do()`, `step.waitForEvent()` |
| Secure Sandbox | CapnWeb | Sandbox arbitrary workflow code |
| Dynamic Loading | Worker Loader | Load per-repo workflow modules |
| Agent Execution | Cloudflare Sandbox | Run Claude Code in cloud |
| State | Durable Objects + D1 | Per-repo coordination |

### Execution Flow

```
GitHub Webhook (push, PR, issue)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    todo.mdx.do Worker                            │
│                                                                  │
│  1. Route to Repo Durable Object                                │
│  2. Load workflow via Worker Loader                             │
│  3. Execute in CapnWeb sandbox                                  │
│  4. Cloudflare Workflow wraps for durability                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Sandbox                            │
│                                                                  │
│  - Clones repo                                                   │
│  - Authenticated with user's Claude JWT                         │
│  - Runs Claude Code with task                                   │
│  - Returns diff                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Proxy API

The runtime provides a global Proxy that abstracts local vs cloud execution:

```typescript
// Available in workflow code via globalThis
globalThis.claude    // spawn, review, ask
globalThis.github    // pr, issues, repos, actions
globalThis.git       // worktree, commit, push, pull, branch
globalThis.beads     // issues, epics, deps, close, update
globalThis.todo      // render() - realtime context for agents
globalThis.slack     // notify (optional)
```

### API Details

```typescript
// Claude - Agent spawning
claude.spawn({ repo, task, context? })  // Run Claude Code
claude.review(pr)                        // Code review
claude.ask(question)                     // Interactive query

// GitHub - Repository operations
github.pr.create({ branch, title, body, issue? })
github.pr.merge(pr)
github.pr.comment(pr, message)
github.pr.review(pr, { approve: true })
github.issues.create({ title, body })
github.issues.comment(issue, message)

// Git - Local operations (in sandbox)
git.worktree.create(name)
git.worktree.remove(name)
git.commit(message)
git.push(branch?)
git.pull()

// Beads - Issue tracking
beads.issues.list(filter?)
beads.issues.ready()
beads.issues.create({ title, type, priority })
beads.issues.update(id, fields)
beads.issues.close(id)
beads.epics.progress(id)

// Todo - Context rendering
todo.render()           // Full TODO.md content
todo.ready(limit?)      // Ready issues as markdown
todo.blocked()          // Blocked issues as markdown

// Slack - Notifications
slack.notify(channel, message)
slack.thread(channel, message, replies)
```

### Local vs Cloud Execution

| Call | Local CLI | Cloud Worker |
|------|-----------|--------------|
| `claude.spawn()` | `bun spawn claude` | Cloudflare Sandbox API |
| `github.pr.create()` | octokit | octokit + `step.do()` |
| `await pr.waitForApproval()` | polling | `step.waitForEvent()` |
| `git.*` | local git | inside Sandbox |
| `beads.*` | `bd` CLI | D1 via Payload RPC |

## Authentication

### One-time Setup

```bash
$ agents.mdx auth

1. Opening oauth.do for login...
2. Authenticating with Claude Code CLI...
3. Storing tokens in WorkOS vault...

✓ Authentication complete
  - GitHub: connected
  - Claude: connected
  - Tokens stored securely
```

### Token Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    oauth.do + WorkOS Vault                       │
│                                                                  │
│  User tokens (encrypted, per-user):                             │
│  ├── claude_jwt: "eyJ..."  (long-lived Claude Code token)       │
│  ├── github_token: "ghp_..." (GitHub OAuth token)               │
│  └── workos_token: "..." (for vault access)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ workflow fetches at runtime
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Sandbox                            │
│                                                                  │
│  Environment:                                                    │
│  ├── ANTHROPIC_API_KEY or CLAUDE_JWT                            │
│  ├── GITHUB_TOKEN                                                │
│  └── Repo (cloned)                                               │
│                                                                  │
│  Claude Code runs authenticated, can push/PR                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Examples

### Auto-develop Ready Issues

```typescript
// .workflows/develop.mdx
on.issue.ready(async (issue) => {
  // Spawn Claude to implement
  const result = await claude.spawn({
    repo: github.repo,
    task: issue.description,
    context: todo.render()
  })

  // Create PR
  const pr = await github.pr.create({
    branch: `${issue.id}-${issue.slug}`,
    title: issue.title,
    body: `Closes #${issue.id}\n\n${result.summary}`,
    diff: result.diff
  })

  // Request review
  await claude.review(pr)

  // Wait for approval (can be days)
  await pr.waitForApproval({ timeout: '7 days' })

  // Merge and close
  await github.pr.merge(pr)
  await beads.close(issue.id)

  // Notify
  await slack.notify('#dev', `✅ ${issue.title} merged`)
})
```

### Auto-close Epics

```typescript
// .workflows/epics.mdx
on.epic.completed(async (epic) => {
  await beads.close(epic.id)
  await slack.notify('#dev', `🎉 Epic complete: ${epic.title}`)
})
```

### Daily Standup

```typescript
// .workflows/standup.mdx
every.day('9am', async () => {
  const ready = await beads.issues.ready()
  const inProgress = beads.issues.list({ status: 'in_progress' })
  const blocked = await beads.issues.blocked()

  await slack.notify('#standup', `
## Daily Update

**Ready to work:** ${ready.length}
**In progress:** ${inProgress.length}
**Blocked:** ${blocked.length}

${todo.ready(5)}
  `)
})
```

## Implementation Phases

### Phase 1: Local Daemon (v1)
- `.workflows/*.mdx` files with TypeScript code blocks
- Local execution via `workflows watch`
- Proxy routes to local git, claude CLI, octokit
- beads-workflows integration for events

### Phase 2: Cloud Execution (v2)
- Cloudflare Workflows for durable execution
- CapnWeb for secure sandboxing
- Worker Loader for dynamic workflow loading
- Cloudflare Sandbox for Claude Code execution
- WorkOS vault for token storage

### Phase 3: Full Autonomy
- Complete GitHub App integration
- Multi-repo orchestration
- Cost controls and rate limiting
- Audit logging and rollback

## Dependencies

- `beads-workflows` - Event system and issue tracking
- `todo.mdx` - Context rendering
- `oauth.do` - Authentication
- `workos` - Token vault
- Cloudflare Workflows - Durable execution
- Cloudflare Sandbox - Agent execution
- CapnWeb - Secure sandboxing

## Open Questions

1. **Cost controls** - How to limit autonomous spending on Claude API?
2. **Rollback** - How to undo autonomous changes that went wrong?
3. **Approval gates** - Should some actions require human approval?
4. **Multi-repo** - How do workflows span multiple repositories?
