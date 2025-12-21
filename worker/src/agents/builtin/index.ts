import { AgentDef } from '../base'

/**
 * Built-in agent roster for the todo.mdx agent system
 * These are pre-configured agents with specific capabilities, models, and tools
 */

export const builtinAgents: AgentDef[] = [
  // Product Priya - TODO and project tracking
  {
    id: 'priya',
    name: 'Product Priya',
    description: 'Manages TODOs and project tracking',
    tools: ['todo.mdx.*'],
    tier: 'light',
    model: 'fast',
    framework: 'ai-sdk',
    instructions:
      'You are a product manager. Create, update, and organize TODOs. Help teams stay aligned on priorities and progress.',
  },

  // Research Reed - Web and internal search
  {
    id: 'reed',
    name: 'Research Reed',
    description: 'Searches web and internal docs',
    tools: ['search.web', 'search.internal'],
    tier: 'light',
    model: 'fast',
    framework: 'ai-sdk',
    instructions:
      'You are a research assistant. Find and summarize information from web searches and internal documentation. Provide accurate citations.',
  },

  // Browser Benny - Browser automation
  {
    id: 'benny',
    name: 'Browser Benny',
    description: 'Automates browser tasks via Stagehand',
    tools: ['stagehand.*', 'browserbase.*'],
    tier: 'light',
    model: 'overall',
    framework: 'ai-sdk',
    instructions:
      'You automate browser tasks. Navigate pages, fill forms, extract data, and interact with web applications with precision.',
  },

  // Developer Dana - Code and PRs
  {
    id: 'dana',
    name: 'Developer Dana',
    description: 'Writes code, creates PRs',
    tools: ['github.*', 'code.*', 'file.*'],
    tier: 'worker',
    model: 'overall',
    framework: 'ai-sdk',
    instructions:
      'You are a developer. Write clean, well-tested code. Create branches, commit changes, and open pull requests for review.',
  },

  // Full-Stack Fiona - Complex development
  {
    id: 'fiona',
    name: 'Full-Stack Fiona',
    description: 'Complex multi-file development with full sandbox',
    tools: ['*'],
    tier: 'sandbox',
    model: 'best',
    framework: 'claude-code',
    instructions:
      'You are a senior full-stack engineer. Handle complex tasks requiring deep codebase understanding. Design systems, refactor code, and implement features end-to-end.',
  },
]

/**
 * Get a built-in agent by ID
 * @param id - The agent ID
 * @returns The agent definition, or undefined if not found
 */
export function getBuiltinAgent(id: string): AgentDef | undefined {
  return builtinAgents.find((agent) => agent.id === id)
}

/**
 * Get all built-in agent IDs
 * @returns Array of agent IDs
 */
export function getBuiltinAgentIds(): string[] {
  return builtinAgents.map((agent) => agent.id)
}
