import { describe, it, expect } from 'vitest'
import { parseAgentsMdx, validateCapabilities, compileAgentsToJson } from './agents-parser'
import type { AgentRegistryEntry } from './types'

describe('parseAgentsMdx', () => {
  it('extracts agent configuration from MDX with Agent component', () => {
    const content = `---
name: cody
description: Development automation agent
---

# Cody Agent

<Agent
  name="cody"
  autonomy="full"
  model="opus"
  focus={['typescript', 'testing', 'deployment']}
  capabilities={[
    { name: 'git', operations: ['commit', 'push'] },
    { name: 'github', operations: ['*'] }
  ]}
  triggers={[
    { event: 'issue.ready' },
    { event: 'issue.closed' }
  ]}
  instructions="Focus on writing comprehensive tests and following TDD principles."
/>
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents).toHaveLength(1)

    const agent = result.agents[0]
    expect(agent.name).toBe('cody')
    expect(agent.autonomy).toBe('full')
    expect(agent.model).toBe('opus')
    expect(agent.focus).toEqual(['typescript', 'testing', 'deployment'])
    expect(agent.capabilities).toHaveLength(2)
    expect(agent.capabilities![0]).toEqual({ name: 'git', operations: ['commit', 'push'] })
    expect(agent.capabilities![1]).toEqual({ name: 'github', operations: ['*'] })
    expect(agent.triggers).toHaveLength(2)
    expect(agent.triggers![0]).toEqual({ event: 'issue.ready' })
    expect(agent.triggers![1]).toEqual({ event: 'issue.closed' })
    expect(agent.instructions).toBe('Focus on writing comprehensive tests and following TDD principles.')
  })

  it('handles agent that extends a cloud agent', () => {
    const content = `
<Agent
  name="custom-cody"
  extends="cloud:cody"
  autonomy="supervised"
  capabilities={[
    { name: 'slack', operations: ['notify'] }
  ]}
/>
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].name).toBe('custom-cody')
    expect(result.agents[0].extends).toBe('cloud:cody')
    expect(result.agents[0].autonomy).toBe('supervised')
    expect(result.agents[0].capabilities).toHaveLength(1)
  })

  it('extracts multiple agents from single file', () => {
    const content = `
<Agent name="agent-1" autonomy="full" />

Some documentation text...

<Agent name="agent-2" autonomy="manual" />
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents).toHaveLength(2)
    expect(result.agents[0].name).toBe('agent-1')
    expect(result.agents[1].name).toBe('agent-2')
  })

  it('handles minimal agent configuration', () => {
    const content = `<Agent name="minimal" />`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents).toHaveLength(1)
    expect(result.agents[0].name).toBe('minimal')
    expect(result.agents[0].autonomy).toBeUndefined()
    expect(result.agents[0].capabilities).toBeUndefined()
    expect(result.agents[0].triggers).toBeUndefined()
  })

  it('handles triggers with conditions and cron', () => {
    const content = `
<Agent
  name="scheduled"
  triggers={[
    { event: 'issue.ready', condition: 'priority >= 3' },
    { event: 'schedule', cron: '0 9 * * *' }
  ]}
/>
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents[0].triggers).toHaveLength(2)
    expect(result.agents[0].triggers![0]).toEqual({
      event: 'issue.ready',
      condition: 'priority >= 3',
    })
    expect(result.agents[0].triggers![1]).toEqual({
      event: 'schedule',
      cron: '0 9 * * *',
    })
  })

  it('extracts instructions from markdown content', () => {
    const content = `
<Agent name="documented" />

## Custom Instructions

These are the specific instructions for this agent.
It should follow these guidelines:
- Write tests first
- Use TypeScript strict mode
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents[0].name).toBe('documented')
    // Instructions extraction from markdown would be a more advanced feature
    // For now, we rely on explicit instructions prop
  })

  it('returns empty agents array when no Agent components found', () => {
    const content = `---
title: No Agents Here
---

# Just Documentation

This file has no agent definitions.
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.agents).toHaveLength(0)
  })

  it('preserves metadata from frontmatter', () => {
    const content = `---
version: 1.0
project: todo.mdx
defaultAgent: claude
---

<Agent name="claude" />
`

    const result = parseAgentsMdx(content, '/path/to/agents.mdx')

    expect(result.metadata).toEqual({
      version: '1.0',
      project: 'todo.mdx',
      defaultAgent: 'claude',
    })
  })
})

describe('validateCapabilities', () => {
  const knownTools = [
    'git',
    'github',
    'beads',
    'claude',
    'slack',
    'linear',
  ]

  it('validates all capabilities exist in known tools', () => {
    const agent: AgentRegistryEntry = {
      name: 'test',
      autonomy: 'full',
      capabilities: [
        { name: 'git', operations: ['commit'] },
        { name: 'github', operations: ['*'] },
      ],
    }

    const result = validateCapabilities(agent, knownTools)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('reports unknown capabilities', () => {
    const agent: AgentRegistryEntry = {
      name: 'test',
      autonomy: 'full',
      capabilities: [
        { name: 'git', operations: ['commit'] },
        { name: 'unknown-tool', operations: ['*'] },
        { name: 'another-unknown', operations: ['read'] },
      ],
    }

    const result = validateCapabilities(agent, knownTools)

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(2)
    expect(result.errors).toContain('Unknown capability: unknown-tool')
    expect(result.errors).toContain('Unknown capability: another-unknown')
  })

  it('returns valid when agent has no capabilities', () => {
    const agent: AgentRegistryEntry = {
      name: 'test',
      autonomy: 'manual',
    }

    const result = validateCapabilities(agent, knownTools)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('compileAgentsToJson', () => {
  it('compiles parsed agents to JSON format', () => {
    const content = `---
version: 1.0
project: test
---

<Agent
  name="test-agent"
  autonomy="full"
  capabilities={[
    { name: 'git', operations: ['commit', 'push'] }
  ]}
/>
`

    const parsed = parseAgentsMdx(content, '/path/to/agents.mdx')
    const json = compileAgentsToJson(parsed)

    // Should be valid JSON
    const compiled = JSON.parse(json)

    expect(compiled.metadata.version).toBe('1.0')
    expect(compiled.metadata.project).toBe('test')
    expect(compiled.agents).toHaveLength(1)
    expect(compiled.agents[0].name).toBe('test-agent')
    expect(compiled.agents[0].autonomy).toBe('full')
  })

  it('includes all agent properties in JSON output', () => {
    const content = `<Agent
  name="comprehensive"
  extends="cloud:base"
  autonomy="supervised"
  model="sonnet"
  focus={['testing', 'security']}
  capabilities={[{ name: 'git', operations: ['*'] }]}
  triggers={[{ event: 'issue.ready' }]}
  instructions="Be thorough and careful."
/>`

    const parsed = parseAgentsMdx(content, '/path/to/agents.mdx')
    const json = compileAgentsToJson(parsed)
    const compiled = JSON.parse(json)

    const agent = compiled.agents[0]
    expect(agent.name).toBe('comprehensive')
    expect(agent.extends).toBe('cloud:base')
    expect(agent.autonomy).toBe('supervised')
    expect(agent.model).toBe('sonnet')
    expect(agent.focus).toEqual(['testing', 'security'])
    expect(agent.capabilities).toHaveLength(1)
    expect(agent.triggers).toHaveLength(1)
    expect(agent.instructions).toBe('Be thorough and careful.')
  })
})
