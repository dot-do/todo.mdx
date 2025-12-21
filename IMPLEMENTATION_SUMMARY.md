# Implementation Summary: loadGitHubIssues()

**Issue**: todo-0u4
**Date**: 2025-12-20
**Status**: Complete

## Overview

Added `loadGitHubIssues()` function to `packages/todo.mdx/src/compiler.ts` that fetches issues from GitHub REST API and maps them to the `Issue` type.

## Changes Made

### 1. Core Implementation (`packages/todo.mdx/src/compiler.ts`)

Added three new functions:

- **`loadGitHubIssues(config: TodoConfig): Promise<Issue[]>`** - Main function that fetches issues from GitHub
- **`parsePriority(labels): number | undefined`** - Extracts priority from labels (supports `priority:N` and `PN` formats)
- **`parseIssueType(labels): Issue['type']`** - Determines issue type from labels (bug, feature, epic, chore, task)

Key features:
- Uses native `fetch()` API (no external dependencies)
- Requires `GITHUB_TOKEN` environment variable
- Handles pagination automatically (max 100 per page)
- Filters out pull requests (they appear in issues API but have `pull_request` field)
- In-memory caching per repository (`githubIssuesCache` Map)
- Graceful error handling (returns empty array on errors)
- Maps GitHub fields to Issue type fields

### 2. Integration with Compiler

Updated `compile()` function to:
- Load GitHub issues in parallel with beads and file issues
- Merge issues with priority: file > beads > github
- Support `owner` and `repo` in frontmatter configuration
- Automatically deduplicate by ID and `github-{number}` pattern

### 3. CLI Support (`packages/todo.mdx/src/cli.ts`)

Enhanced CLI to support `--source github` flag:
- Validates `GITHUB_TOKEN` environment variable
- Reads `owner`/`repo` from TODO.mdx frontmatter
- Provides helpful error messages for missing configuration
- Example: `npx todo.mdx --generate --source github`

### 4. Export (`packages/todo.mdx/src/index.ts`)

Added `loadGitHubIssues` to public exports, making it available for programmatic use.

### 5. Bug Fixes

Fixed pre-existing type errors:
- Changed `HeadersInit` to `Record<string, string>` in `api-client.ts` (2 occurrences)
- Fixed `detectChanges()` return type in `watcher.ts` to handle 'blocked' state mapping

### 6. Documentation

Created `packages/todo.mdx/GITHUB_INTEGRATION.md` with:
- Setup instructions
- Usage examples (CLI and programmatic)
- Field mapping reference
- Priority and type parsing rules
- Pagination and caching details
- Error handling behavior

## Field Mapping

```typescript
GitHub Issue → Issue type:
- id: `github-${number}`
- githubId: issue.id
- githubNumber: issue.number
- title: issue.title
- body: issue.body || undefined
- state: issue.state === 'closed' ? 'closed' : 'open'
- labels: issue.labels.map(l => l.name)
- assignees: issue.assignees.map(a => a.login)
- priority: parsePriority(issue.labels)  // from priority:N or PN labels
- type: parseIssueType(issue.labels)     // from bug/feature/epic/chore labels
- milestone: issue.milestone?.title
- createdAt: issue.created_at
- updatedAt: issue.updated_at
```

## Testing

1. **Build Test**: Package builds successfully with TypeScript strict mode
2. **Export Test**: `loadGitHubIssues` is correctly exported from built package
3. **Parsing Test**: Created and ran unit test for priority/type parsing logic - all 8 tests passed
4. **Package Tests**: Existing test suite passes (10 tests in api-client.test.ts)

## Usage Examples

### CLI
```bash
export GITHUB_TOKEN=ghp_your_token_here
npx todo.mdx --generate --source github
```

### TODO.mdx frontmatter
```yaml
---
title: TODO
owner: facebook
repo: react
---
```

### Programmatic
```typescript
import { loadGitHubIssues } from 'todo.mdx'

const issues = await loadGitHubIssues({
  owner: 'facebook',
  repo: 'react',
})
```

## Requirements Checklist

- [x] Fetch issues via GitHub REST API (no external dependencies - using native fetch)
- [x] Require GITHUB_TOKEN environment variable
- [x] Accept owner/repo configuration from frontmatter or config
- [x] Map GitHub issue fields to the Issue type in types.ts
- [x] Handle pagination (GitHub returns max 100 per page)
- [x] Support filtering by state (loads all states: open/closed)
- [x] Cache results in memory for subsequent calls in same run
- [x] Export from index.ts
- [x] Update CLI to support --source=github flag
- [x] Update compile() to use GitHub issues when configured

## Files Modified

1. `/packages/todo.mdx/src/compiler.ts` - Added loadGitHubIssues() and helper functions
2. `/packages/todo.mdx/src/index.ts` - Exported loadGitHubIssues
3. `/packages/todo.mdx/src/cli.ts` - Added GitHub source support
4. `/packages/todo.mdx/src/api-client.ts` - Fixed HeadersInit type errors
5. `/packages/todo.mdx/src/watcher.ts` - Fixed detectChanges return type

## Files Created

1. `/packages/todo.mdx/GITHUB_INTEGRATION.md` - User documentation

## Notes

- Pull requests are filtered out (GitHub issues API includes PRs)
- Error handling is graceful - no exceptions thrown
- Cache is per-process, cleared on exit
- Priority/type parsing is extensible (add more label patterns as needed)
- Follows same pattern as `loadGitHubMilestones()` in roadmap.mdx package
