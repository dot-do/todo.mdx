/**
 * Cost control utilities for agent budget tracking and enforcement.
 *
 * These utilities help:
 * - Resolve cost controls from repo and org settings
 * - Check if operations are allowed based on budget/limits
 * - Track and calculate costs
 * - Reset daily/monthly counters
 * - Send budget alerts
 */

import type {
  CostControls,
  ResolvedCostControls,
  CostEnforcementResult,
  SessionCost,
  AlertThreshold,
} from '../types/cost-controls'
import type { Repo, Installation } from '../types/payload'

/**
 * Default cost control settings
 */
const DEFAULT_COST_CONTROLS: ResolvedCostControls = {
  enabled: true,
  monthlyBudget: 100, // $100 per month default
  dailySessionLimit: 10,
  maxConcurrentSessions: 3,
  alertThresholds: [
    { percentage: 50, notified: false },
    { percentage: 80, notified: false },
    { percentage: 100, notified: false },
  ],
  alertEmails: [],
}

/**
 * Resolve cost controls from repo and org settings.
 * Repo settings override org settings unless inheritFromOrg is true.
 */
export function resolveCostControls(
  repo: Repo,
  installation: Installation
): ResolvedCostControls {
  const repoCostControls = repo.costControls
  const orgApprovalGates = installation.approvalGates

  // If cost controls are disabled, return disabled config
  if (repoCostControls && !repoCostControls.enabled) {
    return {
      ...DEFAULT_COST_CONTROLS,
      enabled: false,
    }
  }

  // If inheriting from org or repo settings not set, use org defaults
  if (!repoCostControls || repoCostControls.inheritFromOrg) {
    return {
      enabled: true,
      monthlyBudget: orgApprovalGates?.maxBudgetPerDay
        ? orgApprovalGates.maxBudgetPerDay * 30
        : DEFAULT_COST_CONTROLS.monthlyBudget,
      dailySessionLimit: DEFAULT_COST_CONTROLS.dailySessionLimit,
      maxConcurrentSessions: orgApprovalGates?.maxAgentSpawnsPerHour
        ? Math.floor(orgApprovalGates.maxAgentSpawnsPerHour / 2)
        : DEFAULT_COST_CONTROLS.maxConcurrentSessions,
      alertThresholds: repoCostControls?.alertThresholds || DEFAULT_COST_CONTROLS.alertThresholds,
      alertEmails:
        repoCostControls?.alertEmails?.map((e) => e.email) ||
        DEFAULT_COST_CONTROLS.alertEmails,
    }
  }

  // Use repo-specific settings
  return {
    enabled: true,
    monthlyBudget: repoCostControls.monthlyBudget || DEFAULT_COST_CONTROLS.monthlyBudget,
    dailySessionLimit:
      repoCostControls.dailySessionLimit || DEFAULT_COST_CONTROLS.dailySessionLimit,
    maxConcurrentSessions:
      repoCostControls.maxConcurrentSessions || DEFAULT_COST_CONTROLS.maxConcurrentSessions,
    alertThresholds: repoCostControls.alertThresholds || DEFAULT_COST_CONTROLS.alertThresholds,
    alertEmails: repoCostControls.alertEmails?.map((e) => e.email) || [],
  }
}

/**
 * Check if a new agent session is allowed based on cost controls.
 * Returns enforcement result with allowed flag and reason if blocked.
 */
export function checkCostEnforcement(
  repo: Repo,
  installation: Installation
): CostEnforcementResult {
  const controls = resolveCostControls(repo, installation)
  const repoCostControls = repo.costControls

  if (!controls.enabled) {
    return { allowed: true }
  }

  // Check if manually paused
  if (repoCostControls?.pausedUntil) {
    const pausedUntil = new Date(repoCostControls.pausedUntil)
    if (pausedUntil > new Date()) {
      return {
        allowed: false,
        reason: `Agent operations are manually paused until ${pausedUntil.toISOString()}`,
      }
    }
  }

  // Check if budget exceeded
  if (repoCostControls?.budgetExceeded) {
    const budgetUsagePercent =
      ((repoCostControls.currentMonthSpend || 0) / controls.monthlyBudget) * 100
    return {
      allowed: false,
      reason: `Monthly budget of $${controls.monthlyBudget} exceeded (${budgetUsagePercent.toFixed(1)}% used)`,
      budgetUsagePercent,
    }
  }

  // Check monthly budget
  const currentMonthSpend = repoCostControls?.currentMonthSpend || 0
  const budgetUsagePercent = (currentMonthSpend / controls.monthlyBudget) * 100
  if (currentMonthSpend >= controls.monthlyBudget) {
    return {
      allowed: false,
      reason: `Monthly budget of $${controls.monthlyBudget} would be exceeded (${budgetUsagePercent.toFixed(1)}% used)`,
      budgetUsagePercent,
    }
  }

  // Check daily session limit
  const todaySessionCount = repoCostControls?.todaySessionCount || 0
  if (todaySessionCount >= controls.dailySessionLimit) {
    return {
      allowed: false,
      reason: `Daily session limit of ${controls.dailySessionLimit} reached (${todaySessionCount} sessions today)`,
      todaySessionCount,
    }
  }

  // Check concurrent session limit
  const activeSessions = repoCostControls?.activeSessions || 0
  if (activeSessions >= controls.maxConcurrentSessions) {
    return {
      allowed: false,
      reason: `Maximum concurrent sessions of ${controls.maxConcurrentSessions} reached (${activeSessions} active)`,
      activeSessions,
    }
  }

  // All checks passed
  return {
    allowed: true,
    budgetUsagePercent,
    todaySessionCount,
    activeSessions,
  }
}

/**
 * Calculate cost of an agent session based on token usage and model pricing.
 */
export function calculateSessionCost(
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number | undefined,
  modelPricing: { prompt: number; completion: number; cached?: number }
): number {
  let cost = 0

  // Input tokens
  cost += inputTokens * modelPricing.prompt

  // Output tokens
  cost += outputTokens * modelPricing.completion

  // Cached tokens (if applicable, usually cheaper)
  if (cachedTokens && modelPricing.cached) {
    cost += cachedTokens * modelPricing.cached
  }

  return cost
}

/**
 * Check if daily counters need to be reset (new day).
 * Returns true if reset is needed.
 */
export function needsDailyReset(repo: Repo): boolean {
  const costControls = repo.costControls
  if (!costControls || !costControls.todayDate) {
    return true
  }

  const todayDate = new Date(costControls.todayDate)
  const now = new Date()

  // Check if date changed (ignoring time)
  return (
    todayDate.getUTCFullYear() !== now.getUTCFullYear() ||
    todayDate.getUTCMonth() !== now.getUTCMonth() ||
    todayDate.getUTCDate() !== now.getUTCDate()
  )
}

/**
 * Check if monthly counters need to be reset (new month).
 * Returns true if reset is needed.
 */
export function needsMonthlyReset(repo: Repo): boolean {
  const costControls = repo.costControls
  if (!costControls || !costControls.currentMonthStart) {
    return true
  }

  const monthStart = new Date(costControls.currentMonthStart)
  const now = new Date()

  // Check if month changed
  return (
    monthStart.getUTCFullYear() !== now.getUTCFullYear() ||
    monthStart.getUTCMonth() !== now.getUTCMonth()
  )
}

/**
 * Check if any budget alert thresholds have been crossed and need notifications.
 * Returns array of thresholds that need alerts sent.
 */
export function checkAlertThresholds(
  repo: Repo,
  controls: ResolvedCostControls
): AlertThreshold[] {
  const costControls = repo.costControls
  if (!costControls || !controls.enabled) {
    return []
  }

  const currentMonthSpend = costControls.currentMonthSpend || 0
  const budgetUsagePercent = (currentMonthSpend / controls.monthlyBudget) * 100

  const needsAlert: AlertThreshold[] = []

  for (const threshold of controls.alertThresholds) {
    // Check if threshold crossed and not yet notified
    if (budgetUsagePercent >= threshold.percentage && !threshold.notified) {
      needsAlert.push(threshold)
    }
  }

  return needsAlert
}

/**
 * Format budget alert email content.
 */
export function formatBudgetAlert(
  repo: Repo,
  threshold: AlertThreshold,
  currentSpend: number,
  budgetLimit: number
): { subject: string; body: string } {
  const usagePercent = (currentSpend / budgetLimit) * 100

  return {
    subject: `[todo.mdx] Budget Alert: ${repo.fullName} at ${threshold.percentage}% (${usagePercent.toFixed(1)}%)`,
    body: `
Budget Alert for ${repo.fullName}

Current spend: $${currentSpend.toFixed(2)}
Budget limit: $${budgetLimit.toFixed(2)}
Usage: ${usagePercent.toFixed(1)}%

Threshold: ${threshold.percentage}%

${
  threshold.percentage >= 100
    ? 'HARD STOP: Budget exceeded. New agent sessions will be blocked until next month or budget increased.'
    : `Approaching budget limit. ${(100 - usagePercent).toFixed(1)}% remaining.`
}

View repo settings: https://todo.mdx.do/admin/repos/${repo.id}
    `.trim(),
  }
}

/**
 * Update cost controls after session start.
 * Increments today session count and active sessions.
 */
export function incrementSessionCounters(costControls: CostControls): Partial<CostControls> {
  const now = new Date()

  // Reset daily counter if needed
  const todayDate = costControls.todayDate ? new Date(costControls.todayDate) : null
  const isNewDay =
    !todayDate ||
    todayDate.getUTCFullYear() !== now.getUTCFullYear() ||
    todayDate.getUTCMonth() !== now.getUTCMonth() ||
    todayDate.getUTCDate() !== now.getUTCDate()

  return {
    todaySessionCount: isNewDay ? 1 : (costControls.todaySessionCount || 0) + 1,
    todayDate: isNewDay ? now.toISOString() : costControls.todayDate,
    activeSessions: (costControls.activeSessions || 0) + 1,
  }
}

/**
 * Update cost controls after session completion.
 * Decrements active sessions and adds cost to monthly spend.
 */
export function updateSessionCompletion(
  costControls: CostControls,
  sessionCost: number
): Partial<CostControls> {
  const now = new Date()

  // Reset monthly counter if needed
  const monthStart = costControls.currentMonthStart
    ? new Date(costControls.currentMonthStart)
    : null
  const isNewMonth =
    !monthStart ||
    monthStart.getUTCFullYear() !== now.getUTCFullYear() ||
    monthStart.getUTCMonth() !== now.getUTCMonth()

  const currentMonthSpend = isNewMonth ? sessionCost : (costControls.currentMonthSpend || 0) + sessionCost

  return {
    activeSessions: Math.max(0, (costControls.activeSessions || 0) - 1),
    currentMonthSpend,
    currentMonthStart: isNewMonth ? now.toISOString() : costControls.currentMonthStart,
  }
}
