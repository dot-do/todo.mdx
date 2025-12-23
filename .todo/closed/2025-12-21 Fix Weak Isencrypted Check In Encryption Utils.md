---
id: todo-zk9o
title: "Fix weak isEncrypted() check in encryption utils"
state: closed
priority: 1
type: bug
labels: ["encryption", "security"]
createdAt: "2025-12-22T00:24:08.221Z"
updatedAt: "2025-12-22T00:34:47.456Z"
closedAt: "2025-12-22T00:34:47.456Z"
source: "beads"
---

# Fix weak isEncrypted() check in encryption utils

isEncrypted() only checks for 3 colon-separated parts. URLs with ports, timestamps, etc. would match. Could cause afterRead hook to attempt decryption of non-encrypted values.