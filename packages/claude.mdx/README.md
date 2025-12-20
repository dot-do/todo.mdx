# claude.mdx

**AI-assisted development orchestrator** - Dispatches Claude Code sessions to work on TODOs from beads issue tracker.

## What is claude.mdx?

`claude.mdx` is a CLI tool that orchestrates AI-assisted development by:

- Picking ready issues from your beads issue tracker
- Spawning Claude Code sessions with full context
- Managing multiple parallel sessions
- Tracking session status and progress

Think of it as your AI development team dispatcher.

## Installation

```bash
npm install -g claude.mdx
```

**Prerequisites:**

- [Claude Code](https://claude.com/claude-code) - The Claude CLI
- [beads-workflows](https://github.com/beads-project/beads) - Issue tracker

```bash
# Install Claude Code
npm install -g @anthropic/claude-cli

# Install beads
npm install -g beads-workflows
bd init
```

## Quick Start

```bash
# Work on next ready issue
claude.mdx next

# Work on specific issue
claude.mdx work todo-123

# Run daemon (watch mode with parallel sessions)
claude.mdx daemon -m 3

# Check status
claude.mdx status
```

## Commands

### `claude.mdx work [issue-id]`

Start a Claude Code session for a specific issue.

```bash
# Work on specific issue
claude.mdx work todo-123

# With custom context
claude.mdx work todo-123 --context "Focus on error handling"
```

**Options:**

- `-i, --issue-id <id>` - Issue ID to work on
- `--interactive` - Interactive mode (pick from list)
- `-c, --context <text>` - Additional context to provide

### `claude.mdx next`

Pick the next ready issue (no blockers) and start a session.

```bash
# Work on next ready issue
claude.mdx next

# Work on next P1 issue
claude.mdx next -p 1

# Work on next bug without confirmation
claude.mdx next -t bug -y
```

**Options:**

- `-p, --priority <level>` - Priority threshold (1-5)
- `-t, --type <type>` - Filter by type (bug|feature|task|epic|chore)
- `-y, --yes` - Auto-start without confirmation

**Priority sorting:**

Issues are sorted by:

1. Priority (lower number = higher priority)
2. Creation date (older first)

### `claude.mdx daemon`

Watch for ready issues and auto-dispatch Claude Code sessions.

```bash
# Run daemon with default settings (2 parallel sessions, 30s poll)
claude.mdx daemon

# Run with 5 parallel sessions
claude.mdx daemon -m 5

# Run with faster polling (10s)
claude.mdx daemon -i 10

# Run daemon for P1 issues only
claude.mdx daemon -p 1
```

**Options:**

- `-m, --max-parallel <count>` - Maximum parallel sessions (default: 2)
- `-i, --interval <seconds>` - Polling interval in seconds (default: 30)
- `-b, --background` - Run in background
- `-p, --priority <level>` - Priority threshold

**Daemon behavior:**

- Polls for ready issues every `interval` seconds
- Spawns new sessions up to `max-parallel` limit
- Automatically updates issue status to `in_progress`
- Prints stats every minute
- Gracefully handles SIGINT/SIGTERM

### `claude.mdx status`

Show active sessions and progress.

```bash
# Show status summary
claude.mdx status

# Show detailed status with session info
claude.mdx status -d
```

**Options:**

- `-d, --detailed` - Show detailed session information
- `-l, --logs` - Show session logs (not yet implemented)

**Output:**

- Active sessions count by status
- Session details (ID, title, status, duration)
- Beads statistics (total issues, ready count, etc.)

## How It Works

### Session Context

When `claude.mdx` spawns a Claude Code session, it renders a context document that includes:

1. **Issue details** - Title, description, type, priority
2. **Design notes** - If available in the issue
3. **Acceptance criteria** - Expected outcomes
4. **Dependencies** - Blocking issues and their status
5. **Project context** - Content from `CLAUDE.md` if present

This context is passed to Claude Code via the `--task` flag, ensuring the AI has full context to work on the issue.

### Status Updates

`claude.mdx` automatically updates issue status:

- Sets issue to `in_progress` when starting a session
- Tracks session completion/failure
- Does NOT auto-close issues (you should verify and close manually)

### Session Management

Sessions are tracked in-memory:

- Each session is keyed by issue ID
- Only one session per issue at a time
- Session status: `running`, `completed`, `failed`, `stopped`
- Completed sessions remain in memory until cleared

## Programmatic Usage

You can also use `claude.mdx` as a library:

```typescript
import {
  getReadyIssues,
  spawnSession,
  getRunningSessions,
  waitForSession,
} from 'claude.mdx'

// Get ready issues
const issues = await getReadyIssues({ priority: 1, limit: 5 })

// Spawn a session
const session = await spawnSession(issues[0], {
  cwd: process.cwd(),
  interactive: false,
})

// Wait for completion
const result = await waitForSession(session.id)
console.log(`Session ${result.status} with exit code ${result.exitCode}`)

// Check running sessions
const running = getRunningSessions()
console.log(`${running.length} sessions running`)
```

## Integration with todo.mdx

`claude.mdx` is part of the todo.mdx ecosystem:

```
beads (.beads/) ←→ todo.mdx API ←→ GitHub Issues
       ↓                ↓
   TODO.mdx         Payload CMS
       ↓                ↓
   TODO.md          Dashboard
       ↓
   claude.mdx (orchestrator)
       ↓
   Claude Code sessions
```

The workflow:

1. Create issues in beads (`bd create`)
2. Issues sync to GitHub and appear in TODO.mdx
3. `claude.mdx daemon` watches for ready issues
4. Spawns Claude Code sessions to work on issues
5. Claude Code makes changes, runs tests, creates commits
6. You review and merge

## Configuration

`claude.mdx` uses environment variables for configuration:

- `CLAUDE_MDX_MAX_PARALLEL` - Max parallel sessions (default: 2)
- `CLAUDE_MDX_POLL_INTERVAL` - Daemon poll interval in seconds (default: 30)
- `CLAUDE_MDX_PRIORITY_THRESHOLD` - Default priority threshold
- `CLAUDE_MDX_CWD` - Working directory for sessions

## Examples

### Example 1: Work on next ready issue

```bash
$ claude.mdx next
Fetching ready issues...

Next issue:
  todo-4fh: Create cli.mdx package - MDX-based CLI framework
  Type: task, Priority: 1

2 other ready issues:
  todo-8mg: Export Payload via Workers RPC (P1)
  todo-3y0: Add shadcn dashboard to Payload app (P1)

Starting Claude Code session...
Updated issue status to in_progress

Session started for todo-4fh
Started at: 2025-12-20T17:30:00.000Z

[Claude Code output...]

Session completed successfully (exit code: 0)
```

### Example 2: Run daemon

```bash
$ claude.mdx daemon -m 3 -i 60
Starting claude.mdx daemon...
Max parallel sessions: 3
Poll interval: 60s

[17:30:00] Stats: 5 ready, 2 in progress, 0 active sessions
[17:30:00] Starting session for todo-4fh: Create cli.mdx package
[17:30:05] Starting session for todo-8mg: Export Payload via Workers RPC
[17:31:00] Stats: 3 ready, 4 in progress, 2 active sessions
[17:35:42] Session todo-4fh completed (exit code: 0)
[17:35:45] Starting session for todo-3y0: Add shadcn dashboard
...
```

### Example 3: Check status

```bash
$ claude.mdx status
Claude.mdx Status

Active Sessions:
  Total: 3
  Running: 2
  Completed: 1
  Failed: 0
  Stopped: 0

Sessions:

  todo-4fh: Create cli.mdx package
    Status: completed | Duration: 5m 42s
    Type: task | Priority: 1

  todo-8mg: Export Payload via Workers RPC
    Status: running | Duration: 2m 15s
    Type: task | Priority: 1

  todo-3y0: Add shadcn dashboard to Payload app
    Status: running | Duration: 1m 3s
    Type: task | Priority: 1

Beads Statistics:
  Total issues: 25
  Open: 10
  In progress: 5
  Blocked: 3
  Ready to work: 5
  Closed: 7
```

## Development

```bash
# Clone repo
git clone https://github.com/dot-do/todo.mdx.git
cd todo.mdx/packages/claude.mdx

# Install dependencies
pnpm install

# Build
pnpm build

# Test locally
node dist/cli.js --help
```

## License

MIT
