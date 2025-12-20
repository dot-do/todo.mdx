# cli.mdx

**MDX-based CLI framework for Bun with dual rendering to terminal and markdown.**

Define CLIs in MDX, render to terminal AND markdown. Live data injection from beads, GitHub, APIs. Multi-output: terminal, README.md, CLAUDE.md, .cursorrules.

## Features

- Define CLI commands as MDX components
- React components that render to terminal (like Ink)
- Same components render to markdown files
- Live data injection from beads, GitHub, APIs
- Multi-output: terminal, README.md, CLAUDE.md, .cursorrules
- Built-in components for issues, roadmaps, stats, and more

## Installation

```bash
npm install cli.mdx
# or
pnpm add cli.mdx
```

## Quick Start

Create a `CLI.mdx` file:

```mdx
---
title: My Project
---

# {title}

<Stats />

## Ready to Work

<Issues.Ready limit={3} />

## Commands

<Command name="build" description="Build the project" />
<Command name="test" description="Run tests" />
```

Render to terminal:

```bash
cli.mdx
```

Build to markdown:

```bash
cli.mdx build
```

Dual output (terminal + markdown):

```bash
cli.mdx dual -i CLI.mdx -o CLI.md
```

## Built-in Components

### Issues Components

```mdx
<Issues.Ready limit={3} />        <!-- Ready to work (no blockers) -->
<Issues.Open limit={10} />         <!-- All open issues -->
<Issues.InProgress />              <!-- In progress issues -->
<Issues.Blocked />                 <!-- Blocked issues -->
<Issues.Closed />                  <!-- Closed issues -->
<Issues status="open" priority={1} type="bug" /> <!-- Filtered issues -->
```

### Roadmap Component

```mdx
<Roadmap limit={5} showProgress={true} showDates={true} />
```

### Stats Component

```mdx
<Stats showLeadTime={true} />
```

Shows: `**3 open** · 1 in progress · 2 closed · 6 total (33% complete)`

### Command Component

```mdx
<Command name="build" description="Build the project" aliases={["b"]} />
```

### Agent Component

```mdx
<Agent
  rules={[
    "Always write tests first",
    "Use TypeScript for all code",
    "Follow existing patterns"
  ]}
  context={{ project: "cli.mdx", framework: "Bun + React" }}
/>
```

## API Usage

```typescript
import { compile, renderCli, renderMarkdown } from 'cli.mdx'

// Render to terminal
await renderCli({ input: 'CLI.mdx' })

// Build to markdown
await renderMarkdown({ input: 'CLI.mdx', output: 'CLI.md' })

// Custom compilation
const result = await compile({
  input: 'CLI.mdx',
  output: 'CLI.md',
  mode: 'dual', // 'terminal' | 'markdown' | 'dual'
  beads: true,
})
```

## Programmatic Component Usage

```typescript
import { setComponentData, Issues, Stats } from 'cli.mdx/components'

// Set data
setComponentData({
  issues: [...],
  milestones: [...],
  stats: {...}
})

// Use components in React
<Issues.Ready limit={5} />
<Stats />
```

## Data Sources

### beads Integration

Automatically loads issues from local beads database:

```typescript
import { loadBeadsIssues, loadBeadsMilestones } from 'cli.mdx'

const issues = await loadBeadsIssues()
const milestones = await loadBeadsMilestones()
```

### Custom Data

```typescript
import { setComponentData } from 'cli.mdx/components'

setComponentData({
  issues: [
    {
      id: 'issue-1',
      title: 'Build feature',
      state: 'open',
      priority: 1,
      type: 'feature',
      labels: ['enhancement'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
  stats: {
    total: 10,
    open: 3,
    in_progress: 2,
    blocked: 1,
    closed: 4,
    percent: 40,
  }
})
```

## CLI Commands

```bash
# Render to terminal (default)
cli.mdx
cli.mdx render
cli.mdx CLI.mdx

# Build to markdown
cli.mdx build
cli.mdx build -i TODO.mdx -o TODO.md

# Dual output
cli.mdx dual
cli.mdx dual -i ROADMAP.mdx -o ROADMAP.md

# Specify mode explicitly
cli.mdx -m terminal
cli.mdx -m markdown -o output.md
cli.mdx -m dual -i input.mdx -o output.md

# Help
cli.mdx --help
cli.mdx help
```

## Use Cases

### TODO.mdx

```mdx
---
title: TODO
---

# {title}

<Stats />

## In Progress
<Issues.InProgress />

## Ready to Work
<Issues.Ready limit={5} />

## Blocked
<Issues.Blocked />
```

Compile to `TODO.md` for humans and AI to read.

### ROADMAP.mdx

```mdx
---
title: Product Roadmap
---

# {title}

<Roadmap showProgress={true} showDates={true} />

## Current Sprint
<Issues.InProgress />
```

### CLAUDE.mdx

```mdx
---
title: AI Agent Instructions
---

# {title}

<Agent
  rules={[
    "Check 'bd ready' for unblocked tasks",
    "Write tests first (TDD)",
    "Use existing patterns from packages/",
    "Never commit without tests passing"
  ]}
/>

## Current Work

<Issues.Ready limit={3} />

## Project Stats

<Stats showLeadTime={true} />
```

Compile to `CLAUDE.md` for AI context.

## Architecture

```
cli.mdx/
├── src/
│   ├── types.ts          # TypeScript types
│   ├── renderer.tsx      # Dual terminal/markdown renderer
│   ├── components.tsx    # Built-in MDX components
│   ├── compiler.ts       # MDX compilation
│   ├── loader.ts         # Data loading (beads, etc)
│   ├── cli.ts            # CLI entry point
│   └── index.ts          # Main exports
└── package.json
```

## How It Works

1. **Parse MDX** - Read `.mdx` file, extract frontmatter
2. **Load Data** - Fetch issues/milestones from beads or other sources
3. **Compile** - Convert MDX to React components
4. **Render** - Dual render to terminal (ANSI) and markdown
5. **Output** - Write to stdout or file

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  CliConfig,
  Issue,
  Milestone,
  Stats,
  RenderContext,
  IssuesProps,
  RoadmapProps,
} from 'cli.mdx'
```

## License

MIT
