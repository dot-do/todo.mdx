---
id: todo-er7
title: "Implement structured JSON logging"
state: closed
priority: 2
type: task
labels: ["code-quality"]
createdAt: "2025-12-20T20:03:28.854Z"
updatedAt: "2025-12-23T10:08:49.114Z"
closedAt: "2025-12-23T10:08:49.114Z"
source: "beads"
---

# Implement structured JSON logging

197 instances of console.log/error/warn across packages. Mix of formats, risk of logging sensitive data. Implement proper logging library (pino) with field redaction and log levels.