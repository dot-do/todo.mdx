---
id: todo-j896
title: "Validate CLI --output path for path traversal"
state: closed
priority: 1
type: bug
labels: ["cli", "security"]
createdAt: "2025-12-23T12:44:07.866Z"
updatedAt: "2025-12-23T12:53:24.902Z"
closedAt: "2025-12-23T12:53:24.902Z"
source: "beads"
---

# Validate CLI --output path for path traversal

**Issue**: `--output` flag isn't validated for path traversal attacks.

**Location**: `src/cli.ts` lines 65-80

**Fix**:
- Resolve output path to absolute
- Validate it's within current working directory
- Show error and exit with code 1 if invalid

**Test Cases**:
- Should reject `../secret.md`
- Should reject `/etc/passwd`
- Should accept `TODO.md`
- Should accept `docs/TODO.md`