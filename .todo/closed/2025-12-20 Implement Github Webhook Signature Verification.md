---
id: todo-gbt
title: "Implement GitHub webhook signature verification"
state: closed
priority: 0
type: bug
labels: ["critical", "security", "worker"]
createdAt: "2025-12-20T20:02:19.664Z"
updatedAt: "2025-12-20T23:07:12.986Z"
closedAt: "2025-12-20T23:07:12.986Z"
source: "beads"
---

# Implement GitHub webhook signature verification

Missing HMAC-SHA256 verification for GitHub webhooks in src/index.ts:208. Anyone can send fake webhooks to manipulate installations, inject malicious issues, or trigger unauthorized actions. Currently has TODO comment with code commented out.