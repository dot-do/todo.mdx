/**
 * todo.mdx
 *
 * Bi-directional sync between beads issue tracker and markdown files.
 */

// Types
export type {
  TodoConfig,
  ParsedTodoFile,
  TodoIssue,
  TemplateFrontmatter,
  CompileResult,
  SyncResult,
  SyncConflict,
  WatchEvent,
} from './types.js'

// Re-export beads-workflows types (renamed to avoid conflict with components)
export type {
  Issue as BeadsIssue,
  IssueStatus,
  IssueType,
  Priority,
} from 'beads-workflows'

// Beads integration
export { loadBeadsIssues, hasBeadsDirectory } from './beads.js'

// Parser
export { parseTodoFile, loadTodoFiles } from './parser.js'

// Generator
export { generateTodoFile, writeTodoFiles, DEFAULT_PATTERN } from './generator.js'
export type { GeneratorOptions } from './generator.js'

// Compiler
export { compile, compileToString } from './compiler.js'
export type { CompileOptions } from './compiler.js'

// Sync
export { sync, detectChanges } from './sync.js'
export type { SyncOptions } from './sync.js'

// Watcher
export { watch } from './watcher.js'
export type { WatchOptions, Watcher } from './watcher.js'

// Templates
export {
  render,
  renderTemplate,
  resolveTemplate,
  extractFromMarkdown,
  diff,
  applyExtract,
} from './templates.js'
export type {
  TemplateContext,
  TemplateConfig,
  ExtractResult,
  ExtractDiff,
  ComponentExtractor,
} from './templates.js'

// Components
export {
  Issues,
  Issue,
  IssueLabels,
  IssueDependencies,
  createIssueExtractors,
} from './components/issues.js'
export type {
  IssuesProps,
  IssueLabelsProps,
  IssueDependenciesProps,
} from './components/issues.js'
