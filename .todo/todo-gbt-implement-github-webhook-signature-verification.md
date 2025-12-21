---
id: todo-gbt
title: "Implement GitHub webhook signature verification"
state: open
priority: 0
type: bug
labels: [critical, security, worker]
---

# Implement GitHub webhook signature verification

Missing HMAC-SHA256 verification for GitHub webhooks in src/index.ts:208. Anyone can send fake webhooks to manipulate installations, inject malicious issues, or trigger unauthorized actions. Currently has TODO comment with code commented out.

### Timeline

- **Created:** 12/20/2025

