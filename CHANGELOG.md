# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-23

### Added

#### Core Features
- **Bi-directional sync** between beads issue tracker (`.beads/issues.jsonl`) and markdown files (`.todo/*.md`)
- **Conflict resolution strategies**: `beads-wins`, `file-wins`, and `newest-wins` for handling concurrent edits
- **File watching** with automatic sync on changes using debounced file system monitoring
- **Issue compilation** from multiple sources into a single `TODO.md` summary view

#### CLI Commands
- `todo.mdx build` - Compile issues from beads and `.todo/*.md` files into `TODO.md`
  - `--output <path>` - Custom output path option
- `todo.mdx sync` - Bi-directional sync between beads and markdown files
  - `--dry-run` - Preview changes without writing
  - `--direction <dir>` - Control sync direction (bidirectional, beads-to-files, files-to-beads)
- `todo.mdx watch` - Watch mode for live sync with automatic change detection
- `todo.mdx init` - Initialize todo.mdx in a project (creates `.todo/` directory and `TODO.mdx` template)
- `todo.mdx --help` - Show help message
- `todo.mdx --version` - Show version

#### Programmatic API
- `compile(options?)` - Compile issues to TODO.md content with full configuration
- `compileToString(issues, options?)` - Pure function to compile issues to markdown
- `sync(options?)` - Bi-directional sync with conflict detection and resolution
- `detectChanges(beadsIssues, fileIssues)` - Detect what changes need syncing
- `watch(options?)` - Watch for file changes with configurable callbacks
- `loadBeadsIssues(dir?)` - Load issues from beads database
- `loadTodoFiles(dir?)` - Load issues from `.todo/*.md` files
- `parseTodoFile(content)` - Parse individual `.todo/*.md` file content
- `generateTodoFile(issue)` - Generate markdown content for an issue
- `writeTodoFiles(issues, dir?)` - Write issues to `.todo/*.md` files
- `hasBeadsDirectory(dir?)` - Check if beads is initialized

#### Type Exports
- `TodoIssue` - Core issue type with full metadata
- `TodoConfig` - Configuration options interface
- `SyncResult` - Sync operation result with created/updated/deleted counts
- `SyncConflict` - Conflict detection metadata
- `CompileResult` - Compilation result with output and metadata
- `WatchEvent` - File watch event types
- `ParsedTodoFile` - Parsed markdown file structure
- Re-exported beads-workflows types: `Issue`, `IssueStatus`, `IssueType`, `Priority`

#### Configuration Options
- `todoDir` - Directory for `.todo/*.md` files (default: `.todo`)
- `beads` - Enable/disable beads integration (default: `true`)
- `beadsDir` - Path to `.beads` directory (auto-detected)
- `conflictStrategy` - Conflict resolution strategy (default: `beads-wins`)
- `includeCompleted` - Include closed issues in output (default: `true`)
- `completedLimit` - Maximum completed issues to show (default: `10`)
- `debounceMs` - Debounce delay for file watcher (default: `300`)
- `direction` - Sync direction control for one-way or bi-directional sync

#### Documentation
- Comprehensive README with quick start and examples
- Getting Started guide with installation and basic workflows
- CLI Reference with all commands and options
- API Reference with TypeScript signatures and examples
- Configuration guide with all options and file format specifications

### Fixed

#### Security
- **Path traversal protection** in file generator - Added `sanitizeId()` to remove dangerous path characters from issue IDs
- **Path safety validation** - Added `validatePathSafety()` to ensure generated file paths stay within target directory
- **Output path validation** in CLI - Added `validateOutputPath()` to prevent path traversal in custom output paths
- **Input validation** in parser:
  - Priority values clamped to valid range (0-4)
  - Issue ID format validation to prevent malformed IDs
- **Race condition fix** in watcher - Fixed pending event queue handling during sync operations

### Changed

- **Architecture simplification** - Refactored from monorepo to single-package architecture for easier maintenance
- **Dependency integration** - Integrated beads-workflows as workspace dependency for type safety
- **Test organization** - Reorganized test files with comprehensive security and edge case coverage

### Dependencies

#### Runtime
- `beads-workflows@^0.1.1` - Issue tracker integration for reading/writing `.beads/issues.jsonl`
- `@mdxld/markdown@^1.9.0` - Bi-directional object/markdown conversion
- `@mdxld/extract@^1.9.1` - Structured data extraction from rendered content
- `chokidar@^4.0.0` - File system watching for live sync

#### Development
- `typescript@^5.7.0` - TypeScript compiler with strict mode
- `tsup@^8.0.0` - Build tool for TypeScript libraries
- `vitest@^2.0.0` - Unit testing framework
- `@types/node@^22.0.0` - Node.js type definitions

### Requirements

- Node.js >= 20.0.0

[0.1.0]: https://github.com/dot-do/todo.mdx/releases/tag/v0.1.0
