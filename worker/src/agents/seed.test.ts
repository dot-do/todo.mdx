import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  agentDefToPayload,
  seedBuiltinAgents,
  getGlobalAgents,
  isSeeded,
  type PayloadClient,
} from './seed'
import { builtinAgents, type AgentDef } from './builtin'

/**
 * Create a mock Payload client
 */
function createMockPayload(): PayloadClient & {
  docs: Map<string, any>
  _nextId: number
} {
  const docs = new Map<string, any>()
  let nextId = 1

  return {
    docs,
    _nextId: nextId,
    find: vi.fn(async ({ collection, where, limit }) => {
      const allDocs = Array.from(docs.values()).filter(
        (doc) => doc._collection === collection
      )

      // Simple where clause matching
      let filtered = allDocs
      if (where?.and) {
        for (const condition of where.and) {
          const key = Object.keys(condition)[0]
          const op = condition[key]

          if (op.equals !== undefined) {
            filtered = filtered.filter((doc) => doc[key] === op.equals)
          } else if (op.exists === false) {
            filtered = filtered.filter(
              (doc) => doc[key] === undefined || doc[key] === null
            )
          }
        }
      }

      return { docs: filtered.slice(0, limit || 100) }
    }),
    create: vi.fn(async ({ collection, data }) => {
      const id = String(nextId++)
      const doc = { id, _collection: collection, ...data }
      docs.set(id, doc)
      return doc
    }),
    update: vi.fn(async ({ collection, id, data }) => {
      const existing = docs.get(id)
      if (!existing) throw new Error('Document not found')
      const updated = { ...existing, ...data }
      docs.set(id, updated)
      return updated
    }),
  }
}

describe('agentDefToPayload', () => {
  it('should convert agent definition to Payload format', () => {
    const agent: AgentDef = {
      id: 'cody',
      name: 'Coder Cody',
      description: 'General-purpose development agent',
      tools: ['github.*', 'linear.*', 'slack.*'],
      tier: 'worker',
      model: 'overall',
      framework: 'ai-sdk',
      instructions: 'You are Coder Cody...',
    }

    const result = agentDefToPayload(agent)

    expect(result.agentId).toBe('cody')
    expect(result.name).toBe('Coder Cody')
    expect(result.description).toBe('General-purpose development agent')
    expect(result.tier).toBe('worker')
    expect(result.model).toBe('claude-sonnet-4-5')
    expect(result.framework).toBe('ai-sdk')
    expect(result.instructions).toBe('You are Coder Cody...')
    expect(result.maxSteps).toBe(10)
    expect(result.timeout).toBe(300000)
    // Should not have repo or org (global agent)
    expect(result.repo).toBeUndefined()
    expect(result.org).toBeUndefined()
  })

  it('should map model names correctly', () => {
    const testCases: Array<{ model: string; expected: string }> = [
      { model: 'best', expected: 'claude-opus-4-5' },
      { model: 'fast', expected: 'claude-haiku-3-5' },
      { model: 'cheap', expected: 'claude-haiku-3-5' },
      { model: 'overall', expected: 'claude-sonnet-4-5' },
      { model: 'claude-3-5-sonnet-20241022', expected: 'claude-3-5-sonnet-20241022' },
    ]

    for (const { model, expected } of testCases) {
      const agent: AgentDef = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        tools: [],
        tier: 'light',
        model,
        framework: 'ai-sdk',
      }
      const result = agentDefToPayload(agent)
      expect(result.model).toBe(expected)
    }
  })

  it('should convert tools to capabilities format', () => {
    const agent: AgentDef = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      tools: ['github.*', 'linear.create', '*'],
      tier: 'light',
      model: 'fast',
      framework: 'ai-sdk',
    }

    const result = agentDefToPayload(agent)

    expect(result.tools).toEqual([
      { name: 'github', operations: ['*'] },
      { name: 'linear', operations: ['create'] },
      { name: 'all', operations: ['*'] },
    ])
  })

  it('should use custom maxSteps and timeout if provided', () => {
    const agent: AgentDef = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      tools: [],
      tier: 'light',
      model: 'fast',
      framework: 'ai-sdk',
      maxSteps: 25,
      timeout: 600000,
    }

    const result = agentDefToPayload(agent)

    expect(result.maxSteps).toBe(25)
    expect(result.timeout).toBe(600000)
  })
})

describe('seedBuiltinAgents', () => {
  let payload: ReturnType<typeof createMockPayload>

  beforeEach(() => {
    payload = createMockPayload()
  })

  it('should create all builtin agents when database is empty', async () => {
    const result = await seedBuiltinAgents(payload)

    expect(result.created).toBe(builtinAgents.length)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)

    // Verify agents were created
    expect(payload.create).toHaveBeenCalledTimes(builtinAgents.length)
  })

  it('should skip existing agents when force is false', async () => {
    // Seed once
    await seedBuiltinAgents(payload)

    // Reset mock call counts
    vi.mocked(payload.create).mockClear()
    vi.mocked(payload.update).mockClear()

    // Seed again without force
    const result = await seedBuiltinAgents(payload, false)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(builtinAgents.length)
    expect(result.errors).toHaveLength(0)

    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('should update existing agents when force is true', async () => {
    // Seed once
    await seedBuiltinAgents(payload)

    // Reset mock call counts
    vi.mocked(payload.create).mockClear()
    vi.mocked(payload.update).mockClear()

    // Seed again with force
    const result = await seedBuiltinAgents(payload, true)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(builtinAgents.length)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)

    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledTimes(builtinAgents.length)
  })

  it('should handle errors gracefully', async () => {
    // Make create fail for one agent
    let callCount = 0
    vi.mocked(payload.create).mockImplementation(async ({ data }) => {
      callCount++
      if (data.agentId === 'cody') {
        throw new Error('Database error')
      }
      const id = String(callCount)
      payload.docs.set(id, { id, _collection: 'agents', ...data })
      return { id, ...data }
    })

    const result = await seedBuiltinAgents(payload)

    // Should have one error for cody
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('cody')
    expect(result.errors[0]).toContain('Database error')

    // Should have created all others
    expect(result.created).toBe(builtinAgents.length - 1)
  })
})

describe('getGlobalAgents', () => {
  let payload: ReturnType<typeof createMockPayload>

  beforeEach(() => {
    payload = createMockPayload()
  })

  it('should return all global agents', async () => {
    // Seed agents first
    await seedBuiltinAgents(payload)

    const agents = await getGlobalAgents(payload)

    expect(agents).toHaveLength(builtinAgents.length)
    expect(agents.every((a) => a.repo === undefined || a.repo === null)).toBe(true)
    expect(agents.every((a) => a.org === undefined || a.org === null)).toBe(true)
  })

  it('should return empty array when no global agents exist', async () => {
    const agents = await getGlobalAgents(payload)
    expect(agents).toHaveLength(0)
  })
})

describe('isSeeded', () => {
  let payload: ReturnType<typeof createMockPayload>

  beforeEach(() => {
    payload = createMockPayload()
  })

  it('should return false when no agents are seeded', async () => {
    const seeded = await isSeeded(payload)
    expect(seeded).toBe(false)
  })

  it('should return true when all agents are seeded', async () => {
    await seedBuiltinAgents(payload)
    const seeded = await isSeeded(payload)
    expect(seeded).toBe(true)
  })

  it('should return false when only some agents are seeded', async () => {
    // Manually add only one agent
    await payload.create({
      collection: 'agents',
      data: agentDefToPayload(builtinAgents[0]),
    })

    const seeded = await isSeeded(payload)
    expect(seeded).toBe(false)
  })
})

describe('builtin agents data integrity', () => {
  it('should have all required agent personas', () => {
    const requiredIds = [
      'priya',
      'reed',
      'benny',
      'cody',
      'dana',
      'dana-docs',
      'tom',
      'sam',
      'quinn',
      'fiona',
    ]

    const actualIds = builtinAgents.map((a) => a.id)

    for (const id of requiredIds) {
      expect(actualIds).toContain(id)
    }
  })

  it('should have valid tier values for all agents', () => {
    const validTiers = ['light', 'worker', 'sandbox']

    for (const agent of builtinAgents) {
      expect(validTiers).toContain(agent.tier)
    }
  })

  it('should have valid framework values for all agents', () => {
    const validFrameworks = ['ai-sdk', 'claude-agent-sdk', 'openai-agents', 'claude-code']

    for (const agent of builtinAgents) {
      expect(validFrameworks).toContain(agent.framework)
    }
  })

  it('should have descriptions for all agents', () => {
    for (const agent of builtinAgents) {
      expect(agent.description).toBeTruthy()
      expect(agent.description.length).toBeGreaterThan(10)
    }
  })
})
