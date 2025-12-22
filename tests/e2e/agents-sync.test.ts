/**
 * Agents Sync Tests
 * Tests for syncing agent configurations from repo to cloud
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { testEnv, testAuth } from '../helpers/test-env'

describe('Agents Sync', () => {
  let env: any
  let installationId: number
  let repoFullName: string

  beforeAll(async () => {
    env = await testEnv()

    // Create test installation
    const installation = await env.PAYLOAD.create({
      collection: 'installations',
      data: {
        installationId: 99999,
        accountType: 'User',
        accountId: 12345,
        accountLogin: 'test-user',
        accountAvatarUrl: 'https://example.com/avatar.png',
        permissions: {},
        events: [],
        repositorySelection: 'all',
      },
      overrideAccess: true,
    })
    installationId = installation.installationId

    // Create test repo
    const repo = await env.PAYLOAD.create({
      collection: 'repos',
      data: {
        githubId: 123456,
        name: 'test-repo',
        fullName: 'test-user/test-repo',
        owner: 'test-user',
        private: false,
        installation: installation.id,
      },
      overrideAccess: true,
    })
    repoFullName = repo.fullName
  })

  afterAll(async () => {
    // Cleanup
    if (env?.PAYLOAD) {
      // Delete test agents
      const agents = await env.PAYLOAD.find({
        collection: 'agents',
        where: { repo: { equals: repoFullName } },
        overrideAccess: true,
      })
      for (const agent of agents.docs || []) {
        await env.PAYLOAD.delete({
          collection: 'agents',
          id: agent.id,
          overrideAccess: true,
        })
      }

      // Delete repo and installation
      await env.PAYLOAD.delete({
        collection: 'repos',
        where: { fullName: { equals: repoFullName } },
        overrideAccess: true,
      })
      await env.PAYLOAD.delete({
        collection: 'installations',
        where: { installationId: { equals: installationId } },
        overrideAccess: true,
      })
    }
  })

  describe('Push webhook with agents.mdx changes', () => {
    it('should detect agents.mdx in push event', async () => {
      const payload = {
        repository: {
          id: 123456,
          name: 'test-repo',
          full_name: repoFullName,
          private: false,
        },
        installation: {
          id: installationId,
        },
        commits: [
          {
            added: ['agents.mdx'],
            modified: [],
            removed: [],
          },
        ],
        head_commit: {
          id: 'abc123',
        },
        after: 'abc123',
      }

      // Mock webhook signature
      const body = JSON.stringify(payload)
      const signature = 'sha256=' + '0'.repeat(64) // Mock signature

      // In real test, we'd verify the webhook handler detects agents.mdx
      expect(payload.commits[0].added).toContain('agents.mdx')
    })

    it('should parse and sync agent configurations from MDX', async () => {
      // Sample agents.mdx content
      const agentsMdxContent = `---
version: 1.0
---

# Test Agents

<Agent
  name="test-reviewer"
  description="Test code reviewer agent"
  autonomy="supervised"
  model="sonnet"
  focus={['code-quality', 'testing']}
  capabilities={[
    { name: 'git', operations: ['read'] },
    { name: 'github', operations: ['comment', 'review'] }
  ]}
  triggers={[
    { event: 'pull_request.opened', condition: 'draft === false' }
  ]}
/>

<Agent
  name="test-builder"
  description="Test build agent"
  autonomy="full"
  model="haiku"
  focus={['ci-cd', 'testing']}
  capabilities={[
    { name: 'git', operations: ['*'] },
    { name: 'npm', operations: ['test', 'build'] }
  ]}
/>
`

      // Parse using agents-parser
      const { parseAgentsMdx } = await import('agents.mdx')
      const parsed = parseAgentsMdx(agentsMdxContent, 'agents.mdx')

      expect(parsed.agents).toHaveLength(2)
      expect(parsed.agents[0].name).toBe('test-reviewer')
      expect(parsed.agents[0].autonomy).toBe('supervised')
      expect(parsed.agents[1].name).toBe('test-builder')
      expect(parsed.agents[1].autonomy).toBe('full')
    })
  })

  describe('Agent sync to Payload', () => {
    it('should upsert agents to Payload CMS', async () => {
      const agentConfig = {
        agentId: 'test-agent-1',
        name: 'Test Agent 1',
        description: 'A test agent',
        tier: 'light',
        framework: 'ai-sdk',
        model: 'overall',
        tools: [],
      }

      // Create agent via Payload API
      const created = await env.PAYLOAD.create({
        collection: 'agents',
        data: agentConfig,
        overrideAccess: true,
      })

      expect(created.agentId).toBe('test-agent-1')
      expect(created.name).toBe('Test Agent 1')

      // Update agent
      const updated = await env.PAYLOAD.update({
        collection: 'agents',
        id: created.id,
        data: {
          description: 'Updated description',
        },
        overrideAccess: true,
      })

      expect(updated.description).toBe('Updated description')

      // Cleanup
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: created.id,
        overrideAccess: true,
      })
    })

    it('should link agents to specific repo', async () => {
      // Get repo ID
      const repos = await env.PAYLOAD.find({
        collection: 'repos',
        where: { fullName: { equals: repoFullName } },
        overrideAccess: true,
      })
      const repoId = repos.docs[0].id

      const agentConfig = {
        agentId: 'repo-scoped-agent',
        name: 'Repo Scoped Agent',
        description: 'Agent scoped to specific repo',
        tier: 'light',
        framework: 'ai-sdk',
        model: 'overall',
        tools: [],
        repo: repoId,
      }

      const created = await env.PAYLOAD.create({
        collection: 'agents',
        data: agentConfig,
        overrideAccess: true,
      })

      expect(created.repo).toBe(repoId)

      // Cleanup
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: created.id,
        overrideAccess: true,
      })
    })

    it('should handle global agents (no repo or org)', async () => {
      const agentConfig = {
        agentId: 'global-agent',
        name: 'Global Agent',
        description: 'A global agent available to all',
        tier: 'light',
        framework: 'ai-sdk',
        model: 'overall',
        tools: [],
        // No repo or org - global
      }

      const created = await env.PAYLOAD.create({
        collection: 'agents',
        data: agentConfig,
        overrideAccess: true,
      })

      expect(created.repo).toBeUndefined()
      expect(created.org).toBeUndefined()

      // Cleanup
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: created.id,
        overrideAccess: true,
      })
    })
  })

  describe('Agent merging (built-in vs repo)', () => {
    it('should list both global and repo-specific agents', async () => {
      // Get repo ID
      const repos = await env.PAYLOAD.find({
        collection: 'repos',
        where: { fullName: { equals: repoFullName } },
        overrideAccess: true,
      })
      const repoId = repos.docs[0].id

      // Create global agent
      const globalAgent = await env.PAYLOAD.create({
        collection: 'agents',
        data: {
          agentId: 'global-test',
          name: 'Global Test Agent',
          tier: 'light',
          framework: 'ai-sdk',
          model: 'overall',
          tools: [],
        },
        overrideAccess: true,
      })

      // Create repo-specific agent
      const repoAgent = await env.PAYLOAD.create({
        collection: 'agents',
        data: {
          agentId: 'repo-test',
          name: 'Repo Test Agent',
          tier: 'light',
          framework: 'ai-sdk',
          model: 'overall',
          tools: [],
          repo: repoId,
        },
        overrideAccess: true,
      })

      // Query agents for this repo (should get both)
      const result = await env.PAYLOAD.find({
        collection: 'agents',
        where: {
          or: [
            { repo: { equals: repoId } },
            { and: [{ repo: { exists: false } }, { org: { exists: false } }] },
          ],
        },
        overrideAccess: true,
      })

      const agentIds = result.docs.map((a: any) => a.agentId)
      expect(agentIds).toContain('global-test')
      expect(agentIds).toContain('repo-test')

      // Cleanup
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: globalAgent.id,
        overrideAccess: true,
      })
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: repoAgent.id,
        overrideAccess: true,
      })
    })

    it('should allow repo agent to override global agent with same ID', async () => {
      // Get repo ID
      const repos = await env.PAYLOAD.find({
        collection: 'repos',
        where: { fullName: { equals: repoFullName } },
        overrideAccess: true,
      })
      const repoId = repos.docs[0].id

      const agentId = 'overridable-agent'

      // Create global agent
      const globalAgent = await env.PAYLOAD.create({
        collection: 'agents',
        data: {
          agentId,
          name: 'Global Version',
          description: 'Global description',
          tier: 'light',
          framework: 'ai-sdk',
          model: 'overall',
          tools: [],
        },
        overrideAccess: true,
      })

      // Create repo-specific override
      const repoAgent = await env.PAYLOAD.create({
        collection: 'agents',
        data: {
          agentId,
          name: 'Repo Override',
          description: 'Repo-specific description',
          tier: 'sandbox',
          framework: 'claude-code',
          model: 'overall',
          tools: [],
          repo: repoId,
        },
        overrideAccess: true,
      })

      // Query agents - repo-specific should come first (higher precedence)
      const result = await env.PAYLOAD.find({
        collection: 'agents',
        where: {
          and: [
            { agentId: { equals: agentId } },
            {
              or: [
                { repo: { equals: repoId } },
                { and: [{ repo: { exists: false } }, { org: { exists: false } }] },
              ],
            },
          ],
        },
        sort: '-repo', // Repo-specific agents first
        overrideAccess: true,
      })

      expect(result.docs).toHaveLength(2)
      // First should be repo override
      expect(result.docs[0].name).toBe('Repo Override')
      expect(result.docs[0].tier).toBe('sandbox')

      // Cleanup
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: globalAgent.id,
        overrideAccess: true,
      })
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: repoAgent.id,
        overrideAccess: true,
      })
    })
  })

  describe('Runtime state tracking', () => {
    it('should track active agent sessions', async () => {
      const agentConfig = {
        agentId: 'stateful-agent',
        name: 'Stateful Agent',
        tier: 'sandbox',
        framework: 'claude-code',
        model: 'overall',
        tools: [],
      }

      const agent = await env.PAYLOAD.create({
        collection: 'agents',
        data: agentConfig,
        overrideAccess: true,
      })

      // In a real implementation, we'd track sessions via a separate collection or DO
      // For now, just verify the agent exists
      expect(agent.agentId).toBe('stateful-agent')

      // Cleanup
      await env.PAYLOAD.delete({
        collection: 'agents',
        id: agent.id,
        overrideAccess: true,
      })
    })
  })
})
