---
id: todo-7ct
title: "Sandbox Dockerfile and startup script"
state: closed
priority: 2
type: task
labels: []
createdAt: "2025-12-20T22:59:29.569Z"
updatedAt: "2025-12-20T23:27:09.360Z"
closedAt: "2025-12-20T23:27:09.360Z"
source: "beads"
---

# Sandbox Dockerfile and startup script

Create the Dockerfile and startup script for the sandbox container.

**startup.sh:**
```bash
#!/bin/bash
set -euo pipefail
# Start stdio ws bridge in background
bun /workspace/stdio-ws.ts &
# Start SDK control plane (required for Sandbox SDK APIs)
exec bun dist/index.js
```

**Dockerfile:**
```dockerfile
FROM docker.io/cloudflare/sandbox:0.3.3
COPY stdio-ws.ts /workspace/stdio-ws.ts
COPY startup.sh /container-server/startup.sh
RUN chmod +x /container-server/startup.sh
```

**Files:**
- `sandbox/Dockerfile`
- `sandbox/startup.sh`

### Related Issues

**Depends on:**
- **todo-e1g**
- **todo-nsd**

### Timeline

- **Created:** 12/20/2025
- **Updated:** 12/20/2025
- **Closed:** 12/20/2025
