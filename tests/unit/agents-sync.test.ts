/**
 * Unit tests for agent sync service
 */

import { describe, it, expect, vi } from 'vitest'
import {
  agentConfigToPayloadData,
  syncAgentsToCloud,
  mergeAgents,
  deleteRemovedAgents,
  type PayloadClient,
} from 'agents.mdx'
import type { AgentConfig } from 'agents.mdx'

describe('Agent Sync Service', () => {
  describe('agentConfigToPayloadData', () => {
    it('should convert agent config to payload data', () => {
      const config: AgentConfig = {
        name: 'Test Agent',
        description: 'A test agent',
        autonomy: 'supervised',
        model: 'sonnet',
        capabilities: [
          { name: 'git', operations: ['read'] },
          { name: 'github', operations: ['comment', 'review'] },
        ],
      }

      const result = agentConfigToPayloadData(config, 'repo-123')

      expect(result.agentId).toBe('test-agent')
      expect(result.name).toBe('Test Agent')
      expect(result.description).toBe('A test agent')
      expect(result.tier).toBe('worker')
      expect(result.framework).toBe('claude-agent-sdk')
      expect(result.model).toBe('sonnet')
      expect(result.repo).toBe('repo-123')
      expect(result.tools).toHaveLength(2)
      expect(result.tools[0].name).toBe('git')
    })

    it('should map full autonomy to sandbox tier', () => {
      const config: AgentConfig = {
        name: 'Autonomous Agent',
        autonomy: 'full',
      }

      const result = agentConfigToPayloadData(config)

      expect(result.tier).toBe('sandbox')
    })

    it('should map manual autonomy to light tier', () => {
      const config: AgentConfig = {
        name: 'Manual Agent',
        autonomy: 'manual',
      }

      const result = agentConfigToPayloadData(config)

      expect(result.tier).toBe('light')
    })

    it('should include org ID when provided', () => {
      const config: AgentConfig = {
        name: 'Org Agent',
      }

      const result = agentConfigToPayloadData(config, undefined, 'org-456')

      expect(result.org).toBe('org-456')
      expect(result.repo).toBeUndefined()
    })
  })

  describe('syncAgentsToCloud', () => {
    it('should create new agents', async () => {
      const agents: AgentConfig[] = [
        { name: 'Agent 1', description: 'First agent' },
        { name: 'Agent 2', description: 'Second agent' },
      ]

      const mockPayload: PayloadClient = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        create: vi.fn().mockResolvedValue({ id: 'new-id' }),
        update: vi.fn(),
        delete: vi.fn(),
      }

      const result = await syncAgentsToCloud(agents, mockPayload, 'repo-123')

      expect(result.created).toBe(2)
      expect(result.updated).toBe(0)
      expect(result.errors).toHaveLength(0)
      expect(mockPayload.create).toHaveBeenCalledTimes(2)
    })

    it('should update existing agents', async () => {
      const agents: AgentConfig[] = [
        { name: 'Existing Agent', description: 'Updated description' },
      ]

      const mockPayload: PayloadClient = {
        find: vi.fn().mockResolvedValue({
          docs: [{ id: 'existing-id', agentId: 'existing-agent' }],
        }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'existing-id' }),
        delete: vi.fn(),
      }

      const result = await syncAgentsToCloud(agents, mockPayload, 'repo-123')

      expect(result.created).toBe(0)
      expect(result.updated).toBe(1)
      expect(result.errors).toHaveLength(0)
      expect(mockPayload.update).toHaveBeenCalledTimes(1)
    })

    it('should handle errors gracefully', async () => {
      const agents: AgentConfig[] = [
        { name: 'Good Agent' },
        { name: 'Bad Agent' },
      ]

      const mockPayload: PayloadClient = {
        find: vi.fn().mockResolvedValue({ docs: [] }),
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'good-id' })
          .mockRejectedValueOnce(new Error('Creation failed')),
        update: vi.fn(),
        delete: vi.fn(),
      }

      const result = await syncAgentsToCloud(agents, mockPayload, 'repo-123')

      expect(result.created).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Bad Agent')
      expect(result.errors[0]).toContain('Creation failed')
    })
  })

  describe('mergeAgents', () => {
    it('should merge global and repo agents', () => {
      const globalAgents: AgentConfig[] = [
        { name: 'Global Agent 1', description: 'Global' },
        { name: 'Global Agent 2', description: 'Global' },
      ]

      const repoAgents: AgentConfig[] = [
        { name: 'Repo Agent 1', description: 'Repo' },
      ]

      const result = mergeAgents(repoAgents, globalAgents)

      expect(result).toHaveLength(3)
      const names = result.map(a => a.name)
      expect(names).toContain('Global Agent 1')
      expect(names).toContain('Global Agent 2')
      expect(names).toContain('Repo Agent 1')
    })

    it('should override global agents with repo agents of same name', () => {
      const globalAgents: AgentConfig[] = [
        { name: 'Shared Agent', description: 'Global version' },
      ]

      const repoAgents: AgentConfig[] = [
        { name: 'Shared Agent', description: 'Repo override' },
      ]

      const result = mergeAgents(repoAgents, globalAgents)

      expect(result).toHaveLength(1)
      expect(result[0].description).toBe('Repo override')
    })

    it('should handle empty arrays', () => {
      const result1 = mergeAgents([], [])
      expect(result1).toHaveLength(0)

      const globalAgents: AgentConfig[] = [{ name: 'Global' }]
      const result2 = mergeAgents([], globalAgents)
      expect(result2).toHaveLength(1)

      const repoAgents: AgentConfig[] = [{ name: 'Repo' }]
      const result3 = mergeAgents(repoAgents, [])
      expect(result3).toHaveLength(1)
    })
  })

  describe('deleteRemovedAgents', () => {
    it('should delete agents not in current list', async () => {
      const currentAgentIds = ['agent-1', 'agent-2']

      const mockPayload: PayloadClient = {
        find: vi.fn().mockResolvedValue({
          docs: [
            { id: 'id-1', agentId: 'agent-1' },
            { id: 'id-2', agentId: 'agent-2' },
            { id: 'id-3', agentId: 'agent-3' }, // Should be deleted
            { id: 'id-4', agentId: 'agent-4' }, // Should be deleted
          ],
        }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
      }

      const result = await deleteRemovedAgents(currentAgentIds, mockPayload, 'repo-123')

      expect(result).toBe(2)
      expect(mockPayload.delete).toHaveBeenCalledTimes(2)
      expect(mockPayload.delete).toHaveBeenCalledWith({
        collection: 'agents',
        id: 'id-3',
        overrideAccess: true,
      })
      expect(mockPayload.delete).toHaveBeenCalledWith({
        collection: 'agents',
        id: 'id-4',
        overrideAccess: true,
      })
    })

    it('should not delete any agents if all are current', async () => {
      const currentAgentIds = ['agent-1', 'agent-2']

      const mockPayload: PayloadClient = {
        find: vi.fn().mockResolvedValue({
          docs: [
            { id: 'id-1', agentId: 'agent-1' },
            { id: 'id-2', agentId: 'agent-2' },
          ],
        }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }

      const result = await deleteRemovedAgents(currentAgentIds, mockPayload, 'repo-123')

      expect(result).toBe(0)
      expect(mockPayload.delete).not.toHaveBeenCalled()
    })
  })
})
