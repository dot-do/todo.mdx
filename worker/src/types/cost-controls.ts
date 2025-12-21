/**
 * Cost control types for agent budget tracking and enforcement.
 *
 * Cost controls prevent runaway API spending by enforcing:
 * - Monthly budget limits per repo
 * - Daily session limits
 * - Concurrent session limits
 * - Alert thresholds at 50%, 80%, 100% of budget
 * - Hard stops when budget exceeded
 */

/**
 * Budget alert threshold configuration
 */
export interface AlertThreshold {
  /** Threshold percentage (e.g., 50 for 50%) */
  percentage: number
  /** Whether notification has been sent for this threshold this month */
  notified: boolean
  /** When the last notification was sent */
  lastNotifiedAt?: string
}

/**
 * Cost control configuration and tracking
 */
export interface CostControls {
  /** Whether cost controls are enabled for this repo */
  enabled: boolean
  /** Inherit budget limits from organization installation */
  inheritFromOrg: boolean

  // Budget limits
  /** Maximum monthly budget in USD for Claude API spend */
  monthlyBudget?: number
  /** Maximum number of agent sessions per day */
  dailySessionLimit?: number
  /** Maximum number of concurrent agent sessions */
  maxConcurrentSessions?: number

  // Alert configuration
  /** Budget alert thresholds (percentage of monthly budget) */
  alertThresholds: AlertThreshold[]
  /** Email addresses to notify when budget thresholds are reached */
  alertEmails?: Array<{ email: string }>

  // Current tracking (read-only, updated by system)
  /** Current month spend in USD (auto-calculated from agent sessions) */
  currentMonthSpend: number
  /** Start date of current month tracking period */
  currentMonthStart?: string
  /** Number of agent sessions started today (auto-calculated) */
  todaySessionCount: number
  /** Date for today session count tracking */
  todayDate?: string
  /** Number of currently active agent sessions */
  activeSessions: number

  // Hard stops
  /** Whether monthly budget has been exceeded (prevents new sessions) */
  budgetExceeded: boolean
  /** When the budget was exceeded */
  budgetExceededAt?: string
  /** Manually pause all agent operations until this date */
  pausedUntil?: string
}

/**
 * Resolved cost control settings after inheritance
 */
export interface ResolvedCostControls {
  enabled: boolean
  monthlyBudget: number
  dailySessionLimit: number
  maxConcurrentSessions: number
  alertThresholds: AlertThreshold[]
  alertEmails: string[]
}

/**
 * Cost enforcement check result
 */
export interface CostEnforcementResult {
  /** Whether the operation is allowed */
  allowed: boolean
  /** Reason if not allowed */
  reason?: string
  /** Current budget usage percentage */
  budgetUsagePercent?: number
  /** Current session count for today */
  todaySessionCount?: number
  /** Current active sessions */
  activeSessions?: number
}

/**
 * Agent session cost tracking
 */
export interface SessionCost {
  /** Session ID */
  sessionId: string
  /** Repo ID */
  repoId: string
  /** Agent used */
  agent: string
  /** Model used */
  model: string
  /** Input tokens */
  inputTokens: number
  /** Output tokens */
  outputTokens: number
  /** Cached tokens (if applicable) */
  cachedTokens?: number
  /** Total cost in USD */
  costUsd: number
  /** Session start time */
  startedAt: string
  /** Session end time */
  completedAt?: string
  /** Session status */
  status: 'running' | 'completed' | 'failed' | 'timeout'
}

/**
 * Monthly cost summary
 */
export interface MonthlyCostSummary {
  /** Repo ID */
  repoId: string
  /** Month (YYYY-MM) */
  month: string
  /** Total sessions */
  totalSessions: number
  /** Total cost in USD */
  totalCostUsd: number
  /** Total input tokens */
  totalInputTokens: number
  /** Total output tokens */
  totalOutputTokens: number
  /** Average cost per session */
  avgCostPerSession: number
  /** Budget limit */
  budgetLimit: number
  /** Budget usage percentage */
  budgetUsagePercent: number
}
