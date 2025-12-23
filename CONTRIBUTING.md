# Contributing to todo.mdx

Thank you for contributing to todo.mdx! This guide will help you get started.

## Development Setup

1. **Prerequisites**
   - Node.js >= 20.0.0
   - pnpm (install via `npm install -g pnpm`)

2. **Clone and Install**
   ```bash
   git clone https://github.com/dot-do/todo.mdx.git
   cd todo.mdx
   pnpm install
   ```

3. **Build the Project**
   ```bash
   pnpm build        # Build once
   pnpm dev          # Watch mode for development
   ```

4. **Verify Setup**
   ```bash
   pnpm typecheck    # Check TypeScript types
   pnpm test         # Run tests
   ```

## Development Workflow

### Running Tests

```bash
pnpm test              # Run tests once
pnpm test:watch        # Watch mode (re-runs on file changes)
```

We use **vitest** for testing. Write tests alongside your code changes.

### Type Checking

```bash
pnpm typecheck         # Verify TypeScript types
```

All code must pass TypeScript strict mode checks.

### Testing the CLI

After building, test CLI commands locally:

```bash
./dist/cli.js build
./dist/cli.js sync
./dist/cli.js watch
```

## Code Style

- **TypeScript strict mode** - All code must compile with strict checks
- **Functional programming** - Prefer pure functions and immutable patterns
- **No side effects** - Keep functions predictable and testable
- **Clear naming** - Use descriptive variable and function names

Example:
```typescript
// Good: Pure function
function parseFrontmatter(content: string): Frontmatter {
  // ...
}

// Avoid: Side effects
function parseFrontmatter(content: string): void {
  globalState.frontmatter = // ...
}
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add watch command for live sync
fix: handle missing frontmatter gracefully
docs: update CLI examples in README
test: add tests for sync conflict resolution
chore: update dependencies
refactor: simplify parser logic
```

**Format:** `<type>: <description>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Add or update tests
- `refactor` - Code refactoring
- `chore` - Maintenance tasks
- `perf` - Performance improvements

## Issue Tracking with Beads

We use **beads** for issue tracking. Issues are stored in `.beads/issues.jsonl`.

### Finding Work

```bash
bd ready                # Show issues ready to work (no blockers)
bd list --status=open   # All open issues
bd show <id>            # View issue details
```

### Working on an Issue

1. **Claim an issue:**
   ```bash
   bd update <id> --status=in_progress --assignee=<your-github-username>
   ```

2. **Create a branch:**
   ```bash
   git checkout -b fix/issue-description
   ```

3. **Make your changes** following TDD:
   - Write a failing test
   - Make the test pass
   - Refactor

4. **Close the issue when done:**
   ```bash
   bd close <id>
   ```

### Creating New Issues

```bash
bd create --title="Your issue title" --type=feature --priority=2
```

**Types:** `bug`, `feature`, `task`, `epic`, `chore`
**Priority:** `0` (critical) to `4` (backlog)

## Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes** with tests and documentation

3. **Ensure all checks pass:**
   ```bash
   pnpm typecheck
   pnpm test
   pnpm build
   ```

4. **Commit using conventional commits:**
   ```bash
   git commit -m "feat: add new sync feature"
   ```

5. **Push and create a PR:**
   ```bash
   git push origin feat/your-feature
   ```
   Then open a pull request on GitHub.

6. **PR Requirements:**
   - All tests must pass
   - TypeScript checks must pass
   - Include tests for new features
   - Update documentation if needed
   - Follow code style guidelines

## Project Structure

```
todo.mdx/
├── src/
│   ├── index.ts        # Main exports
│   ├── types.ts        # TypeScript interfaces
│   ├── beads.ts        # Read issues from beads-workflows
│   ├── parser.ts       # Parse .todo/*.md files
│   ├── generator.ts    # Generate .todo/*.md files
│   ├── compiler.ts     # Compile TODO.mdx → TODO.md
│   ├── sync.ts         # Bi-directional sync logic
│   ├── watcher.ts      # File watching for live sync
│   └── cli.ts          # CLI commands
├── tests/              # Test files
├── .beads/             # Issue tracking database
└── .todo/              # Generated issue markdown files
```

## Testing Guidelines

- Write tests for all new features and bug fixes
- Use descriptive test names: `test('should parse frontmatter with missing fields')`
- Test edge cases and error conditions
- Keep tests focused and independent
- Follow TDD: red (failing test) -> green (passing test) -> refactor

## Need Help?

- Check existing issues: `bd list --status=open`
- Review [CLAUDE.md](./CLAUDE.md) for architecture details
- Look at existing code for patterns and examples

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
