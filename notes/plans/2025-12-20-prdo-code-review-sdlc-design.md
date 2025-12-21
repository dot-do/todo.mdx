# PRDO: PR Code Review SDLC Design

> Design document for autonomous PR code review lifecycle management using XState and Cloudflare Durable Objects.

## Overview

A Durable Object (`PRDO`) that manages the complete code review lifecycle for pull requests. When an agent opens a PR, configured reviewers (agents and/or humans) review sequentially. If changes are requested, the original author agent is dispatched to fix issues, and the review cycle repeats until all reviewers approve.

## Architecture

```
GitHub Webhooks
      │
      ▼
┌─────────────────┐
│  Worker Router  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│      PRDO       │────▶│ Cloudflare       │
│  (XState FSM)   │◀────│ Sandbox          │
└─────────────────┘     │ (Claude Code)    │
         │              └──────────────────┘
         ▼
┌─────────────────┐
│   Payload CMS   │
│  (Config/Logs)  │
└─────────────────┘
```

## Agent Personas

| Agent | GitHub User | Role |
|-------|-------------|------|
| Priya | priya-product-bot | Product reviewer - roadmap alignment |
| Quinn | quinn-qa-bot | QA reviewer - code quality, tests |
| Sam | sam-security-bot | Security reviewer - vulnerability analysis |

Each agent has a GitHub PAT stored encrypted in Payload CMS.

## State Machine

### States

```
┌─────────────┐
│   pending   │  ← PR opened, loading config
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  reviewing  │  ← Agent session dispatched
└──────┬──────┘
       │
       ├──────────────────────┐
       ▼                      ▼
┌──────────────┐       ┌─────────────┐
│checkingApproval│     │   fixing    │  ← Author fixing feedback
└──────┬───────┘       └──────┬──────┘
       │                      │
       ├──────┐               │
       ▼      ▼               ▼
┌──────────┐ ┌─────────┐  ┌─────────────┐
│ approved │ │reviewing│  │  reviewing  │
└────┬─────┘ └─────────┘  └─────────────┘
     │
     ▼
┌─────────────┐
│   merged    │  ← Terminal
└─────────────┘

Additional terminals: closed, error
```

### Global Transitions

Any non-terminal state can transition to:
- `merged` - PR merged (webhook: `closed` + `merged: true`)
- `closed` - PR closed without merge (webhook: `closed` + `merged: false`)

### Context

```typescript
interface PRContext {
  // PR identity
  prNumber: number
  repoFullName: string
  installationId: number

  // Author (for dispatching fix sessions)
  authorAgent: string
  authorPAT: string  // encrypted

  // Review configuration
  reviewers: ReviewerConfig[]
  currentReviewerIndex: number

  // Session tracking
  currentSessionId: string | null
  reviewOutcomes: ReviewOutcome[]

  // Error handling
  retryCount: number
  lastError: string | null

  // Audit
  mergeType: 'auto' | 'approved' | 'forced' | null
}

interface ReviewerConfig {
  agent: string
  type: 'agent' | 'human'
  pat?: string  // encrypted, for agents
  canEscalate?: string[]  // e.g., ['sam']
}

interface ReviewOutcome {
  reviewer: string
  decision: 'approved' | 'changes_requested'
  comment: string
  escalations: string[]
  timestamp: string
}
```

### Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `PR_OPENED` | `pull_request.opened` webhook | `{ prNumber, author, base, head }` |
| `CONFIG_LOADED` | Internal after config fetch | `{ reviewers }` |
| `SESSION_STARTED` | Sandbox callback | `{ sessionId }` |
| `SESSION_FAILED` | Sandbox callback | `{ error }` |
| `REVIEW_COMPLETE` | `pull_request_review.submitted` webhook | `{ reviewer, decision, body }` |
| `FIX_COMPLETE` | `pull_request.synchronize` webhook | `{ commits }` |
| `CLOSE` | `pull_request.closed` webhook | `{ merged: boolean }` |
| `RETRY` | DO alarm | `{}` |

### State Definitions

```typescript
const prMachine = setup({
  types: {
    context: {} as PRContext,
    events: {} as PREvent,
  },
  guards: {
    isApproved: ({ event }) => event.decision === 'approved',
    isChangesRequested: ({ event }) => event.decision === 'changes_requested',
    hasMoreReviewers: ({ context }) =>
      context.currentReviewerIndex < context.reviewers.length - 1,
    allApproved: ({ context }) =>
      context.currentReviewerIndex >= context.reviewers.length - 1,
    canRetry: ({ context }) => context.retryCount < 3,
    wasMerged: ({ event }) => event.merged === true,
  },
  actions: {
    loadRepoConfig: /* fetch from Payload */,
    dispatchReviewSession: /* call sandbox */,
    dispatchFixSession: /* call sandbox as author */,
    recordOutcome: assign({ /* add to reviewOutcomes */ }),
    advanceReviewer: assign({ currentReviewerIndex: ({ context }) => context.currentReviewerIndex + 1 }),
    addEscalations: assign({ /* parse escalations, add reviewers */ }),
    resetToCurrentReviewer: assign({ /* keep index, clear session */ }),
    incrementRetry: assign({ retryCount: ({ context }) => context.retryCount + 1 }),
    resetRetry: assign({ retryCount: 0 }),
    recordError: assign({ lastError: ({ event }) => event.error }),
    recordForceMerge: assign({ mergeType: 'forced' }),
    attemptAutoMerge: /* if configured */,
  },
}).createMachine({
  id: 'prReview',
  initial: 'pending',
  context: { /* initial values */ },

  // Global transitions
  on: {
    CLOSE: [
      { guard: 'wasMerged', target: 'merged', actions: ['recordForceMerge'] },
      { target: 'closed' }
    ]
  },

  states: {
    pending: {
      entry: ['loadRepoConfig'],
      on: {
        CONFIG_LOADED: {
          target: 'reviewing',
          actions: ['dispatchReviewSession']
        }
      }
    },

    reviewing: {
      on: {
        SESSION_STARTED: { actions: ['recordSessionId'] },
        SESSION_FAILED: [
          { guard: 'canRetry', target: 'reviewing', actions: ['incrementRetry', 'scheduleRetry'] },
          { target: 'error', actions: ['recordError'] }
        ],
        REVIEW_COMPLETE: [
          { guard: 'isApproved', target: 'checkingApproval', actions: ['recordOutcome', 'advanceReviewer'] },
          { guard: 'isChangesRequested', target: 'fixing', actions: ['recordOutcome', 'addEscalations'] }
        ]
      }
    },

    checkingApproval: {
      always: [
        { guard: 'hasMoreReviewers', target: 'reviewing', actions: ['dispatchReviewSession'] },
        { guard: 'allApproved', target: 'approved' }
      ]
    },

    fixing: {
      entry: ['dispatchFixSession'],
      on: {
        SESSION_STARTED: { actions: ['recordSessionId'] },
        SESSION_FAILED: [
          { guard: 'canRetry', target: 'fixing', actions: ['incrementRetry', 'scheduleRetry'] },
          { target: 'error', actions: ['recordError'] }
        ],
        FIX_COMPLETE: {
          target: 'reviewing',
          actions: ['resetRetry', 'resetToCurrentReviewer']
        }
      }
    },

    approved: {
      entry: ['attemptAutoMerge'],
      on: {
        MERGE: { target: 'merged' }
      }
    },

    merged: { type: 'final' },
    closed: { type: 'final' },
    error: { type: 'final' }
  }
})
```

## Webhook Routing

```typescript
// worker/src/index.ts

async function handlePullRequestWebhook(payload: PullRequestPayload, env: Env) {
  const { repository, pull_request, action } = payload
  const doId = env.PRDO.idFromName(`${repository.full_name}#${pull_request.number}`)
  const prdo = env.PRDO.get(doId)

  switch (action) {
    case 'opened':
    case 'reopened':
      return prdo.fetch('/event', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PR_OPENED',
          prNumber: pull_request.number,
          repoFullName: repository.full_name,
          author: pull_request.user.login,
          base: pull_request.base.ref,
          head: pull_request.head.sha,
          installationId: payload.installation.id
        })
      })

    case 'synchronize':
      return prdo.fetch('/event', {
        method: 'POST',
        body: JSON.stringify({ type: 'FIX_COMPLETE', commits: payload.commits })
      })

    case 'closed':
      return prdo.fetch('/event', {
        method: 'POST',
        body: JSON.stringify({ type: 'CLOSE', merged: pull_request.merged })
      })
  }
}

async function handlePullRequestReviewWebhook(payload: ReviewPayload, env: Env) {
  if (payload.action !== 'submitted') return

  const { repository, pull_request, review } = payload
  const doId = env.PRDO.idFromName(`${repository.full_name}#${pull_request.number}`)
  const prdo = env.PRDO.get(doId)

  return prdo.fetch('/event', {
    method: 'POST',
    body: JSON.stringify({
      type: 'REVIEW_COMPLETE',
      reviewer: review.user.login,
      decision: review.state,  // 'approved' | 'changes_requested'
      body: review.body
    })
  })
}
```

## Sandbox Integration

```typescript
actions: {
  dispatchReviewSession: async ({ context }, { env }) => {
    const reviewer = context.reviewers[context.currentReviewerIndex]

    await env.SANDBOX.run({
      agent: reviewer.agent,
      pat: decrypt(reviewer.pat, env.ENCRYPTION_KEY),
      task: 'review',
      prompt: buildReviewPrompt(reviewer, context),
      repo: context.repoFullName,
      pr: context.prNumber,
      callback: `https://api.todo.mdx.do/pr/${context.repoFullName}/${context.prNumber}/session`
    })
  },

  dispatchFixSession: async ({ context }, { env }) => {
    const lastReview = context.reviewOutcomes.at(-1)

    await env.SANDBOX.run({
      agent: context.authorAgent,
      pat: decrypt(context.authorPAT, env.ENCRYPTION_KEY),
      task: 'fix',
      prompt: buildFixPrompt(lastReview, context),
      repo: context.repoFullName,
      pr: context.prNumber,
      callback: `https://api.todo.mdx.do/pr/${context.repoFullName}/${context.prNumber}/session`
    })
  }
}

function buildReviewPrompt(reviewer: ReviewerConfig, context: PRContext): string {
  const personas = {
    priya: `You are Priya, a Product reviewer. Review PR #${context.prNumber} for roadmap alignment, user impact, and product consistency.`,
    quinn: `You are Quinn, a QA reviewer. Review PR #${context.prNumber} for code quality, test coverage, and maintainability.`,
    sam: `You are Sam, a Security reviewer. Review PR #${context.prNumber} for vulnerabilities, auth issues, and data exposure.`
  }

  return `${personas[reviewer.agent]}

Repository: ${context.repoFullName}
PR: #${context.prNumber}

Instructions:
1. Clone the repo and checkout the PR branch
2. Review the changes thoroughly
3. Submit a GitHub review with APPROVE or REQUEST_CHANGES
4. Be specific about what needs to change if requesting changes
${reviewer.canEscalate?.length ? `5. If you identify security concerns, include: <!-- escalate: sam -->` : ''}`
}

function buildFixPrompt(review: ReviewOutcome, context: PRContext): string {
  return `You are the author of PR #${context.prNumber} in ${context.repoFullName}.

${review.reviewer} requested changes:

${review.comment}

Instructions:
1. Clone the repo and checkout your PR branch
2. Address ALL the feedback above
3. Commit and push your fixes
4. Do NOT submit a review - just push the fixes`
}
```

## Configuration

### Repo Config (Payload CMS)

```typescript
interface RepoReviewConfig {
  enabled: boolean
  reviewers: ReviewerConfig[]
  autoMerge: boolean
  requireHumanApproval: boolean
}

// Default config
const defaultConfig: RepoReviewConfig = {
  enabled: true,
  reviewers: [
    { agent: 'quinn', type: 'agent', canEscalate: ['sam'] }
  ],
  autoMerge: false,
  requireHumanApproval: false
}
```

### Agent Storage (Payload CMS Collection)

```typescript
// Collection: agents
{
  name: 'quinn',
  githubUsername: 'quinn-qa-bot',
  pat: encrypted('ghp_...'),
  persona: 'QA reviewer focusing on code quality and tests'
}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Sandbox timeout | `SESSION_FAILED` → retry with exponential backoff (1s, 2s, 4s) |
| Invalid review state | Ignore `commented`, only act on `approved`/`changes_requested` |
| Human pushes during review | `FIX_COMPLETE` → re-review current reviewer |
| Unknown reviewer submits | Ignore - only configured reviewers advance state |
| Force merge | `CLOSE` + `merged: true` → `merged` with `mergeType: 'forced'` |
| Duplicate webhooks | Idempotent - ignore events in terminal states |
| Max retries exceeded | Transition to `error` state |

## DO Lifecycle

- **Created**: On first `PR_OPENED` event
- **Naming**: `{owner}/{repo}#{pr_number}` (e.g., `nathanclevenger/todo.mdx#42`)
- **Persistence**: State persisted to DO storage on every transition
- **Alarms**: Used for retry backoff
- **Terminal**: `merged`, `closed`, or `error` - no further transitions

## API Endpoints

```
POST /pr/{owner}/{repo}/{number}/event   - Receive events
GET  /pr/{owner}/{repo}/{number}/status  - Get current state
POST /pr/{owner}/{repo}/{number}/session - Sandbox callbacks
```

## Future Extensibility

| Feature | How design supports it |
|---------|------------------------|
| Parallel reviews | `currentReviewerIndex` → `activeReviewers[]` |
| Per-PR config | Parse PR body/labels in `loadRepoConfig` |
| Human-in-the-loop | `type: 'human'` skips dispatch |
| Metrics | `reviewOutcomes[]` captures timing |
| Notifications | Add actions in transitions |
