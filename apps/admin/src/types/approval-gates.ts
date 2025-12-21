/**
 * Approval gate configuration types
 *
 * Defines the approval gate schema that cascades from org → repo → issue/PR levels.
 *
 * @see apps/admin/src/collections/Installations.ts - Org-level defaults
 * @see apps/admin/src/collections/Repos.ts - Repo-level overrides
 * @see apps/admin/src/collections/Issues.ts - Issue-level overrides
 */

/**
 * Issue type that can trigger approval requirements
 */
export type IssueType = 'task' | 'bug' | 'feature' | 'epic'

/**
 * Risk threshold levels for automatic approval
 */
export type RiskThreshold = 'low' | 'medium' | 'high'

/**
 * Trigger conditions that require approval
 */
export interface ApprovalTriggers {
  /** PR/issue labels that trigger approval (e.g., ["security", "breaking-change"]) */
  labels?: Array<{ label: string }>

  /** Issue types that trigger approval */
  types?: Array<{ type: IssueType }>

  /** File path patterns (glob) that trigger approval (e.g., ["src/auth/**", "*.sql"]) */
  filesChanged?: Array<{ pattern: string }>

  /** Risk score threshold (0-100) that triggers approval */
  riskScore?: number
}

/**
 * Approver configuration
 */
export interface ApprovalApprovers {
  /** GitHub usernames who can approve */
  approvers?: Array<{ username: string }>

  /** GitHub teams who can approve (format: org/team-slug) */
  teamApprovers?: Array<{ team: string }>
}

/**
 * Core approval gate configuration
 * Matches the schema from todo-6i9r issue
 */
export interface ApprovalConfig {
  /** Whether human approval is required */
  requireHumanApproval: boolean

  /** Conditions that trigger approval requirements */
  triggers?: ApprovalTriggers

  /** GitHub usernames who can approve */
  approvers?: string[]

  /** GitHub teams who can approve (format: org/team-slug) */
  teamApprovers?: string[]
}

/**
 * Organization-level approval gate configuration
 * Set in Installations collection
 */
export interface OrgApprovalGates extends ApprovalApprovers {
  /** Require human approval before merging PRs (default for all repos) */
  requireHumanApproval?: boolean

  /** Allow fully autonomous operation (no human approval required) */
  allowFullAutonomy?: boolean

  /** Maximum daily budget in USD for agent operations */
  maxBudgetPerDay?: number

  /** Rate limit: max agent spawns per hour */
  maxAgentSpawnsPerHour?: number

  /** Risk threshold for automatic approval */
  riskThreshold?: RiskThreshold

  /** File paths that always require human approval (glob patterns) */
  criticalPaths?: string[]

  /** Issue labels that allow automatic merge without human approval */
  autoApproveLabels?: string[]

  /** Issue labels that always require human approval */
  requireApprovalLabels?: string[]

  /** Trigger conditions (org-wide defaults) */
  triggers?: ApprovalTriggers
}

/**
 * Repository-level approval gate configuration
 * Set in Repos collection, inherits from org-level
 */
export interface RepoApprovalGates extends OrgApprovalGates {
  /** Inherit approval gate settings from organization */
  inheritFromOrg?: boolean
}

/**
 * Issue-level approval gate configuration
 * Set in Issues collection, inherits from repo-level
 */
export interface IssueApprovalGates extends ApprovalApprovers {
  /** Inherit approval gate settings from repository */
  inheritFromRepo?: boolean

  /** Require human approval for PRs related to this issue */
  requireHumanApproval?: boolean

  /** Calculated risk score for this issue (0-100) */
  riskScore?: number
}

/**
 * Resolved/effective approval configuration after cascading inheritance
 * org defaults → repo overrides → issue overrides
 */
export interface EffectiveApprovalConfig {
  /** Whether human approval is required */
  requireHumanApproval: boolean

  /** Trigger conditions (merged from org/repo/issue) */
  triggers: {
    labels: string[]
    types: IssueType[]
    filesChanged: string[]
    riskScore?: number
  }

  /** GitHub usernames who can approve (merged) */
  approvers: string[]

  /** GitHub teams who can approve (merged) */
  teamApprovers: string[]

  /** Critical file paths that trigger approval */
  criticalPaths: string[]

  /** Risk threshold level */
  riskThreshold: RiskThreshold

  /** Maximum daily budget */
  maxBudgetPerDay?: number

  /** Maximum agent spawns per hour */
  maxAgentSpawnsPerHour?: number
}

/**
 * Helper function to resolve effective approval config from cascading levels
 *
 * @param org - Organization-level defaults
 * @param repo - Repository-level overrides
 * @param issue - Issue-level overrides
 * @returns Effective/resolved approval configuration
 */
export function resolveApprovalConfig(
  org?: OrgApprovalGates,
  repo?: RepoApprovalGates,
  issue?: IssueApprovalGates,
): EffectiveApprovalConfig {
  // Start with org-level defaults
  const base = org || {}

  // Apply repo-level overrides if not inheriting from org
  const repoConfig = repo?.inheritFromOrg === false ? repo : {}

  // Apply issue-level overrides if not inheriting from repo
  const issueConfig = issue?.inheritFromRepo === false ? issue : {}

  // Merge triggers
  const triggers = {
    labels: [
      ...(base.triggers?.labels?.map(l => l.label) || []),
      ...(repoConfig.triggers?.labels?.map(l => l.label) || []),
      ...(base.requireApprovalLabels || []),
      ...(repoConfig.requireApprovalLabels || []),
    ],
    types: [
      ...(base.triggers?.types?.map(t => t.type) || []),
      ...(repoConfig.triggers?.types?.map(t => t.type) || []),
    ],
    filesChanged: [
      ...(base.triggers?.filesChanged?.map(f => f.pattern) || []),
      ...(repoConfig.triggers?.filesChanged?.map(f => f.pattern) || []),
      ...(base.criticalPaths || []),
      ...(repoConfig.criticalPaths || []),
    ],
    riskScore: issueConfig.riskScore || repoConfig.triggers?.riskScore || base.triggers?.riskScore,
  }

  // Merge approvers
  const approvers = [
    ...(base.approvers?.map(a => a.username) || []),
    ...(repoConfig.approvers?.map(a => a.username) || []),
    ...(issueConfig.approvers?.map(a => a.username) || []),
  ]

  const teamApprovers = [
    ...(base.teamApprovers?.map(t => t.team) || []),
    ...(repoConfig.teamApprovers?.map(t => t.team) || []),
    ...(issueConfig.teamApprovers?.map(t => t.team) || []),
  ]

  return {
    requireHumanApproval:
      issueConfig.requireHumanApproval ??
      repoConfig.requireHumanApproval ??
      base.requireHumanApproval ??
      true,
    triggers,
    approvers,
    teamApprovers,
    criticalPaths: [
      ...(base.criticalPaths || []),
      ...(repoConfig.criticalPaths || []),
    ],
    riskThreshold: repoConfig.riskThreshold || base.riskThreshold || 'high',
    maxBudgetPerDay: repoConfig.maxBudgetPerDay || base.maxBudgetPerDay,
    maxAgentSpawnsPerHour: repoConfig.maxAgentSpawnsPerHour || base.maxAgentSpawnsPerHour,
  }
}
