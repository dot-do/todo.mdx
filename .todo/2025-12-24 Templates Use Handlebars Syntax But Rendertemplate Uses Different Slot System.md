---
id: todo-g354
title: "Templates use handlebars syntax but renderTemplate uses different slot system"
state: open
priority: 1
type: bug
labels: ["architecture", "code-review", "src", "templates"]
createdAt: "2025-12-24T11:14:58.272Z"
updatedAt: "2025-12-24T11:14:58.272Z"
source: "beads"
---

# Templates use handlebars syntax but renderTemplate uses different slot system

**File:** src/templates.ts

There's a mismatch between the built-in templates and the `renderTemplate` function:

The built-in templates (lines 121-398) use Handlebars-style syntax:
```
{{issue.title}}
{{#if issue.assignee}}...{{/if}}
{{#each issue.labels}}...{{/each}}
```

But `renderTemplate` (lines 76-116) uses a simple `{path}` slot system via `@mdxld/extract`:
```typescript
export function renderTemplate(template: string, context: TemplateContext): string {
  // Uses parseTemplateSlots from @mdxld/extract
  // Only handles {path} expressions, NOT handlebars conditionals/loops
}
```

**Impact:** The built-in templates are not compatible with `renderTemplate`. Any code trying to use them together will produce incorrect output with unrendered `{{#if}}` blocks.

**Recommendation:** Either:
1. Rewrite built-in templates to use `{path}` syntax only
2. Enhance `renderTemplate` to handle Handlebars syntax
3. Document that built-in templates require a different rendering engine (like handlebars)