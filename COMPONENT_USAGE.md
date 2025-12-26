# Issue Components Usage

The `src/components/issues.ts` module provides bi-directional MDX components for rendering and extracting issue data using `@mdxld/extract`.

## Components

### Issues

Generic issue table/list component with filtering and customization.

```tsx
import { Issues } from 'todo.mdx'

// Render all issues as a table
Issues.render({ 
  issues: allIssues, 
  columns: ['id', 'title', 'status', 'priority'] 
})

// Filter by status
Issues.render({ 
  issues: allIssues, 
  status: 'open' 
})

// Limit results
Issues.render({ 
  issues: allIssues, 
  limit: 10 
})

// Render as list
Issues.render({ 
  issues: allIssues, 
  format: 'list' 
})
```

### Issues.Blocked

Renders only blocked issues.

```tsx
Issues.Blocked.render({ issues: allIssues })
```

### Issues.Ready

Renders only ready (unblocked open) issues.

```tsx
Issues.Ready.render({ issues: allIssues })
```

### Issues.Open

Renders only open issues.

```tsx
Issues.Open.render({ issues: allIssues })
```

### Issues.Closed

Renders only closed issues.

```tsx
Issues.Closed.render({ issues: allIssues })
```

### Issue.Labels

Renders issue labels as badges or comma-separated.

```tsx
// Comma-separated (default)
Issue.Labels.render({ labels: ['bug', 'urgent'] })
// Output: bug, urgent

// Badges
Issue.Labels.render({ labels: ['bug', 'urgent'], format: 'badges' })
// Output: `bug` `urgent`
```

### Issue.Dependencies

Renders issue dependencies as links or plain list.

```tsx
// Plain list (default)
Issue.Dependencies.render({ dependencies: ['todo-001', 'todo-002'] })
// Output:
// - todo-001
// - todo-002

// Markdown links
Issue.Dependencies.render({ 
  dependencies: ['todo-001', 'todo-002'], 
  format: 'links' 
})
// Output:
// - [todo-001](./todo-001.md)
// - [todo-002](./todo-002.md)
```

## Extraction

All components support bi-directional extraction:

```tsx
import { Issues } from 'todo.mdx'

// Render to markdown
const markdown = Issues.render({ issues: allIssues })

// Extract back from markdown
const extracted = Issues.extract(markdown)
// extracted.issues contains the parsed issues
// extracted.columns contains the detected columns
```

## Using with @mdxld/extract

Create extractors for use with templates:

```tsx
import { createIssueExtractors } from 'todo.mdx'
import { extract } from '@mdxld/extract'

const template = `# My Issues

## Open Issues
<Issues.Open issues={issues} />

## Labels
<Issue.Labels labels={labels} />
`

const components = createIssueExtractors()

const result = extract({
  template,
  rendered: editedMarkdown,
  components,
})
```

## Round-Trip Examples

### Table Round-Trip

```tsx
const original = {
  issues: [
    { id: 'todo-001', title: 'Task', status: 'open', type: 'task', priority: 1 }
  ],
  columns: ['id', 'title', 'status']
}

// Render
const rendered = Issues.render(original)
// | id | title | status |
// |---|---|---|
// | todo-001 | Task | open |

// Extract
const extracted = Issues.extract(rendered)
// Back to original structure
```

### Labels Round-Trip

```tsx
const original = { labels: ['bug', 'urgent'], format: 'badges' }

const rendered = Issue.Labels.render(original)
// `bug` `urgent`

const extracted = Issue.Labels.extract(rendered)
// { labels: ['bug', 'urgent'], format: 'badges' }
```

## TypeScript Types

```tsx
import type { 
  IssuesProps, 
  IssueLabelsProps, 
  IssueDependenciesProps 
} from 'todo.mdx'
```

## Implementation Details

- Uses `roundTripComponent` from `@mdxld/extract`
- Supports table and list rendering formats
- Handles empty data gracefully
- Preserves format information during extraction
- Filters are applied at render time, not stored in extracted data
