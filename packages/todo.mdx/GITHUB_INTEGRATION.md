# GitHub Issues Integration

The `todo.mdx` package can now load issues directly from GitHub using the `loadGitHubIssues()` function.

## Setup

1. Create a GitHub personal access token with `repo` scope:
   - Go to https://github.com/settings/tokens
   - Generate new token (classic)
   - Select `repo` scope
   - Copy the token

2. Set the `GITHUB_TOKEN` environment variable:
   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   ```

## Usage

### In TODO.mdx frontmatter

Add `owner` and `repo` to your TODO.mdx frontmatter to enable automatic GitHub sync:

```yaml
---
title: TODO
beads: true
owner: your-github-username
repo: your-repo-name
---
```

When you run `npx todo.mdx`, it will automatically load issues from GitHub and merge them with local beads/file issues.

### CLI: Generate .todo files from GitHub

```bash
# Load from GitHub and generate .todo/*.md files
npx todo.mdx --generate --source github

# Requires TODO.mdx with owner/repo in frontmatter
# Or set GITHUB_TOKEN environment variable
```

### Programmatic API

```typescript
import { loadGitHubIssues } from 'todo.mdx'

const issues = await loadGitHubIssues({
  owner: 'your-github-username',
  repo: 'your-repo-name',
})

console.log(`Loaded ${issues.length} issues`)
```

## Field Mapping

GitHub issues are mapped to the `Issue` type as follows:

| GitHub Field | Issue Field | Notes |
|--------------|-------------|-------|
| `id` | `githubId` | Numeric GitHub ID |
| `number` | `githubNumber` | Issue number (#42) |
| - | `id` | Generated as `github-{number}` |
| `title` | `title` | - |
| `body` | `body` | - |
| `state` | `state` | `open` or `closed` |
| `labels` | `labels` | Array of label names |
| `assignees` | `assignees` | Array of usernames |
| `milestone.title` | `milestone` | Milestone name |
| `created_at` | `createdAt` | ISO 8601 timestamp |
| `updated_at` | `updatedAt` | ISO 8601 timestamp |

### Priority Parsing

Priority is extracted from labels using these patterns:
- `priority:0`, `priority:1`, `priority:2`, etc.
- `P0`, `P1`, `P2`, etc.

If no priority label is found, `priority` is `undefined`.

### Type Parsing

Issue type is determined from labels:
- `bug` → `type: 'bug'`
- `feature` → `type: 'feature'`
- `epic` → `type: 'epic'`
- `chore` → `type: 'chore'`
- Default → `type: 'task'`

## Pagination

The loader automatically handles pagination:
- GitHub returns max 100 issues per page
- The loader fetches all pages until no more issues are returned
- All issues are loaded into memory

## Caching

Results are cached in memory per repository:
- First call fetches from GitHub API
- Subsequent calls return cached data (same process)
- Cache is cleared when process exits

## Filtering Pull Requests

GitHub's issues API includes pull requests. The loader automatically filters them out by checking for the `pull_request` field.

## Error Handling

The loader fails gracefully:
- Missing `GITHUB_TOKEN` → returns empty array
- Missing `owner` or `repo` → returns empty array
- API errors → returns what was fetched so far
- Network errors → returns empty array

No exceptions are thrown, making it safe to use without try/catch.

## Example: Sync GitHub to .todo files

```bash
# 1. Set up TODO.mdx
cat > TODO.mdx << 'EOF'
---
title: TODO
owner: facebook
repo: react
---

# {title}

<Issues.Open />
EOF

# 2. Set token
export GITHUB_TOKEN=ghp_your_token_here

# 3. Generate .todo files from GitHub
npx todo.mdx --generate --source github

# 4. Compile to TODO.md
npx todo.mdx
```

This will:
1. Fetch all issues from facebook/react
2. Generate a `.todo/{id}-{title}.md` file for each issue
3. Compile TODO.mdx to TODO.md with live issue data
