# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## todo.mdx SDK

When using the `do` tool, you have access to pre-loaded data:

```typescript
// Global arrays - already loaded
repos: Repo[]
issues: Issue[]
milestones: Milestone[]
projects: Project[]

// Types
interface Issue {
  id: string
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
  assignees: string[]
  blockers: Issue[]   // issues blocking this one
  blocked: Issue[]    // issues this one blocks
  repo: string        // owner/name
}

interface Milestone {
  id: string
  title: string
  description: string
  state: 'open' | 'closed'
  dueOn: string | null
  issues: Issue[]
  repo: string
}

interface Repo {
  name: string
  fullName: string    // owner/name
  issues: Issue[]
  milestones: Milestone[]
}

interface Project {
  id: string
  title: string
  items: Issue[]
}
```

**Examples:**
```javascript
// Find blocked issues
return issues.filter(i => i.blockers.length > 0)

// Get open issues by repo
return repos.map(r => ({ repo: r.fullName, open: r.issues.filter(i => i.state === 'open').length }))

// Find overdue milestones
return milestones.filter(m => m.dueOn && new Date(m.dueOn) < new Date())
```

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

