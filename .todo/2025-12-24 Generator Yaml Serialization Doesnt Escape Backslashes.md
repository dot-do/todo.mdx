---
id: todo-8h01
title: "Generator YAML serialization doesn't escape backslashes"
state: open
priority: 2
type: bug
labels: ["code-review", "generator", "serialization", "src"]
createdAt: "2025-12-24T11:15:20.577Z"
updatedAt: "2025-12-24T11:15:20.577Z"
source: "beads"
---

# Generator YAML serialization doesn't escape backslashes

**File:** src/generator.ts:50-53

The `serializeYamlValue` function escapes quotes and newlines but not backslashes:

```typescript
if (typeof value === 'string') {
  // Always quote strings for consistency and safety
  return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
  // Missing: .replace(/\\/g, '\\\\')
}
```

**Impact:** If a title or description contains backslashes (e.g., file paths like `C:\Users\...`), the generated YAML will be malformed. For example:
- Input: `Fix path C:\new\test`
- Output: `"Fix path C:\new\test"` (invalid - `\n` and `\t` are interpreted as escapes)
- Expected: `"Fix path C:\\new\\test"`

**Recommendation:** Escape backslashes BEFORE escaping other characters:
```typescript
return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
```