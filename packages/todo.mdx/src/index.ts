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
  loadGitHubIssues,
} from './compiler.js'

// API Client
export {
  TodoApiClient,
  loadApiIssues,
  type ApiClientConfig,
  type IssueFilter,
} from './api-client.js'

// Watcher
export {
  watch,
} from './watcher.js'
export type {
  WatchOptions,
  WatchEvent,
} from './watcher.js'

// Error types
export {
  TodoMdxError,
  CompilationError,
  ParserError,
  ValidationError,
  ApiError,
  ConfigurationError,
  FileSystemError,
  AuthenticationError,
  ProcessError,
  GitHubError,
  getErrorMessage,
  getNodeErrorContext,
  isTodoMdxError,
  isErrorType,
} from './errors.js'
