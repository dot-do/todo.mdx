import { describe, it, expect } from 'vitest'
import { parseWorkflowFile } from './parser.js'

describe('parseWorkflowFile', () => {
  it('extracts TypeScript code blocks from MDX', () => {
    const content = `---
name: test-workflow
description: A test workflow
---

# Test Workflow

This workflow handles ready issues.

\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('Issue ready:', issue.id)
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.name).toBe('test-workflow')
    expect(result.metadata.name).toBe('test-workflow')
    expect(result.metadata.description).toBe('A test workflow')
    expect(result.codeBlocks).toHaveLength(1)
    expect(result.codeBlocks[0].language).toBe('typescript')
    expect(result.codeBlocks[0].content).toContain('on.issue.ready')
    expect(result.source).toContain('on.issue.ready')
  })

  it('handles ts shorthand for TypeScript', () => {
    const content = `\`\`\`ts
on.issue.closed(async (issue) => {
  console.log('closed')
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.codeBlocks).toHaveLength(1)
    expect(result.codeBlocks[0].language).toBe('ts')
    expect(result.source).toContain('on.issue.closed')
  })

  it('extracts multiple code blocks', () => {
    const content = `---
name: multi-handler
---

# Multiple Handlers

First handler:

\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('ready')
})
\`\`\`

Second handler:

\`\`\`typescript
on.issue.closed(async (issue) => {
  console.log('closed')
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/multi.mdx')

    expect(result.codeBlocks).toHaveLength(2)
    expect(result.source).toContain('on.issue.ready')
    expect(result.source).toContain('on.issue.closed')
  })

  it('uses filename when no name in frontmatter', () => {
    const content = `\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/develop.mdx')

    expect(result.name).toBe('develop')
  })

  it('ignores non-typescript code blocks', () => {
    const content = `
\`\`\`javascript
console.log('js')
\`\`\`

\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`

\`\`\`bash
echo "hello"
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    // Should only extract the typescript block
    expect(result.codeBlocks).toHaveLength(1)
    expect(result.codeBlocks[0].language).toBe('typescript')
  })

  it('handles schedule-based workflows', () => {
    const content = `---
name: standup
description: Daily standup
---

\`\`\`typescript
every.day('9am', async () => {
  const ready = await beads.issues.ready()
  await slack.notify('#standup', \`Ready: \${ready.length}\`)
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/standup.mdx')

    expect(result.name).toBe('standup')
    expect(result.source).toContain('every.day')
    expect(result.source).toContain("'9am'")
  })

  it('parses array values in frontmatter', () => {
    const content = `---
name: tagged-workflow
tags: [automation, issues]
---

\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.metadata.tags).toEqual(['automation', 'issues'])
  })

  it('handles enabled: false in frontmatter', () => {
    const content = `---
name: disabled
enabled: false
---

\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.metadata.enabled).toBe(false)
  })

  it('defaults enabled to true', () => {
    const content = `---
name: workflow
---

\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.metadata.enabled).toBe(true)
  })

  it('handles empty file', () => {
    const result = parseWorkflowFile('', '/path/to/empty.mdx')

    expect(result.codeBlocks).toHaveLength(0)
    expect(result.source).toBe('')
    expect(result.name).toBe('empty')
  })

  it('preserves rawContent', () => {
    const content = `---
name: test
---

# Title

Some markdown content.

\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.rawContent).toBe(content)
  })
})
