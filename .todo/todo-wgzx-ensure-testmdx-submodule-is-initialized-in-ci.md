---
id: todo-wgzx
title: "Ensure test.mdx submodule is initialized in CI"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-21T04:47:58.788Z"
updatedAt: "2025-12-21T05:00:44.384Z"
closedAt: "2025-12-21T05:00:44.384Z"
source: "beads"
---

# Ensure test.mdx submodule is initialized in CI

CI workflow must initialize the test.mdx git submodule for worktree-based tests.

## Current setup
- `tests/fixtures/test.mdx` is a git submodule pointing to `dot-do/test.mdx`
- Tests create worktrees in `tests/fixtures/.worktrees/`
- Tests fail with "FIXTURES_DIR not set" if submodule missing

## CI changes
```yaml
- uses: actions/checkout@v4
  with:
    submodules: recursive  # or 'true' for just first level
    
# Or manually:
- run: git submodule update --init --recursive
```

## Verify
- Submodule cloned with full history (for worktree creation)
- Git credentials available for push operations
- Cleanup works properly after tests

### Related Issues

**Depends on:**
- **todo-8dmr**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
