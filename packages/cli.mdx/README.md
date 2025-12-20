# cli.mdx

**MDX → CLI: Define command-line interfaces in MDX files with dual rendering to terminal and markdown.**

Like [Pastel](https://github.com/vadimdemedes/pastel) but simpler: No build step, no file-based routing, just MDX components that render beautifully to both terminal (with colors/formatting) and markdown documentation.

## Vision

CLIs are documentation. Documentation is CLIs. With cli.mdx, you define your CLI once in MDX and get:

1. **Terminal UI** - Colored, formatted output for actual CLI execution
2. **Markdown docs** - Auto-generated documentation from the same source
3. **Live data** - MDX components that pull real data from beads, GitHub, APIs

```mdx
# My CLI

<Command name="deploy" description="Deploy to production">
  <Flag name="env" type="string" description="Environment to deploy to" />
  <Flag name="dry-run" type="boolean" description="Preview changes without deploying" />
</Command>

<Issues.Ready limit={5} />
```

Renders to terminal with colors, compiles to markdown docs, all from one source.

## Philosophy

Unlike [Pastel](https://github.com/vadimdemedes/pastel) (Next.js-like framework with file-based routing, full Ink integration), cli.mdx takes a simpler approach:

- **No build step** - MDX files are compiled on-demand
- **No routing** - Just define commands inline with `<Command>` components
- **Dual rendering** - Same MDX source renders to terminal AND markdown
- **Data-driven** - Built-in components for issues, roadmaps, stats from beads/GitHub

Think of it as "MDX templates for CLIs" rather than "a CLI framework."

## Installation

```bash
pnpm add @todo.mdx/cli.mdx
```

## Quick Start

Create a `CLI.mdx` file:

```mdx
---
title: My CLI
version: 1.0.0
---

# {title}

Version {version}

## Commands

<Command name="start" description="Start the development server">
  <Flag name="port" type="number" default={3000} description="Port to listen on" />
  <Flag name="host" type="string" default="localhost" description="Host to bind to" />
</Command>

<Command name="build" description="Build for production" />

<Command name="deploy" description="Deploy to production">
  <Argument name="environment" required description="Environment to deploy to (staging|production)" />
  <Flag name="dry-run" type="boolean" description="Preview changes without deploying" />
  <Flag name="force" type="boolean" description="Force deploy even with warnings" />
</Command>

## Status

<Stats />

## Ready to Work

<Issues.Ready limit={5} />
```

Render to terminal:

```bash
npx cli.mdx                    # Renders to terminal with colors
npx cli.mdx build              # Compiles to CLI.md
npx cli.mdx dual -o CLI.md     # Both terminal + markdown file
```

## Component API

### Command Component

Define a CLI command with arguments and flags.

```tsx
<Command
  name="deploy"              // Command name (required)
  description="Deploy app"   // Command description
  aliases={["d", "ship"]}    // Command aliases
>
  {/* Arguments and flags as children */}
</Command>
```

**Props:**

- `name: string` (required) - Command name
- `description?: string` - Command description shown in help
- `aliases?: string[]` - Alternative names for the command
- `children?: ReactNode` - Arguments, flags, subcommands, or documentation

**Example:**

```mdx
<Command name="server" description="Run development server" aliases={["dev", "serve"]}>
  <Flag name="port" type="number" default={3000} description="Port to listen on" />
  <Flag name="watch" type="boolean" description="Enable hot reload" />

  Additional notes: The server runs with auto-reload enabled by default.
</Command>
```

### Argument Component

Positional arguments for a command.

```tsx
<Argument
  name="target"           // Argument name (required)
  description="Deploy target"
  required={true}         // Is this argument required?
  choices={["staging", "production"]}  // Valid choices
  default="staging"       // Default value
/>
```

**Props:**

- `name: string` (required) - Argument name
- `description?: string` - Argument description
- `required?: boolean` - Whether argument is required (default: false)
- `default?: any` - Default value if not provided
- `choices?: string[]` - Valid choices (creates enum validation)

**Example:**

```mdx
<Command name="deploy">
  <Argument
    name="environment"
    required
    choices={["dev", "staging", "production"]}
    description="Target environment"
  />
  <Argument name="version" description="Version to deploy (defaults to latest)" />
</Command>
```

### Flag Component

Named options for a command (--flag style).

```tsx
<Flag
  name="verbose"          // Flag name (required)
  alias="v"               // Short alias (-v)
  type="boolean"          // Type: string | number | boolean
  description="Enable verbose logging"
  required={false}
  default={false}
/>
```

**Props:**

- `name: string` (required) - Flag name (becomes --name)
- `alias?: string` - Short form (becomes -x)
- `type?: "string" | "number" | "boolean"` - Value type (default: string)
- `description?: string` - Flag description
- `required?: boolean` - Whether flag is required
- `default?: any` - Default value

**Examples:**

```mdx
<!-- Boolean flag -->
<Flag name="force" alias="f" type="boolean" description="Skip confirmations" />

<!-- String flag with default -->
<Flag name="env" alias="e" type="string" default="development" description="Environment" />

<!-- Number flag -->
<Flag name="port" alias="p" type="number" default={3000} description="Port number" />

<!-- Required flag -->
<Flag name="api-key" type="string" required description="API key for authentication" />
```

### Subcommand Component

Nested commands for hierarchical CLIs.

```tsx
<Command name="db" description="Database commands">
  <Subcommand name="migrate" description="Run migrations">
    <Flag name="rollback" type="boolean" description="Rollback last migration" />
  </Subcommand>

  <Subcommand name="seed" description="Seed database">
    <Flag name="reset" type="boolean" description="Reset before seeding" />
  </Subcommand>
</Command>
```

**Props:**

- Same as `<Command>` component
- Can be nested multiple levels deep

**Example:**

```mdx
<Command name="github" description="GitHub integration">
  <Subcommand name="sync" description="Sync issues with GitHub">
    <Flag name="repo" type="string" description="Repository name" />
    <Flag name="dry-run" type="boolean" description="Preview changes" />
  </Subcommand>

  <Subcommand name="webhook" description="Manage webhooks">
    <Subcommand name="list" description="List all webhooks" />
    <Subcommand name="create" description="Create new webhook">
      <Argument name="url" required description="Webhook URL" />
    </Subcommand>
  </Subcommand>
</Command>
```

### Built-in Data Components

cli.mdx includes components for rendering live data from beads/GitHub:

```mdx
<!-- Issue lists -->
<Issues.Ready limit={10} />          <!-- Ready to work (no blockers) -->
<Issues.Open limit={10} />           <!-- All open issues -->
<Issues.InProgress limit={5} />      <!-- In progress -->
<Issues.Blocked />                   <!-- Blocked issues -->
<Issues.Closed limit={20} />         <!-- Closed issues -->

<!-- Filtered issues -->
<Issues status="open" priority={1} type="bug" limit={10} />

<!-- Roadmap/milestones -->
<Roadmap limit={5} showProgress showDates />

<!-- Statistics -->
<Stats showLeadTime />

<!-- AI agent instructions -->
<Agent rules={["Rule 1", "Rule 2"]} context={{ foo: "bar" }} />
```

See [Components Reference](#components-reference) for full API.

## How It Works

### Dual Rendering

cli.mdx renders the same MDX source two ways:

1. **Terminal** - ANSI colors, formatting, interactive output
2. **Markdown** - Clean documentation, GitHub-ready

Example:

```mdx
<Command name="deploy" description="Deploy application">
  <Flag name="env" type="string" default="production" />
</Command>
```

**Terminal output:**

```
deploy (Deploy application)
  --env <string>  Environment (default: production)
```

**Markdown output:**

```markdown
**deploy** - Deploy application

Options:
- `--env <string>` - Environment (default: production)
```

### Template Hydration

MDX files are compiled using a simple template hydration approach:

1. Parse frontmatter (YAML)
2. Replace `{variable}` placeholders with frontmatter values
3. Replace component tags with rendered output
4. Apply formatting based on mode (terminal/markdown)

This is simpler than full React reconciliation but sufficient for CLI docs.

### Data Loading

When `beads: true` in config, cli.mdx loads data from:

- `.beads/` directory (local issue tracker)
- Can be extended to load from GitHub API, Linear, etc.

Components like `<Issues.Ready />` use this data to render live information.

## CLI Usage

```bash
# Render to terminal
cli.mdx                           # Uses CLI.mdx, renders to terminal
cli.mdx render                    # Same as above
cli.mdx TODO.mdx                  # Render specific file

# Build markdown
cli.mdx build                     # CLI.mdx → CLI.md
cli.mdx build -i TODO.mdx -o TODO.md

# Dual mode (terminal + markdown)
cli.mdx dual                      # Terminal output + CLI.md file
cli.mdx dual -o COMMANDS.md       # Custom output file

# Options
cli.mdx -i INPUT.mdx              # Custom input file
cli.mdx -o OUTPUT.md              # Custom output file
cli.mdx -m markdown               # Force markdown mode
cli.mdx -h                        # Show help
```

## Programmatic API

```typescript
import { compile, renderCli, renderMarkdown, renderDual } from '@todo.mdx/cli.mdx'

// Compile with custom config
await compile({
  input: 'CLI.mdx',
  output: 'CLI.md',
  mode: 'terminal',  // 'terminal' | 'markdown' | 'dual'
  beads: true,       // Load data from beads
})

// Shortcuts
await renderCli({ input: 'CLI.mdx' })           // Terminal only
await renderMarkdown({ input: 'CLI.mdx' })      // Markdown file only
await renderDual({ input: 'CLI.mdx' })          // Both
```

### Custom Components

```typescript
import { compile, setComponentData } from '@todo.mdx/cli.mdx'

// Provide custom data
setComponentData({
  issues: [...],
  milestones: [...],
  stats: { total: 100, open: 50, ... }
})

// Compile with custom components
await compile({
  input: 'CLI.mdx',
  components: {
    CustomCommand: MyCommandComponent,
    ...
  }
})
```

## Components Reference

### Issues

Filter and display issues from beads/GitHub.

```mdx
<!-- Shortcuts -->
<Issues.Ready limit={10} />
<Issues.Open limit={10} />
<Issues.InProgress limit={5} />
<Issues.Blocked />
<Issues.Closed limit={20} />

<!-- Custom filters -->
<Issues
  status="open"           // Filter by status
  priority={1}            // Filter by priority (1-5)
  type="bug"              // Filter by type
  labels={["urgent"]}     // Filter by labels
  limit={10}              // Limit results
/>
```

### Roadmap

Display milestones and their progress.

```mdx
<Roadmap
  limit={5}               // Number of milestones to show
  showProgress={true}     // Show completion percentage
  showDates={true}        // Show due dates
/>
```

### Stats

Show issue statistics.

```mdx
<Stats showLeadTime />
```

Output: `**10 open** · 3 in progress · 1 blocked · 45 closed · 59 total (76% complete) · avg 5d lead time`

### Command, Argument, Flag

See [Component API](#component-api) above.

### Agent

Render AI agent instructions (for CLAUDE.md, .cursorrules, etc).

```mdx
<Agent
  rules={[
    "Follow existing code style",
    "Write tests for new features",
    "Update documentation"
  ]}
  context={{
    framework: "Next.js",
    testing: "vitest"
  }}
/>
```

## Use Cases

### 1. Self-Documenting CLIs

Define your CLI commands in MDX, render to terminal for execution, compile to markdown for docs.

```mdx
<!-- CLI.mdx -->
<Command name="build" description="Build the project">
  <Flag name="watch" type="boolean" description="Watch for changes" />
  <Flag name="minify" type="boolean" default description="Minify output" />
</Command>
```

Run: `cli.mdx dual` → Terminal help + CLI.md docs

### 2. Dynamic TODO Lists

```mdx
<!-- TODO.mdx -->
# TODO

<Stats />

## Ready to Work
<Issues.Ready limit={5} />

## In Progress
<Issues.InProgress />
```

Run: `todo.mdx` → Terminal output with live data
Run: `todo.mdx build` → TODO.md file

### 3. Roadmap Documentation

```mdx
<!-- ROADMAP.mdx -->
# Roadmap

<Roadmap limit={10} showProgress showDates />
```

Run: `cli.mdx ROADMAP.mdx -o ROADMAP.md`

### 4. AI Agent Instructions

```mdx
<!-- AGENTS.mdx -->
# AI Development Guidelines

<Agent
  rules={[
    "Use TypeScript strict mode",
    "Write comprehensive tests",
    "Keep functions small and focused"
  ]}
  context={{
    testing: "vitest",
    bundler: "tsup"
  }}
/>

## Current Work

<Issues.InProgress limit={5} />
```

Compile to CLAUDE.md, .cursorrules, .github/copilot-instructions.md

## How Other Packages Use It

### todo.mdx

The `@todo.mdx/core` package uses cli.mdx for its TODO.mdx → TODO.md compilation:

```typescript
import { compile } from '@todo.mdx/cli.mdx'

await compile({
  input: 'TODO.mdx',
  output: 'TODO.md',
  mode: 'dual',  // Terminal + markdown
  beads: true,   // Load issues from beads
})
```

Users create `TODO.mdx`:

```mdx
---
title: TODO
beads: true
---

# {title}

<Stats />

## Ready to Work
<Issues.Ready limit={10} />

## All Open Issues
<Issues.Open />
```

Run `npx todo.mdx` → Terminal output + TODO.md file

### roadmap.mdx

The `@todo.mdx/roadmap.mdx` package uses cli.mdx for ROADMAP compilation:

```mdx
<!-- ROADMAP.mdx -->
# Roadmap

<Roadmap limit={10} showProgress showDates />

## Upcoming Milestones
<Roadmap status="open" limit={3} />

## Completed Milestones
<Roadmap status="closed" limit={5} />
```

### claude.mdx

The `@todo.mdx/claude.mdx` package uses cli.mdx for AI agent instructions:

```mdx
<!-- AGENTS.mdx -->
# Claude Development Agent

<Agent
  rules={[
    "Follow existing code conventions",
    "Write tests for new features",
    "Use beads for issue tracking"
  ]}
  context={{
    testing: "vitest",
    issueTracker: "beads"
  }}
/>

## Commands

<Command name="work" description="Start work on an issue">
  <Argument name="issue-id" description="Issue ID to work on" />
  <Flag name="interactive" type="boolean" description="Pick from list" />
</Command>

## Current Work

<Issues.InProgress />
```

Compiles to CLAUDE.md, .cursorrules, etc.

## Architecture Decisions

### Why Not Full Ink/Pastel?

[Pastel](https://github.com/vadimdemedes/pastel) is excellent for building complex, interactive CLIs with React components. But cli.mdx has different goals:

| Feature | Pastel | cli.mdx |
|---------|--------|---------|
| **Approach** | File-based routing (commands/) | MDX templates |
| **Rendering** | Ink (full React reconciler) | Simple template hydration |
| **Build step** | Required | None (runtime compilation) |
| **Output** | Terminal only | Dual (terminal + markdown) |
| **Use case** | Interactive CLIs | Documentation-first CLIs |
| **Complexity** | Framework | Library |

cli.mdx is for when you want to write documentation that _also_ powers your CLI, not build a CLI that _also_ has documentation.

### Why Template Hydration?

We use simple template hydration (`{variable}` replacement + component tag replacement) instead of full React reconciliation because:

1. **Simpler** - No complex renderer, easier to debug
2. **Faster** - No VDOM diffing needed for static content
3. **Dual output** - Easy to render same source to terminal AND markdown
4. **Good enough** - CLI docs don't need full React lifecycle

The `compiler.ts` has full React reconciliation via @mdx-js/mdx, but `simple-compiler.ts` (used by default) uses regex-based hydration.

### Why Dual Rendering?

CLIs should be self-documenting. With dual rendering:

1. Write CLI commands once in MDX
2. Get colored terminal output for actual execution
3. Get markdown docs for GitHub/docs sites
4. Single source of truth for both

Example: `cli.mdx dual` → Terminal output + CLI.md file

## Comparison to Alternatives

### vs Pastel

- **Pastel**: Next.js-like CLI framework, file-based routing, full Ink integration, interactive UIs
- **cli.mdx**: MDX templates for CLIs, dual rendering, documentation-first

Use Pastel for: Complex interactive CLIs (like `create-next-app`)
Use cli.mdx for: Documentation that doubles as CLI (like TODO.md, ROADMAP.md)

### vs Commander/Yargs

- **Commander/Yargs**: Define CLIs in code, generate help text
- **cli.mdx**: Define CLIs in MDX, generate terminal + markdown

Use Commander for: Traditional CLIs defined in JS/TS
Use cli.mdx for: Documentation-driven CLIs

### vs Docusaurus/VitePress

- **Docusaurus/VitePress**: Static site generators for documentation
- **cli.mdx**: Dual-purpose CLI + documentation from same MDX source

Use Docusaurus for: Full documentation sites
Use cli.mdx for: CLI tools that also produce markdown docs

## Future Enhancements

Potential additions (not yet implemented):

1. **Action handlers** - `<Command action={handler}>` to wire up actual command logic
2. **Interactive prompts** - `<Prompt>` component for user input
3. **Validation** - Zod integration like Pastel for type-safe args/flags
4. **Auto-completion** - Generate shell completion scripts from MDX
5. **GitHub sync** - Bi-directional sync with GitHub Issues/Projects
6. **Linear integration** - Pull roadmap from Linear

## Architecture

```
cli.mdx/
├── src/
│   ├── types.ts          # TypeScript types
│   ├── renderer.tsx      # Dual terminal/markdown renderer
│   ├── components.tsx    # Built-in MDX components
│   ├── compiler.ts       # Full MDX compilation (React reconciler)
│   ├── simple-compiler.ts # Template hydration (default)
│   ├── loader.ts         # Data loading (beads, etc)
│   ├── cli.ts            # CLI entry point
│   └── index.ts          # Main exports
└── package.json
```

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
  CommandProps,
  AgentProps,
} from '@todo.mdx/cli.mdx'
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup.

## License

MIT

## Related

- [todo.mdx](../todo.mdx) - TODO.mdx → TODO.md compilation
- [roadmap.mdx](../roadmap.mdx) - ROADMAP.mdx → ROADMAP.md
- [claude.mdx](../claude.mdx) - AI agent instructions in MDX
- [Pastel](https://github.com/vadimdemedes/pastel) - Next.js-like framework for CLIs
- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [MDX](https://mdxjs.com) - Markdown for the component era

---

**cli.mdx**: MDX components that render to terminal AND markdown. Define CLIs in MDX, simpler than Pastel.

## Sources

- [Pastel - Next.js-like framework for CLIs](https://github.com/vadimdemedes/pastel)
- [Building CLI tools with React using Ink and Pastel](https://medium.com/trabe/building-cli-tools-with-react-using-ink-and-pastel-2e5b0d3e2793)
- [MDX - Markdown for the component era](https://mdxjs.com/)
