---
id: todo-es3r
title: "Add extractFromMarkdown using @mdxld/extract"
state: open
priority: 1
type: task
labels: ["mdx", "sync", "templates"]
createdAt: "2025-12-26T11:40:37.320Z"
updatedAt: "2025-12-26T11:40:37.320Z"
source: "beads"
dependsOn: ["todo-g354", "todo-vong"]
---

# Add extractFromMarkdown using @mdxld/extract

Enable reverse flow: Markdown → Props extraction.

**New function:**
```typescript
import { extract, createEntityExtractors } from '@mdxld/extract'
import { Issues, Issue } from './components/issues.js'

export async function extractFromMarkdown(
  template: string,
  renderedMarkdown: string
): Promise<ExtractResult> {
  // Auto-discover components in template
  const componentExtractors = createEntityExtractors(template)
  
  return extract({
    template,
    rendered: renderedMarkdown,
    components: {
      Issues: Issues.extractor,
      Issue: Issue.extractor,
      ...componentExtractors
    }
  })
}
```

**Use case:** When user edits a .md file, extract changes back to structured issue data.

**Integration with sync.ts:**
```typescript
// In syncMarkdownToBeads():
const result = await extractFromMarkdown(template, editedMarkdown)
const changes = diff(originalIssue, result.data)
if (changes.hasChanges) {
  await beadsOps.updateIssue(issueId, result.data)
}
```

### Related Issues

**Depends on:**
- [todo-g354](./todo-g354.md)
- [todo-vong](./todo-vong.md)