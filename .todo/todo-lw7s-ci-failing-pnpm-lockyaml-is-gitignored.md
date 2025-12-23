---
id: todo-lw7s
title: "CI failing: pnpm-lock.yaml is gitignored"
state: closed
priority: 0
type: bug
labels: ["blocking", "ci"]
createdAt: "2025-12-21T14:00:46.434Z"
updatedAt: "2025-12-21T14:01:59.553Z"
closedAt: "2025-12-21T14:01:59.553Z"
source: "beads"
---

# CI failing: pnpm-lock.yaml is gitignored

All CI runs are failing because `pnpm-lock.yaml` is in `.gitignore`.

The CI workflow uses `pnpm install --frozen-lockfile` which requires the lockfile to exist. Since it's gitignored, CI fails at the "Setup Node.js" step with:
```
Dependencies lock file is not found. Supported file patterns: pnpm-lock.yaml
```

**Impact:**
- Build & Test job fails immediately
- E2E Tests are skipped (depend on ci job)
- No CI has passed in the recent history

**Fix:**
1. Remove `pnpm-lock.yaml` from `.gitignore`
2. Commit `pnpm-lock.yaml`
3. Push to trigger new CI run

### Timeline

- **Created:** 12/21/2025
- **Updated:** 12/21/2025
- **Closed:** 12/21/2025
