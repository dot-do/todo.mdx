---
id: todo-gx3
title: "Fix PAYLOAD_SECRET empty string fallback"
state: open
priority: 0
type: bug
labels: [apps, critical, security]
---

# Fix PAYLOAD_SECRET empty string fallback

In apps/admin/src/payload.config.ts:39, PAYLOAD_SECRET falls back to empty string which completely compromises JWT security. If env var is missing, auth tokens can be forged. Should throw error if missing or too short (<32 chars).

### Timeline

- **Created:** 12/20/2025

