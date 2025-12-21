/**
 * cli.mdx - MDX-based CLI framework for Bun with dual rendering
 *
 * Define CLIs in MDX, render to terminal AND markdown.
 * Live data injection from beads, GitHub, APIs.
 */

// Types
export type {
  CliConfig,
  Issue,
  Milestone,
  Command as CommandType,
  CommandOption,
  Stats as StatsType,
  RenderContext,
  TerminalNode,
  TerminalStyle,
  ComponentProps,
  IssuesProps,
  RoadmapProps,
  CommandProps,
  ArgumentProps,
  FlagProps,
  SubcommandProps,
  AgentProps,
  StatsProps,
  ParsedCommand,
  ParsedArgument,
  ParsedFlag,
} from './types.js'

// Compiler
export {
  compile,
  renderCli,
  renderMarkdown,
  renderDual,
  parseMdxCommands,
  buildCommanderProgram,
  compileToCli,
  executeCli,
} from './compiler.js'

// Renderer
export {
  renderToTerminal,
  renderToMarkdown,
  Box,
  Text,
  Newline,
  stripAnsiCodes,
} from './renderer.js'

// Components
export {
  Issues,
  Roadmap,
  Stats,
  Command,
  Argument,
  Flag,
  Subcommand,
  Agent,
  setComponentData,
  getComponentData,
} from './components.js'

// Data loader
export {
  loadBeadsIssues,
  loadBeadsMilestones,
  calculateStats,
  loadAllData,
} from './loader.js'

// Default export for convenience
export { compile as default } from './simple-compiler.js'
