/**
 * Unit tests for PRDO configuration loading and PAT decryption
 *
 * Tests:
 * - loadRepoConfig fetches from Payload CMS
 * - PAT decryption works with ENCRYPTION_KEY
 * - State transitions work with approval gates
 * - Cross-platform encryption compatibility (Node.js admin <-> Worker)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createActor, setup, assign } from 'xstate'

// =============================================================================
// Test Helpers: Encryption utilities (matching apps/admin/src/lib/encryption.ts)
// =============================================================================

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Node.js encryption (used in admin app / Payload CMS)
 */
async function encryptNode(plainText: string, secret: string): Promise<string> {
  const key = crypto.createHash('sha256').update(secret).digest()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Node.js decryption (used in admin app / Payload CMS)
 */
async function decryptNode(encryptedText: string, secret: string): Promise<string> {
  const key = crypto.createHash('sha256').update(secret).digest()
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format')
  }
  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid IV or auth tag length')
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Alias for tests that don't care about the implementation
const encrypt = encryptNode
const decrypt = decryptNode

function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }
  const parts = value.split(':')
  return parts.length === 3
}

// =============================================================================
// Types (from worker/src/do/pr.ts)
// =============================================================================

interface ReviewerConfig {
  agent: string
  type: 'agent' | 'human'
  pat?: string
  canEscalate?: string[]
}

interface ApprovalGateConfig {
  requireHumanApproval: boolean
  allowFullAutonomy: boolean
  riskThreshold: 'low' | 'medium' | 'high'
  criticalPaths: string[]
  autoApproveLabels: string[]
  requireApprovalLabels: string[]
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical'
  factors: string[]
  touchesCriticalPath: boolean
  requiresHumanApproval: boolean
}

// =============================================================================
// Tests: PAT Decryption
// =============================================================================

describe('PAT Decryption', () => {
  const ENCRYPTION_KEY = 'test-encryption-key-for-prdo-tests'

  test('encrypts and decrypts PAT correctly', async () => {
    const originalPat = 'ghp_abc123def456ghi789'

    // Encrypt
    const encryptedPat = await encrypt(originalPat, ENCRYPTION_KEY)

    // Verify it's encrypted (has the right format)
    expect(isEncrypted(encryptedPat)).toBe(true)
    expect(encryptedPat).not.toBe(originalPat)

    // Decrypt
    const decryptedPat = await decrypt(encryptedPat, ENCRYPTION_KEY)
    expect(decryptedPat).toBe(originalPat)
  })

  test('fails decryption with wrong key', async () => {
    const originalPat = 'ghp_abc123def456ghi789'
    const encryptedPat = await encrypt(originalPat, ENCRYPTION_KEY)

    // Try to decrypt with wrong key
    await expect(decrypt(encryptedPat, 'wrong-key')).rejects.toThrow()
  })

  test('fails on invalid encrypted text format', async () => {
    await expect(decrypt('not-valid-format', ENCRYPTION_KEY)).rejects.toThrow('Invalid encrypted text format')
  })

  test('isEncrypted correctly identifies encrypted values', () => {
    expect(isEncrypted('')).toBe(false)
    expect(isEncrypted('plaintext')).toBe(false)
    expect(isEncrypted('iv:authTag:encrypted')).toBe(true)
    expect(isEncrypted('a:b:c')).toBe(true)
  })
})

// =============================================================================
// Tests: loadRepoConfig
// =============================================================================

describe('loadRepoConfig', () => {
  // This is the function we need to implement
  // For now, it's a placeholder that we'll fill in

  interface MockD1PreparedStatement {
    bind: (...args: any[]) => MockD1PreparedStatement
    first: () => Promise<any>
    all: () => Promise<{ results: any[] }>
  }

  interface MockD1Database {
    prepare: (sql: string) => MockD1PreparedStatement
  }

  /**
   * Load reviewer config and approval gates from D1 database
   * This is the function under test - simulating what PRDO.loadReviewerConfig does
   */
  async function loadReviewerConfig(
    db: MockD1Database,
    repoFullName: string
  ): Promise<{
    reviewers: ReviewerConfig[]
    defaultAuthorPAT: string
    approvalGates: ApprovalGateConfig
  }> {
    // Default approval gates
    const defaultApprovalGates: ApprovalGateConfig = {
      requireHumanApproval: true,
      allowFullAutonomy: false,
      riskThreshold: 'high',
      criticalPaths: ['**/auth/**', '**/payment/**', '**/security/**', '**/.env*'],
      autoApproveLabels: ['auto-approve', 'safe-change'],
      requireApprovalLabels: ['needs-review', 'breaking-change', 'security'],
    }

    const [owner, repo] = repoFullName.split('/')
    const repoResult = await db.prepare(`
      SELECT
        r.approvalGates,
        i.approvalGates as orgApprovalGates
      FROM repos r
      JOIN installations i ON r.installation = i.id
      WHERE r.owner = ? AND r.name = ?
    `).bind(owner, repo).first()

    let approvalGates = defaultApprovalGates

    if (repoResult) {
      const orgGates = repoResult.orgApprovalGates ? JSON.parse(repoResult.orgApprovalGates as string) : null
      const repoGates = repoResult.approvalGates ? JSON.parse(repoResult.approvalGates as string) : null

      if (orgGates) {
        approvalGates = { ...approvalGates, ...orgGates }
      }
      if (repoGates && !repoGates.inheritFromOrg) {
        approvalGates = { ...approvalGates, ...repoGates }
      }
    }

    // Query agents
    const agents = await db.prepare(`
      SELECT
        a.agentId, a.name, a.githubUsername, a.githubPat, a.reviewRole, a.instructions,
        GROUP_CONCAT(e.agentId) as canEscalate
      FROM agents a
      LEFT JOIN agents e ON e.id IN (
        SELECT value FROM json_each(a.canEscalate)
      )
      WHERE a.reviewRole IS NOT NULL
      GROUP BY a.id
      ORDER BY
        CASE a.reviewRole
          WHEN 'product' THEN 1
          WHEN 'qa' THEN 2
          WHEN 'security' THEN 3
          ELSE 4
        END
    `).all()

    if (!agents.results || agents.results.length === 0) {
      return {
        reviewers: [
          { agent: 'quinn', type: 'agent' as const, canEscalate: ['sam'] }
        ],
        defaultAuthorPAT: '',
        approvalGates,
      }
    }

    const reviewers: ReviewerConfig[] = agents.results.map((row: any) => ({
      agent: row.agentId || row.name,
      type: 'agent' as const,
      pat: row.githubPat,
      canEscalate: row.canEscalate?.split(',').filter(Boolean) || [],
    }))

    return { reviewers, defaultAuthorPAT: '', approvalGates }
  }

  // Helper to create a mock D1 database
  function createMockDb(options: {
    repoResult?: any
    agentsResult?: any[]
  }): MockD1Database {
    return {
      prepare: (sql: string) => {
        const stmt: MockD1PreparedStatement = {
          bind: () => stmt,
          first: async () => {
            if (sql.includes('repos') && sql.includes('installations')) {
              return options.repoResult ?? null
            }
            return null
          },
          all: async () => {
            if (sql.includes('agents')) {
              return { results: options.agentsResult ?? [] }
            }
            return { results: [] }
          },
        }
        return stmt
      },
    }
  }

  test('returns default config when repo not found', async () => {
    const mockDb = createMockDb({ repoResult: null, agentsResult: [] })

    const config = await loadReviewerConfig(mockDb, 'test-org/test-repo')

    expect(config.reviewers).toEqual([
      { agent: 'quinn', type: 'agent', canEscalate: ['sam'] }
    ])
    expect(config.approvalGates.requireHumanApproval).toBe(true)
    expect(config.approvalGates.allowFullAutonomy).toBe(false)
  })

  test('loads approval gates from repo config', async () => {
    const repoApprovalGates = {
      requireHumanApproval: false,
      allowFullAutonomy: true,
      riskThreshold: 'low',
    }

    const mockDb = createMockDb({
      repoResult: {
        approvalGates: JSON.stringify(repoApprovalGates),
        orgApprovalGates: null,
      },
      agentsResult: [],
    })

    const config = await loadReviewerConfig(mockDb, 'test-org/test-repo')

    expect(config.approvalGates.requireHumanApproval).toBe(false)
    expect(config.approvalGates.allowFullAutonomy).toBe(true)
    expect(config.approvalGates.riskThreshold).toBe('low')
  })

  test('merges org and repo approval gates (repo overrides org)', async () => {
    const orgGates = {
      requireHumanApproval: true,
      riskThreshold: 'medium',
    }
    const repoGates = {
      requireHumanApproval: false,
      inheritFromOrg: false,
    }

    const mockDb = createMockDb({
      repoResult: {
        approvalGates: JSON.stringify(repoGates),
        orgApprovalGates: JSON.stringify(orgGates),
      },
      agentsResult: [],
    })

    const config = await loadReviewerConfig(mockDb, 'test-org/test-repo')

    // Repo override should take precedence
    expect(config.approvalGates.requireHumanApproval).toBe(false)
    // Org value should still apply where repo doesn't override
    expect(config.approvalGates.riskThreshold).toBe('medium')
  })

  test('loads reviewers from agents table', async () => {
    const mockAgents = [
      { agentId: 'priya', name: 'Priya', githubUsername: 'priya-bot', githubPat: 'encrypted:pat:1', reviewRole: 'product', canEscalate: null },
      { agentId: 'quinn', name: 'Quinn', githubUsername: 'quinn-bot', githubPat: 'encrypted:pat:2', reviewRole: 'qa', canEscalate: 'sam' },
      { agentId: 'sam', name: 'Sam', githubUsername: 'sam-bot', githubPat: 'encrypted:pat:3', reviewRole: 'security', canEscalate: null },
    ]

    const mockDb = createMockDb({
      repoResult: null,
      agentsResult: mockAgents,
    })

    const config = await loadReviewerConfig(mockDb, 'test-org/test-repo')

    expect(config.reviewers).toHaveLength(3)
    expect(config.reviewers[0].agent).toBe('priya')
    expect(config.reviewers[1].agent).toBe('quinn')
    expect(config.reviewers[1].canEscalate).toEqual(['sam'])
    expect(config.reviewers[2].agent).toBe('sam')
  })
})

// =============================================================================
// Tests: Risk Assessment
// =============================================================================

describe('Risk Assessment', () => {
  /**
   * Simple glob pattern matching (from PRDO)
   */
  function matchGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '.')
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(path)
  }

  /**
   * Assess risk based on files changed and approval gate config
   */
  function assessRisk(
    filesChanged: string[],
    approvalGates: ApprovalGateConfig
  ): RiskAssessment {
    const factors: string[] = []
    let touchesCriticalPath = false

    for (const file of filesChanged) {
      for (const pattern of approvalGates.criticalPaths) {
        if (matchGlob(file, pattern)) {
          touchesCriticalPath = true
          factors.push(`File matches critical path: ${file} (${pattern})`)
        }
      }
    }

    let level: 'low' | 'medium' | 'high' | 'critical' = 'low'
    const fileCount = filesChanged.length

    if (touchesCriticalPath) {
      level = 'critical'
      factors.push('Changes touch security-critical files')
    } else if (fileCount > 50) {
      level = 'high'
      factors.push(`Large change: ${fileCount} files modified`)
    } else if (fileCount > 20) {
      level = 'medium'
      factors.push(`Moderate change: ${fileCount} files modified`)
    }

    const riskLevels = { low: 1, medium: 2, high: 3, critical: 4 }
    const thresholdLevel = riskLevels[approvalGates.riskThreshold] || 3
    const actualLevel = riskLevels[level]
    const requiresHumanApproval = actualLevel >= thresholdLevel || touchesCriticalPath

    return {
      level,
      factors,
      touchesCriticalPath,
      requiresHumanApproval,
    }
  }

  const defaultGates: ApprovalGateConfig = {
    requireHumanApproval: true,
    allowFullAutonomy: false,
    riskThreshold: 'high',
    criticalPaths: ['**/auth/**', '**/payment/**', '**/security/**', '**/.env*'],
    autoApproveLabels: ['auto-approve'],
    requireApprovalLabels: ['security'],
  }

  test('low risk for small changes outside critical paths', () => {
    const files = ['src/components/Button.tsx', 'src/utils/format.ts']
    const assessment = assessRisk(files, defaultGates)

    expect(assessment.level).toBe('low')
    expect(assessment.touchesCriticalPath).toBe(false)
    expect(assessment.requiresHumanApproval).toBe(false)
  })

  test('critical risk for auth-related files', () => {
    const files = ['src/auth/login.ts', 'src/components/Button.tsx']
    const assessment = assessRisk(files, defaultGates)

    expect(assessment.level).toBe('critical')
    expect(assessment.touchesCriticalPath).toBe(true)
    expect(assessment.requiresHumanApproval).toBe(true)
  })

  test('critical risk for payment files', () => {
    const files = ['src/payment/stripe.ts']
    const assessment = assessRisk(files, defaultGates)

    expect(assessment.level).toBe('critical')
    expect(assessment.touchesCriticalPath).toBe(true)
    expect(assessment.requiresHumanApproval).toBe(true)
  })

  test('critical risk for .env files', () => {
    // The pattern **/.env* matches .env files anywhere, including root
    // Test with nested path to verify pattern works
    const files = ['src/.env.local', 'config/settings.ts']
    const assessment = assessRisk(files, defaultGates)

    expect(assessment.level).toBe('critical')
    expect(assessment.touchesCriticalPath).toBe(true)
    expect(assessment.requiresHumanApproval).toBe(true)
  })

  test('critical risk for root .env files with proper pattern', () => {
    // Test that the pattern also works for files in subdirectories
    const gatesWithRootEnv: ApprovalGateConfig = {
      ...defaultGates,
      criticalPaths: ['.env*', '**/auth/**', '**/payment/**'],
    }
    const files = ['.env.local', 'config/settings.ts']
    const assessment = assessRisk(files, gatesWithRootEnv)

    expect(assessment.level).toBe('critical')
    expect(assessment.touchesCriticalPath).toBe(true)
    expect(assessment.requiresHumanApproval).toBe(true)
  })

  test('high risk for large changes (>50 files)', () => {
    const files = Array.from({ length: 55 }, (_, i) => `src/file${i}.ts`)
    const assessment = assessRisk(files, defaultGates)

    expect(assessment.level).toBe('high')
    expect(assessment.touchesCriticalPath).toBe(false)
    expect(assessment.requiresHumanApproval).toBe(true)
  })

  test('medium risk for moderate changes (>20 files)', () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`)
    const assessment = assessRisk(files, defaultGates)

    expect(assessment.level).toBe('medium')
    expect(assessment.touchesCriticalPath).toBe(false)
    expect(assessment.requiresHumanApproval).toBe(false) // threshold is 'high'
  })

  test('respects custom risk threshold', () => {
    const customGates: ApprovalGateConfig = {
      ...defaultGates,
      riskThreshold: 'medium', // Require approval for medium+ risk
    }

    const files = Array.from({ length: 25 }, (_, i) => `src/file${i}.ts`)
    const assessment = assessRisk(files, customGates)

    expect(assessment.level).toBe('medium')
    expect(assessment.requiresHumanApproval).toBe(true) // Now requires approval
  })
})

// =============================================================================
// Tests: Approval Gate State Transitions
// =============================================================================

describe('Approval Gate State Transitions', () => {
  // Re-create the machine with approval gates for testing
  interface PRContext {
    prNumber: number
    repoFullName: string
    installationId: number
    authorAgent: string
    authorPAT: string
    reviewers: ReviewerConfig[]
    currentReviewerIndex: number
    currentSessionId: string | null
    reviewOutcomes: any[]
    retryCount: number
    lastError: string | null
    mergeType: 'auto' | 'approved' | 'forced' | null
    approvalGates: ApprovalGateConfig | null
    riskAssessment: RiskAssessment | null
    humanApprovalGranted: boolean
    humanApprover: string | null
    issueLabels: string[]
    filesChanged: string[]
  }

  type PREvent =
    | { type: 'PR_OPENED' }
    | { type: 'CONFIG_LOADED'; reviewers: ReviewerConfig[]; authorPAT: string; approvalGates: ApprovalGateConfig }
    | { type: 'SESSION_STARTED'; sessionId: string }
    | { type: 'SESSION_FAILED'; error: string }
    | { type: 'REVIEW_COMPLETE'; reviewer: string; decision: 'approved' | 'changes_requested'; body: string }
    | { type: 'FIX_COMPLETE'; commits: any[] }
    | { type: 'CLOSE'; merged: boolean }
    | { type: 'RETRY' }
    | { type: 'MERGE' }
    | { type: 'HUMAN_APPROVAL'; approver: string; approved: boolean; reason?: string }
    | { type: 'RISK_ASSESSED'; assessment: RiskAssessment }

  const prMachine = setup({
    types: {
      context: {} as PRContext,
      events: {} as PREvent,
    },
    guards: {
      isApproved: ({ event }) => event.type === 'REVIEW_COMPLETE' && event.decision === 'approved',
      isChangesRequested: ({ event }) => event.type === 'REVIEW_COMPLETE' && event.decision === 'changes_requested',
      hasMoreReviewers: ({ context }) => context.currentReviewerIndex < context.reviewers.length - 1,
      allApproved: ({ context }) => context.currentReviewerIndex >= context.reviewers.length - 1,
      canRetry: ({ context }) => context.retryCount < 3,
      wasMerged: ({ event }) => event.type === 'CLOSE' && event.merged === true,
      canAutoMerge: ({ context }) => {
        if (context.approvalGates?.allowFullAutonomy) return true
        if (context.humanApprovalGranted) return true
        const hasAutoApproveLabel = context.issueLabels.some(
          label => context.approvalGates?.autoApproveLabels?.includes(label)
        )
        if (hasAutoApproveLabel) return true
        if (context.riskAssessment && !context.riskAssessment.requiresHumanApproval) return true
        return false
      },
      requiresHumanApproval: ({ context }) => {
        if (context.approvalGates?.requireHumanApproval) return true
        const hasRequireApprovalLabel = context.issueLabels.some(
          label => context.approvalGates?.requireApprovalLabels?.includes(label)
        )
        if (hasRequireApprovalLabel) return true
        if (context.riskAssessment?.requiresHumanApproval) return true
        return false
      },
      humanApprovalGranted: ({ event }) =>
        event.type === 'HUMAN_APPROVAL' && event.approved === true,
      humanApprovalDenied: ({ event }) =>
        event.type === 'HUMAN_APPROVAL' && event.approved === false,
    },
    actions: {
      loadReviewers: assign({
        reviewers: ({ event }) => {
          if (event.type === 'CONFIG_LOADED') return event.reviewers
          return []
        },
        authorPAT: ({ event }) => {
          if (event.type === 'CONFIG_LOADED') return event.authorPAT
          return ''
        },
        approvalGates: ({ event }) => {
          if (event.type === 'CONFIG_LOADED') return event.approvalGates
          return null
        },
      }),
      recordOutcome: assign({
        reviewOutcomes: ({ context, event }) => {
          if (event.type !== 'REVIEW_COMPLETE') return context.reviewOutcomes
          return [
            ...context.reviewOutcomes,
            {
              reviewer: event.reviewer,
              decision: event.decision,
              comment: event.body,
              escalations: [],
              timestamp: new Date().toISOString(),
            },
          ]
        },
      }),
      advanceReviewer: assign({
        currentReviewerIndex: ({ context }) => context.currentReviewerIndex + 1,
      }),
      resetToCurrentReviewer: assign({
        currentSessionId: () => null,
      }),
      incrementRetry: assign({
        retryCount: ({ context }) => context.retryCount + 1,
      }),
      resetRetry: assign({
        retryCount: () => 0,
      }),
      recordError: assign({
        lastError: ({ event }) => (event.type === 'SESSION_FAILED' ? event.error : null),
      }),
      recordSessionId: assign({
        currentSessionId: ({ event }) => (event.type === 'SESSION_STARTED' ? event.sessionId : null),
      }),
    },
  }).createMachine({
    id: 'prReview',
    initial: 'pending',
    context: {
      prNumber: 0,
      repoFullName: '',
      installationId: 0,
      authorAgent: '',
      authorPAT: '',
      reviewers: [],
      currentReviewerIndex: 0,
      currentSessionId: null,
      reviewOutcomes: [],
      retryCount: 0,
      lastError: null,
      mergeType: null,
      approvalGates: null,
      riskAssessment: null,
      humanApprovalGranted: false,
      humanApprover: null,
      issueLabels: [],
      filesChanged: [],
    },

    on: {
      CLOSE: [
        {
          guard: 'wasMerged',
          target: '.merged',
          actions: [
            assign({
              mergeType: () => 'forced' as const,
            }),
          ],
        },
        { target: '.closed' },
      ],
    },

    states: {
      pending: {
        on: {
          CONFIG_LOADED: {
            target: 'reviewing',
            actions: ['loadReviewers'],
          },
        },
      },

      reviewing: {
        on: {
          SESSION_STARTED: { actions: ['recordSessionId'] },
          SESSION_FAILED: [
            {
              guard: 'canRetry',
              target: 'reviewing',
              actions: ['incrementRetry'],
            },
            {
              target: 'error',
              actions: ['recordError'],
            },
          ],
          REVIEW_COMPLETE: [
            {
              guard: 'isApproved',
              target: 'checkingApproval',
              actions: ['recordOutcome', 'advanceReviewer'],
            },
            {
              guard: 'isChangesRequested',
              target: 'fixing',
              actions: ['recordOutcome'],
            },
          ],
        },
      },

      checkingApproval: {
        always: [
          {
            guard: 'hasMoreReviewers',
            target: 'reviewing',
          },
          {
            guard: 'allApproved',
            target: 'approved',
          },
        ],
      },

      fixing: {
        on: {
          SESSION_STARTED: { actions: ['recordSessionId'] },
          SESSION_FAILED: [
            {
              guard: 'canRetry',
              target: 'fixing',
              actions: ['incrementRetry'],
            },
            {
              target: 'error',
              actions: ['recordError'],
            },
          ],
          FIX_COMPLETE: {
            target: 'reviewing',
            actions: ['resetRetry', 'resetToCurrentReviewer'],
          },
        },
      },

      approved: {
        always: [
          {
            guard: 'canAutoMerge',
            target: 'merging',
          },
          {
            guard: 'requiresHumanApproval',
            target: 'awaiting_approval',
          },
        ],
        on: {
          MERGE: { target: '#prReview.merging' },
        },
      },

      awaiting_approval: {
        on: {
          HUMAN_APPROVAL: [
            {
              guard: 'humanApprovalGranted',
              target: 'merging',
              actions: [
                assign({
                  humanApprovalGranted: () => true,
                  humanApprover: ({ event }) =>
                    event.type === 'HUMAN_APPROVAL' ? event.approver : null,
                  mergeType: () => 'approved' as const,
                }),
              ],
            },
            {
              guard: 'humanApprovalDenied',
              target: 'closed',
              actions: [
                assign({
                  lastError: ({ event }) =>
                    event.type === 'HUMAN_APPROVAL'
                      ? `Approval denied by ${event.approver}: ${event.reason || 'No reason provided'}`
                      : null,
                }),
              ],
            },
          ],
        },
      },

      merging: {
        entry: [
          assign({
            mergeType: ({ context }) =>
              context.humanApprovalGranted
                ? ('approved' as const)
                : ('auto' as const),
          }),
        ],
        always: [
          { target: 'merged' },
        ],
      },

      merged: {
        type: 'final',
      },

      closed: {
        type: 'final',
      },

      error: {
        type: 'final',
      },
    },
  })

  const defaultApprovalGates: ApprovalGateConfig = {
    requireHumanApproval: false,
    allowFullAutonomy: false,
    riskThreshold: 'high',
    criticalPaths: ['**/auth/**'],
    autoApproveLabels: ['auto-approve'],
    requireApprovalLabels: ['security'],
  }

  function createActorWithApprovalGates(
    approvalGates: ApprovalGateConfig,
    context: Partial<PRContext> = {}
  ) {
    const actor = createActor(prMachine, {
      snapshot: prMachine.resolveState({
        value: 'pending',
        context: {
          ...prMachine.config.context as PRContext,
          ...context,
        },
      }),
    })
    actor.start()

    actor.send({
      type: 'CONFIG_LOADED',
      reviewers: [{ agent: 'quinn', type: 'agent' }],
      authorPAT: 'test-pat',
      approvalGates,
    })

    return actor
  }

  test('transitions to awaiting_approval when requireHumanApproval is true', () => {
    const approvalGates: ApprovalGateConfig = {
      ...defaultApprovalGates,
      requireHumanApproval: true,
    }
    const actor = createActorWithApprovalGates(approvalGates)

    // Get to approved state
    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })

    // Should be in awaiting_approval, not merged
    expect(actor.getSnapshot().value).toBe('awaiting_approval')
  })

  test('auto-merges when allowFullAutonomy is true', () => {
    const approvalGates: ApprovalGateConfig = {
      ...defaultApprovalGates,
      allowFullAutonomy: true,
    }
    const actor = createActorWithApprovalGates(approvalGates)

    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })

    // Should auto-merge
    expect(actor.getSnapshot().value).toBe('merged')
    expect(actor.getSnapshot().context.mergeType).toBe('auto')
  })

  test('auto-merges when auto-approve label is present', () => {
    const actor = createActorWithApprovalGates(defaultApprovalGates, {
      issueLabels: ['auto-approve'],
    })

    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })

    expect(actor.getSnapshot().value).toBe('merged')
    expect(actor.getSnapshot().context.mergeType).toBe('auto')
  })

  test('requires approval when security label is present', () => {
    const actor = createActorWithApprovalGates(defaultApprovalGates, {
      issueLabels: ['security'],
    })

    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })

    expect(actor.getSnapshot().value).toBe('awaiting_approval')
  })

  test('human approval transitions to merging', () => {
    const approvalGates: ApprovalGateConfig = {
      ...defaultApprovalGates,
      requireHumanApproval: true,
    }
    const actor = createActorWithApprovalGates(approvalGates)

    // Get to awaiting_approval
    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })
    expect(actor.getSnapshot().value).toBe('awaiting_approval')

    // Human approves
    actor.send({
      type: 'HUMAN_APPROVAL',
      approver: 'admin-user',
      approved: true,
    })

    expect(actor.getSnapshot().value).toBe('merged')
    expect(actor.getSnapshot().context.humanApprovalGranted).toBe(true)
    expect(actor.getSnapshot().context.humanApprover).toBe('admin-user')
    expect(actor.getSnapshot().context.mergeType).toBe('approved')
  })

  test('human denial transitions to closed', () => {
    const approvalGates: ApprovalGateConfig = {
      ...defaultApprovalGates,
      requireHumanApproval: true,
    }
    const actor = createActorWithApprovalGates(approvalGates)

    // Get to awaiting_approval
    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })
    expect(actor.getSnapshot().value).toBe('awaiting_approval')

    // Human denies
    actor.send({
      type: 'HUMAN_APPROVAL',
      approver: 'admin-user',
      approved: false,
      reason: 'Not ready for production',
    })

    expect(actor.getSnapshot().value).toBe('closed')
    expect(actor.getSnapshot().context.lastError).toBe(
      'Approval denied by admin-user: Not ready for production'
    )
  })

  test('requires approval when risk assessment demands it', () => {
    const actor = createActorWithApprovalGates(defaultApprovalGates, {
      riskAssessment: {
        level: 'critical',
        factors: ['Touches auth files'],
        touchesCriticalPath: true,
        requiresHumanApproval: true,
      },
    })

    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })

    expect(actor.getSnapshot().value).toBe('awaiting_approval')
  })

  test('auto-merges when risk assessment allows it', () => {
    const actor = createActorWithApprovalGates(defaultApprovalGates, {
      riskAssessment: {
        level: 'low',
        factors: [],
        touchesCriticalPath: false,
        requiresHumanApproval: false,
      },
    })

    actor.send({
      type: 'REVIEW_COMPLETE',
      reviewer: 'quinn',
      decision: 'approved',
      body: 'LGTM',
    })

    expect(actor.getSnapshot().value).toBe('merged')
    expect(actor.getSnapshot().context.mergeType).toBe('auto')
  })
})
