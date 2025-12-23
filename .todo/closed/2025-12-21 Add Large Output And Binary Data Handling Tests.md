---
id: todo-xmgd
title: "Add large output and binary data handling tests"
state: closed
priority: 3
type: task
labels: ["sandbox", "testing"]
createdAt: "2025-12-21T22:45:57.454Z"
updatedAt: "2025-12-23T10:08:49.121Z"
closedAt: "2025-12-23T10:08:49.121Z"
source: "beads"
---

# Add large output and binary data handling tests

Missing edge case coverage:
- Binary data in stdout/stderr (images, compiled output)
- Very large output streaming (MB+ of data)
- Streaming buffer limits and backpressure
- Memory usage under high output volume
- Special characters and encoding edge cases