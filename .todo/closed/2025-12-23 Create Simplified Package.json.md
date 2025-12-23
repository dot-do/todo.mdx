---
id: todo-ioid
title: "Create simplified package.json"
state: closed
priority: 0
type: task
labels: []
createdAt: "2025-12-23T10:10:08.575Z"
updatedAt: "2025-12-23T10:16:01.100Z"
closedAt: "2025-12-23T10:16:01.100Z"
source: "beads"
dependsOn: ["todo-671j"]
blocks: ["todo-bf0d"]
---

# Create simplified package.json

Replace monorepo package.json with single-package config:
- name: todo.mdx
- dependencies: beads-workflows, @mdxld/markdown, @mdxld/extract
- bin: todo.mdx CLI
- exports: main library
- scripts: build, test, dev

### Related Issues

**Depends on:**
- [todo-671j](./todo-671j.md)

**Blocks:**
- [todo-bf0d](./todo-bf0d.md)