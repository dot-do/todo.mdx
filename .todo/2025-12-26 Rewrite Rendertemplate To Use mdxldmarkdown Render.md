---
id: todo-b8iz
title: "Rewrite renderTemplate to use @mdxld/markdown render()"
state: open
priority: 1
type: task
labels: ["mdx", "templates"]
createdAt: "2025-12-26T11:40:31.954Z"
updatedAt: "2025-12-26T11:40:31.954Z"
source: "beads"
dependsOn: ["todo-g354", "todo-vong"]
---

# Rewrite renderTemplate to use @mdxld/markdown render()

Replace current simple string interpolation with proper MDX rendering.

**Current (wrong):**
```typescript
export function renderTemplate(template: string, context: TemplateContext): string {
  const slots = parseTemplateSlots(processed)
  // Manual string replacement...
}
```

**Required:**
```typescript
import { render } from '@mdxld/markdown'
import { Issues, Issue } from './components/issues.js'

const components = { Issues, Issue }

export function renderTemplate(template: string, context: TemplateContext): string {
  return render(template, {
    ...context,
    components
  })
}
```

**Key changes:**
1. Use `render()` from `@mdxld/markdown` instead of manual slot replacement
2. Register all MDX components
3. Support full MDX/JavaScript execution in templates
4. Handle both `{expression}` and `<Component />` syntax

### Related Issues

**Depends on:**
- [todo-g354](./todo-g354.md)
- [todo-vong](./todo-vong.md)