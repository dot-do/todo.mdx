---
id: todo-gp5
title: "Implement CSRF protection for custom API routes"
state: closed
priority: 1
type: bug
labels: ["apps", "security"]
createdAt: "2025-12-20T20:02:55.045Z"
updatedAt: "2025-12-21T21:36:25.344Z"
closedAt: "2025-12-21T21:36:25.344Z"
source: "beads"
---

# Implement CSRF protection for custom API routes

Custom API routes throughout apps lack CSRF protection. Vulnerable to cross-site request forgery attacks. Implement CSRF tokens, SameSite cookies, and Origin/Referer validation.