# Cost Controls Implementation Guide

This document describes where and how cost controls are enforced in the todo.mdx agent system.

## Overview

Cost controls prevent runaway API spending by enforcing:
- Monthly budget limits per repo (inheritable from org)
- Daily session limits
- Concurrent session limits
- Alert thresholds at 50%, 80%, 100% of budget
- Hard stops when budget exceeded

## Schema

### Repos Collection

Cost control fields added to `apps/admin/src/collections/Repos.ts`:

```typescript
costControls: {
  enabled: boolean
  inheritFromOrg: boolean

  // Limits (overrides org if not inheriting)
  monthlyBudget?: number          // USD
  dailySessionLimit?: number      // sessions per day
  maxConcurrentSessions?: number  // concurrent sessions

  // Alerts
  alertThresholds: Array<{
    percentage: number            // e.g., 50 for 50%
    notified: boolean
    lastNotifiedAt?: date
  }>
  alertEmails?: Array<{ email: string }>

  // Current tracking (read-only, auto-updated)
  currentMonthSpend: number       // USD
  currentMonthStart?: date
  todaySessionCount: number
  todayDate?: date
  activeSessions: number

  // Hard stops
  budgetExceeded: boolean
  budgetExceededAt?: date
  pausedUntil?: date             // manual pause
}
```

### Installations Collection

Existing budget fields in `apps/admin/src/collections/Installations.ts`:

```typescript
approvalGates: {
  maxBudgetPerDay: number        // USD per day (org-level)
  maxAgentSpawnsPerHour: number  // rate limit
  // ... other approval gate settings
}
```

## Enforcement Points

### 1. Workflow Dispatch (Primary Enforcement)

**File**: `worker/src/workflows/webhook-handlers.ts`
**Function**: `handleIssueReady()`

This is the **primary enforcement point** where cost controls must be checked before starting any agent work.

#### Implementation Steps:

1. **Import cost control utilities**:
   ```typescript
   import { checkCostEnforcement, resolveCostControls } from '../utils/cost-controls'
   ```

2. **Check before workflow creation**:
   ```typescript
   export async function handleIssueReady(
     env: Env,
     issue: Issue,
     repo: Repo,
     installationId: number
   ): Promise<WorkflowInstance> {
     // 1. Fetch full repo and installation from Payload
     const fullRepo = await env.PAYLOAD.findByID({
       collection: 'repos',
       id: repo.id,
     })

     const installation = await env.PAYLOAD.findByID({
       collection: 'installations',
       id: installationId,
     })

     // 2. Check cost controls
     const enforcement = checkCostEnforcement(fullRepo, installation)

     if (!enforcement.allowed) {
       console.log(`[Workflows] Session blocked: ${enforcement.reason}`)

       // Log blocked attempt
       await env.PAYLOAD.create({
         collection: 'tool-executions',
         data: {
           doId: 'workflow-dispatch',
           tool: 'workflow.start',
           params: { issueId: issue.id, reason: 'cost-control-blocked' },
           error: enforcement.reason,
           durationMs: 0,
           executedAt: new Date().toISOString(),
           user: installation.users[0]?.id, // First user in installation
           connection: installation.id,
         },
       })

       throw new Error(`Cost control blocked: ${enforcement.reason}`)
     }

     // 3. Increment session counters BEFORE starting workflow
     const costControls = fullRepo.costControls
     const updates = incrementSessionCounters(costControls)

     await env.PAYLOAD.update({
       collection: 'repos',
       id: repo.id,
       data: {
         costControls: {
           ...costControls,
           ...updates,
         },
       },
     })

     // 4. Proceed with workflow creation
     const instance = await env.DEVELOP_WORKFLOW.create({
       id: `develop-${issue.id}`,
       params: { repo, issue, installationId },
     })

     return instance
   }
   ```

3. **Track completion and update spend**:
   After workflow completes, update the cost tracking in the workflow completion handler.

### 2. Agent Session Start (IssueDO)

**File**: `worker/src/do/issue.ts`
**Function**: `assignAgent()`

Secondary check when agent is assigned to issue (redundant safety check).

```typescript
private async assignAgent(request: Request): Promise<Response> {
  const body = await request.json()

  // Fetch repo and installation
  const repo = await this.env.PAYLOAD.findByID({
    collection: 'repos',
    id: body.repoId,
  })

  const installation = await this.env.PAYLOAD.findByID({
    collection: 'installations',
    id: body.installationId,
  })

  // Check cost controls
  const enforcement = checkCostEnforcement(repo, installation)

  if (!enforcement.allowed) {
    return Response.json({
      ok: false,
      error: enforcement.reason,
    }, 429) // Too Many Requests
  }

  // Proceed with agent assignment...
}
```

### 3. Session Completion Tracking

**File**: `worker/src/do/issue.ts`
**Function**: `handleExecuteTask()` completion

Track token usage and update spend after each session completes.

```typescript
private async handleExecuteTask(params: ExecuteParams): Promise<void> {
  const sessionId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Execute task...
    const result = await executeSandbox(params)

    // Calculate cost from token usage
    const model = await this.env.PAYLOAD.findOne({
      collection: 'models',
      where: { modelId: { equals: result.model } },
    })

    const cost = calculateSessionCost(
      result.inputTokens,
      result.outputTokens,
      result.cachedTokens,
      model.pricing
    )

    // Update repo cost tracking
    const repo = await this.env.PAYLOAD.findByID({
      collection: 'repos',
      id: params.repoId,
    })

    const costControls = repo.costControls
    const updates = updateSessionCompletion(costControls, cost)

    await this.env.PAYLOAD.update({
      collection: 'repos',
      id: params.repoId,
      data: {
        costControls: {
          ...costControls,
          ...updates,
        },
      },
    })

    // Check if alerts need to be sent
    const controls = resolveCostControls(repo, installation)
    const alerts = checkAlertThresholds(repo, controls)

    for (const alert of alerts) {
      await sendBudgetAlert(repo, alert, controls)
    }

    // Check if budget exceeded (hard stop)
    if (updates.currentMonthSpend >= controls.monthlyBudget) {
      await this.env.PAYLOAD.update({
        collection: 'repos',
        id: params.repoId,
        data: {
          'costControls.budgetExceeded': true,
          'costControls.budgetExceededAt': new Date().toISOString(),
        },
      })
    }

  } catch (error) {
    // Still decrement active sessions on error
    await this.env.PAYLOAD.update({
      collection: 'repos',
      id: params.repoId,
      data: {
        'costControls.activeSessions': Math.max(0, costControls.activeSessions - 1),
      },
    })

    throw error
  }
}
```

### 4. Budget Reset (Cron/Scheduled)

**File**: `worker/src/cron/cost-tracking.ts` (to be created)

Scheduled job to reset daily/monthly counters and alert notifications.

```typescript
/**
 * Cron job to reset cost tracking counters
 * Runs daily at midnight UTC
 */
export async function resetCostCounters(env: Env): Promise<void> {
  const now = new Date()

  // Find all repos with cost controls enabled
  const repos = await env.PAYLOAD.find({
    collection: 'repos',
    where: {
      'costControls.enabled': { equals: true },
    },
  })

  for (const repo of repos.docs) {
    const costControls = repo.costControls
    const updates: any = {}

    // Reset daily counters
    if (needsDailyReset(repo)) {
      updates.todaySessionCount = 0
      updates.todayDate = now.toISOString()
    }

    // Reset monthly counters
    if (needsMonthlyReset(repo)) {
      updates.currentMonthSpend = 0
      updates.currentMonthStart = now.toISOString()
      updates.budgetExceeded = false
      updates.budgetExceededAt = null

      // Reset alert notifications
      updates.alertThresholds = costControls.alertThresholds.map(t => ({
        ...t,
        notified: false,
        lastNotifiedAt: null,
      }))
    }

    if (Object.keys(updates).length > 0) {
      await env.PAYLOAD.update({
        collection: 'repos',
        id: repo.id,
        data: { costControls: { ...costControls, ...updates } },
      })
    }
  }
}
```

### 5. Alert Notifications

**File**: `worker/src/utils/notifications.ts` (to be created)

Send email alerts when budget thresholds are crossed.

```typescript
export async function sendBudgetAlert(
  env: Env,
  repo: Repo,
  alert: AlertThreshold,
  controls: ResolvedCostControls
): Promise<void> {
  const { subject, body } = formatBudgetAlert(
    repo,
    alert,
    repo.costControls.currentMonthSpend,
    controls.monthlyBudget
  )

  // Send to all configured email addresses
  for (const email of controls.alertEmails) {
    await env.EMAIL.send({
      to: email,
      from: 'alerts@todo.mdx.do',
      subject,
      text: body,
    })
  }

  // Mark threshold as notified
  const updatedThresholds = controls.alertThresholds.map(t =>
    t.percentage === alert.percentage
      ? { ...t, notified: true, lastNotifiedAt: new Date().toISOString() }
      : t
  )

  await env.PAYLOAD.update({
    collection: 'repos',
    id: repo.id,
    data: {
      'costControls.alertThresholds': updatedThresholds,
    },
  })
}
```

## Integration Checklist

- [ ] Add cost control enforcement to `handleIssueReady()`
- [ ] Add cost tracking to `handleExecuteTask()` completion
- [ ] Create `resetCostCounters()` cron job
- [ ] Create `sendBudgetAlert()` notification function
- [ ] Add budget exceeded check to agent assignment
- [ ] Add cost tracking to tool execution logging
- [ ] Create admin UI dashboard for cost monitoring
- [ ] Add API endpoints for cost control management
- [ ] Add tests for cost enforcement logic
- [ ] Document cost control configuration for users

## Testing

### Manual Testing

1. **Set low budget**: Set repo `monthlyBudget` to $1
2. **Trigger workflow**: Start agent session via API
3. **Verify blocking**: After budget exceeded, verify new sessions blocked
4. **Check alerts**: Verify emails sent at 50%, 80%, 100% thresholds
5. **Test reset**: Manually update `currentMonthStart` to trigger reset

### Unit Tests

```typescript
describe('Cost Controls', () => {
  it('blocks session when budget exceeded', () => {
    const repo = {
      costControls: {
        enabled: true,
        monthlyBudget: 100,
        currentMonthSpend: 101,
        budgetExceeded: true,
      },
    }

    const result = checkCostEnforcement(repo, installation)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('budget')
  })

  it('allows session when under budget', () => {
    const repo = {
      costControls: {
        enabled: true,
        monthlyBudget: 100,
        currentMonthSpend: 50,
      },
    }

    const result = checkCostEnforcement(repo, installation)
    expect(result.allowed).toBe(true)
  })

  it('blocks session when daily limit reached', () => {
    const repo = {
      costControls: {
        enabled: true,
        dailySessionLimit: 10,
        todaySessionCount: 10,
      },
    }

    const result = checkCostEnforcement(repo, installation)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('daily')
  })
})
```

## Monitoring

### Payload Admin Dashboard

Add to `apps/admin/`:

1. **Cost Summary Widget**: Show current month spend vs budget
2. **Session Count Graph**: Daily sessions over time
3. **Alert History**: List of sent budget alerts
4. **Top Spending Repos**: Repos sorted by current month spend

### Metrics to Track

- Total sessions per repo per day/month
- Average cost per session
- Budget utilization percentage
- Alert notification count
- Blocked session count

## Future Enhancements

1. **Per-user budgets**: Track spending per GitHub user
2. **Per-agent budgets**: Different limits for different agent types
3. **Dynamic pricing**: Adjust limits based on model pricing changes
4. **Predictive alerts**: Warn when projected spend will exceed budget
5. **Cost optimization**: Auto-select cheaper models when approaching limits
6. **Rollover budgets**: Allow unused budget to roll over to next month
