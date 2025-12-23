---
id: todo-a3aa
title: "Add container termination API"
state: closed
priority: 3
type: feature
labels: ["cloudflare", "sandbox"]
createdAt: "2025-12-21T22:45:30.756Z"
updatedAt: "2025-12-23T10:08:49.122Z"
closedAt: "2025-12-23T10:08:49.122Z"
source: "beads"
---

# Add container termination API

The Cloudflare Sandbox SDK doesn't currently expose a terminate method. Need to:
1. Track when this becomes available in the SDK
2. Expose it via the stdio API for explicit cleanup
3. Handle graceful shutdown with SIGTERM before SIGKILL