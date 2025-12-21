/**
 * Core types for cli.mdx
 */

import type { ReactNode } from 'react'

/** Configuration for CLI.mdx compilation */
export interface CliConfig {
  /** Input MDX file path */
  input?: string
  /** Output markdown file path */
  output?: string
  /** Render mode: terminal, markdown, or both */
  mode?: 'terminal' | 'markdown' | 'dual'
  /** Enable beads integration */
  beads?: boolean
  /** Custom component registry */
  components?: Record<string, React.ComponentType<any>>
}

/** Issue from beads or GitHub */
export interface Issue {
  id: string
  githubId?: number
  githubNumber?: number
  beadsId?: string
  title: string
  body?: string
  state: 'open' | 'in_progress' | 'blocked' | 'closed'
  labels?: string[]
  assignees?: string[]
  priority?: number
  type?: 'task' | 'bug' | 'feature' | 'epic' | 'chore'
  milestone?: string
  createdAt: string
  updatedAt: string
  dependencies?: string[]
  blockedBy?: string[]
}

/** Milestone/Epic from beads or GitHub */
export interface Milestone {
  id: string
  githubId?: number
  githubNumber?: number
  beadsId?: string
  title: string
  description?: string
  state: 'open' | 'closed'
  dueOn?: string
  progress?: {
    total: number
    open: number
    in_progress: number
    blocked: number
    closed: number
    percent: number
  }
  createdAt: string
  updatedAt: string
}

/** Command definition */
export interface Command {
  name: string
  description?: string
  aliases?: string[]
  options?: CommandOption[]
  action?: (args: any) => void | Promise<void>
}

/** Command option */
export interface CommandOption {
  name: string
  alias?: string
  description?: string
  type?: 'string' | 'boolean' | 'number'
  required?: boolean
  default?: any
}

/** Stats about issues */
export interface Stats {
  total: number
  open: number
  in_progress: number
  blocked: number
  closed: number
  percent: number
  avgLeadTime?: number
}

/** Render context passed to components */
export interface RenderContext {
  mode: 'terminal' | 'markdown'
  issues: Issue[]
  milestones: Milestone[]
  stats: Stats
  config: CliConfig
}

/** Terminal output node */
export interface TerminalNode {
  type: 'text' | 'box' | 'list' | 'table' | 'newline'
  content?: string
  children?: TerminalNode[]
  style?: TerminalStyle
}

/** Terminal styling */
export interface TerminalStyle {
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'
  bg?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
  bold?: boolean
  italic?: boolean
  underline?: boolean
  dim?: boolean
}

/** Component props */
export interface ComponentProps {
  children?: ReactNode
}

/** Issues component props */
export interface IssuesProps extends ComponentProps {
  limit?: number
  status?: 'open' | 'in_progress' | 'blocked' | 'closed'
  priority?: number
  type?: Issue['type']
  labels?: string[]
}

/** Roadmap component props */
export interface RoadmapProps extends ComponentProps {
  limit?: number
  showProgress?: boolean
  showDates?: boolean
}

/** Command component props */
export interface CommandProps extends ComponentProps {
  name: string
  description?: string
  aliases?: string[]
}

/** Agent component props */
export interface AgentProps extends ComponentProps {
  rules?: string[]
  context?: Record<string, any>
}

/** Stats component props */
export interface StatsProps extends ComponentProps {
  showLeadTime?: boolean
}

/** Argument component props */
export interface ArgumentProps extends ComponentProps {
  name: string
  description?: string
  required?: boolean
  default?: any
  choices?: string[]
}

/** Flag component props */
export interface FlagProps extends ComponentProps {
  name: string
  alias?: string
  type?: 'string' | 'number' | 'boolean'
  description?: string
  required?: boolean
  default?: any
}

/** Subcommand component props */
export interface SubcommandProps extends ComponentProps {
  name: string
  description?: string
  aliases?: string[]
}

/** Parsed command structure from MDX */
export interface ParsedCommand {
  name: string
  description?: string
  aliases?: string[]
  arguments?: ParsedArgument[]
  flags?: ParsedFlag[]
  subcommands?: ParsedCommand[]
  action?: (args: any, options: any) => void | Promise<void>
}

/** Parsed argument from MDX */
export interface ParsedArgument {
  name: string
  description?: string
  required?: boolean
  default?: any
  choices?: string[]
}

/** Parsed flag from MDX */
export interface ParsedFlag {
  name: string
  alias?: string
  type?: 'string' | 'number' | 'boolean'
  description?: string
  required?: boolean
  default?: any
}
