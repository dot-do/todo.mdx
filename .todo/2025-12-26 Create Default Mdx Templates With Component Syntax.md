---
id: todo-4y3r
title: "Create default MDX templates with component syntax"
state: open
priority: 1
type: task
labels: ["mdx", "templates"]
createdAt: "2025-12-26T11:40:42.672Z"
updatedAt: "2025-12-26T11:40:42.672Z"
source: "beads"
dependsOn: ["todo-g354", "todo-vong"]
---

# Create default MDX templates with component syntax

Replace current built-in templates with proper MDX using components.

**TODO.mdx template:**
```mdx
# TODO

**Generated:** {timestamp}

## Summary

- **Total:** {stats.total}
- **Open:** {stats.open}
- **In Progress:** {stats.inProgress}
- **Blocked:** {stats.blocked}

## Blocked Issues

<Issues.Blocked columns={['id', 'title', 'blockedBy']} />

## Ready to Work

<Issues.Ready limit={10} columns={['id', 'title', 'priority']} />

## Recently Closed

<Issues.Closed limit={5} columns={['id', 'title', 'closedAt']} />
```

**[Issue].mdx template:**
```mdx
---
$pattern: "[id]-[title].md"
---
# {issue.title}

**Status:** {issue.status} | **Priority:** {issue.priority} | **Type:** {issue.type}

{issue.assignee && <span>**Assignee:** @{issue.assignee}</span>}

## Description

{issue.description}

## Labels

<Issue.Labels />

## Dependencies

<Issue.Dependencies />

## Blocks

<Issue.Dependents />
```

### Related Issues

**Depends on:**
- [todo-g354](./todo-g354.md)
- [todo-vong](./todo-vong.md)