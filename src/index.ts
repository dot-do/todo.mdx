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

// Re-export beads-workflows types
export type { Issue, IssueStatus, IssueType, Priority } from 'beads-workflows'

// Beads integration
export { loadBeadsIssues, hasBeadsDirectory } from './beads.js'

// Parser
export { parseTodoFile, loadTodoFiles } from './parser.js'

// Generator
export { generateTodoFile, writeTodoFiles } from './generator.js'

// Compiler
export { compile, compileToString } from './compiler.js'
export type { CompileOptions } from './compiler.js'

// Sync
export { sync, detectChanges } from './sync.js'
export type { SyncOptions } from './sync.js'

// Watcher
export { watch } from './watcher.js'
export type { WatchOptions, Watcher } from './watcher.js'
