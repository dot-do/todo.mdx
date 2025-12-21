# @todo.mdx/core

MDX components that render live data to markdown — realtime context for humans AND AI.

The core insight: README, TODO, ROADMAP, and AI instructions are all views of the same data. Define once in MDX, render everywhere.

## Quick Start

```bash
# Initialize a new project
npx @todo.mdx/core init

# Compile TODO.mdx to TODO.md
npx @todo.mdx/core

# Watch for changes
npx @todo.mdx/core --watch
```

## What is todo.mdx?

todo.mdx is a bidirectional sync system between:
- **TODO.mdx** - MDX template that defines your task list structure
- **.todo/*.mdx** - Individual task files (human-editable markdown)
- **TODO.md** - Compiled markdown output (auto-generated)
- **beads** - Local git-based issue tracking
- **GitHub Issues** - Sync with GitHub repository issues
- **todo.mdx.do API** - Cloud-hosted issue tracking

## Features

- **Template-driven**: Define your TODO structure once in TODO.mdx
- **Bidirectional sync**: Edit .todo files or use beads/GitHub, stays in sync
- **Multiple data sources**: beads, GitHub Issues, or todo.mdx.do API
- **Flexible file patterns**: Organize .todo files by type, status, or custom patterns
- **Watch mode**: Auto-compile on changes
- **MDX components**: Use React-like components in your templates

## Installation

```bash
npm install @todo.mdx/core
# or use without installing
npx @todo.mdx/core
```

## Usage

### Initialize a New Project

```bash
npx @todo.mdx/core init
```

This will interactively guide you through:
1. Setting your project name
2. Creating example tasks
3. Configuring beads integration
4. Setting up GitHub sync

### Compile TODO.mdx to TODO.md

```bash
npx @todo.mdx/core
```

This reads your TODO.mdx template, loads issues from your configured data source (beads, GitHub, or API), and generates TODO.md.

### Watch Mode

```bash
npx @todo.mdx/core --watch
```

Automatically recompile when TODO.mdx or .todo/*.mdx files change.

### Generate .todo Files

```bash
# From beads (default)
npx @todo.mdx/core --generate

# From GitHub Issues
export GITHUB_TOKEN=ghp_your_token
npx @todo.mdx/core --generate --source github

# From todo.mdx.do API
export TODO_MDX_API_KEY=your_api_key
npx @todo.mdx/core --generate --source api
```

## Example TODO.mdx

```mdx
---
title: TODO
beads: true
filePattern: "[id]-[title].mdx"
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={10} />

## In Progress

<Issues.InProgress />

## Backlog

<Issues.Open />

## Completed

<Issues.Closed limit={20} />
```

## Available Components

- `<Stats />` - Show project statistics (total, open, closed, etc.)
- `<Issues.Ready />` - Tasks ready to work (no blockers)
- `<Issues.Open />` - All open issues
- `<Issues.InProgress />` - Currently in progress
- `<Issues.Closed />` - Completed tasks

## Configuration

Configure in TODO.mdx frontmatter:

```yaml
---
title: TODO                        # Title for generated TODO.md
beads: true                        # Enable beads integration
filePattern: "[id]-[title].mdx"    # How to name .todo files
owner: your-username               # GitHub owner (for GitHub sync)
repo: your-repo                    # GitHub repo (for GitHub sync)
apiKey: your_api_key               # API key (for API sync)
---
```

## File Patterns

Customize how .todo files are named:

```yaml
filePattern: "[id]-[title].mdx"    # proj-123-my-task.mdx (default)
filePattern: "[title].mdx"         # my-task.mdx
filePattern: "[type]/[id].mdx"     # bug/proj-123.mdx
filePattern: "[status]/[id].mdx"   # open/proj-123.mdx
```

## Data Sources

### beads (Local Git-based Tracking)

```bash
bd init
bd create --title="My task"
npx @todo.mdx/core --generate
```

### GitHub Issues

```bash
export GITHUB_TOKEN=ghp_your_token
npx @todo.mdx/core --generate --source github
```

Requires `owner` and `repo` in TODO.mdx frontmatter.

### todo.mdx.do API

```bash
export TODO_MDX_API_KEY=your_api_key
npx @todo.mdx/core --generate --source api
```

Requires `owner` and `repo` in TODO.mdx frontmatter.

## CLI Documentation

See [CLI README](./src/cli/README.md) for full CLI documentation.

## Learn More

- [Documentation](https://todo.mdx.do)
- [GitHub Repository](https://github.com/dot-do/todo.mdx)
- [Examples](https://github.com/dot-do/todo.mdx/tree/main/examples)

## License

MIT
