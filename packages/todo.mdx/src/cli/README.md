# todo.mdx CLI

Command-line interface for todo.mdx - bidirectional sync between TODO.mdx templates, .todo/*.md files, GitHub Issues, and beads.

## Installation

```bash
npm install -g @todo.mdx/core
# or use without installing
npx @todo.mdx/core
```

## Commands

### `init` - Initialize a new project

Create a new todo.mdx project with interactive prompts.

```bash
npx todo.mdx init
```

This will:
1. Create `TODO.mdx` template file
2. Create `.todo/` directory structure
3. Optionally create example tasks
4. Optionally configure GitHub sync
5. Create/update README.md

#### Interactive Prompts

1. **Project name** - Name of your project (defaults to directory name)
2. **Include example tasks?** - Add two example tasks to help you get started
3. **Enable beads integration?** - Use local git-based issue tracking
4. **Set up GitHub sync?** - Configure GitHub integration
   - If yes, prompts for GitHub owner and repo name

#### What Gets Created

```
your-project/
├── TODO.mdx              # Template that defines how TODO.md is generated
├── .todo/                # Individual task files (if examples enabled)
│   ├── example-1-set-up-your-first-task.mdx
│   └── example-2-explore-todo-mdx-features.mdx
└── README.md            # Project README (if doesn't exist)
```

#### Example Output

```bash
$ npx todo.mdx init

┌  todo.mdx init
│
◆  Project name?
│  my-awesome-project
│
◆  Include example tasks?
│  Yes
│
◆  Enable beads integration?
│  Yes
│
◆  Set up GitHub sync?
│  No
│
◇  Project structure created!
│
│  ╭───────────────────────────────────────────────╮
│  │  Next steps:                                  │
│  │                                               │
│  │  1. Edit TODO.mdx to customize your template │
│  │  2. Check out the example tasks in .todo/    │
│  │  3. Run `npx todo.mdx` to compile            │
│  │  4. Run `npx todo.mdx --watch` for auto      │
│  │                                               │
│  │  Initialize beads: `bd init`                 │
│  │  Create issues: `bd create --title="..."     │
│  │                                               │
│  │  Learn more: https://todo.mdx.do             │
│  ╰───────────────────────────────────────────────╯
│
└  Happy tracking!
```

### `compile` - Compile TODO.mdx to TODO.md (default)

```bash
npx todo.mdx
# or explicitly
npx todo.mdx compile
```

Options:
- `-i, --input <file>` - Input template (default: TODO.mdx or .mdx/todo.mdx)
- `-o, --output <file>` - Output file (default: TODO.md)
- `-w, --watch` - Watch for changes and auto-compile
- `-q, --quiet` - Suppress output

### `generate` - Generate .todo/*.md files from issues

```bash
npx todo.mdx --generate
npx todo.mdx generate
```

Options:
- `-s, --source <type>` - Data source: `beads` (default), `github`, or `api`
- `-q, --quiet` - Suppress output

#### Data Sources

**beads** (local git-based issue tracking)
```bash
npx todo.mdx --generate --source beads
```

**GitHub Issues**
```bash
export GITHUB_TOKEN=ghp_your_token
npx todo.mdx --generate --source github
```

Requires `owner` and `repo` in TODO.mdx frontmatter:
```yaml
---
owner: your-username
repo: your-repo
---
```

**todo.mdx.do API**
```bash
export TODO_MDX_API_KEY=your_api_key
npx todo.mdx --generate --source api
```

Requires `owner`, `repo`, and optionally `apiKey` in TODO.mdx frontmatter:
```yaml
---
owner: your-username
repo: your-repo
apiKey: your_api_key  # or use TODO_MDX_API_KEY env var
---
```

## Configuration

Configure todo.mdx in the frontmatter of your TODO.mdx file:

```yaml
---
title: TODO
beads: true
filePattern: "[id]-[title].mdx"
owner: your-github-username
repo: your-repo-name
---
```

### Available Options

- `title` - Title for the generated TODO.md
- `beads` - Enable beads integration (default: true)
- `filePattern` - How to name .todo files (see File Patterns below)
- `owner` - GitHub owner (username or org)
- `repo` - GitHub repository name
- `apiUrl` - Custom API URL (default: https://todo.mdx.do)
- `apiKey` - API key for todo.mdx.do

### File Patterns

Configure how issue files are named in .todo/ directory:

```yaml
filePattern: "[id]-[title].mdx"    # proj-123-my-task.mdx (default)
filePattern: "[title].mdx"         # my-task.mdx
filePattern: "[type]/[id].mdx"     # bug/proj-123.mdx
filePattern: "[status]/[id].mdx"   # open/proj-123.mdx
```

Available placeholders:
- `[id]` - Issue ID
- `[title]` - Issue title (slugified)
- `[type]` - Issue type (bug, feature, task, etc.)
- `[status]` - Issue status (open, in_progress, closed)
- `[priority]` - Issue priority (1-5)

## Examples

### Basic Setup

```bash
# Create new project
npx todo.mdx init

# Compile template
npx todo.mdx

# Watch for changes
npx todo.mdx --watch
```

### With Beads

```bash
# Initialize beads
bd init

# Create some issues
bd create --title="Add login page"
bd create --title="Fix navigation bug" --type=bug

# Generate .todo files from beads
npx todo.mdx --generate

# Compile to TODO.md
npx todo.mdx
```

### With GitHub

```bash
# Set up GitHub token
export GITHUB_TOKEN=ghp_your_token

# Configure in TODO.mdx
cat > TODO.mdx << 'EOF'
---
title: TODO
owner: your-username
repo: your-repo
---
# Tasks
<Issues.Open />
EOF

# Generate from GitHub issues
npx todo.mdx --generate --source github

# Compile to TODO.md
npx todo.mdx
```

## Learn More

- [Documentation](https://todo.mdx.do)
- [GitHub Repository](https://github.com/dot-do/todo.mdx)
- [Examples](https://github.com/dot-do/todo.mdx/tree/main/examples)
