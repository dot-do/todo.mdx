/**
 * todo.mdx - Bidirectional sync between TODO.mdx, .todo/*.md, GitHub Issues, and beads
 */

// Types
export type {
  Issue,
  Milestone,
  TodoConfig,
  ParsedTodoFile,
  FilePattern,
  SyncSource,
  SyncResult,
} from './types.js'

// Pattern parsing
export {
  parsePattern,
  extractFromFilename,
  slugify,
  DEFAULT_PATTERN,
} from './pattern.js'

// File parsing
export {
  parseTodoFile,
  extractTasks,
  calculateProgress,
} from './parser.js'

// Compilation
export {
  compile,
  generateTodoFiles,
  loadBeadsIssues,
} from './compiler.js'
