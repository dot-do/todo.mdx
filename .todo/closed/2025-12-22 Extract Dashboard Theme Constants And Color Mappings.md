---
id: todo-vzv9
title: "Extract dashboard theme constants and color mappings"
state: closed
priority: 2
type: chore
labels: ["dashboard", "dedup", "refactor"]
createdAt: "2025-12-22T08:05:42.590Z"
updatedAt: "2025-12-22T08:09:10.514Z"
closedAt: "2025-12-22T08:09:10.514Z"
source: "beads"
---

# Extract dashboard theme constants and color mappings

Status/priority colors duplicated between:
- packages/dashboard/src/components/issue-list.tsx (lines 25-46)
- packages/dashboard/src/components/stats-cards.tsx (lines 90-116)

Create packages/dashboard/src/lib/theme.ts with:
- STATUS_COLORS, PRIORITY_COLORS, TYPE_ICONS constants
- Border/background pattern constants