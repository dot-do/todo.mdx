---
id: todo-9px
title: "Disable GraphQL playground in production"
state: closed
priority: 2
type: bug
labels: ["apps", "security"]
createdAt: "2025-12-20T20:03:28.459Z"
updatedAt: "2025-12-23T10:08:49.116Z"
closedAt: "2025-12-23T10:08:49.116Z"
source: "beads"
---

# Disable GraphQL playground in production

GraphQL Playground accessible without environment checks at apps/admin/src/app/(payload)/api/graphql-playground/route.ts. Allows schema introspection in production.