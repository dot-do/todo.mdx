import { describe, it, expect } from 'vitest'
import { parseWorkflowFile } from './parser'

describe('parseWorkflowFile', () => {
  it('extracts TypeScript code blocks from MDX', () => {
    const content = `---
name: develop
description: Auto-develop ready issues
trigger: issue.ready
---

# Develop Workflow

Automatically implements ready issues.

\`\`\`typescript
on.issue.ready(async (issue) => {
  const result = await claude.do\`implement \${issue.description}\`
  const pull = await pr.create({ branch: issue.id, title: issue.title, body: result.summary })
  await issues.close(issue.id)
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/develop.mdx')

    expect(result.name).toBe('develop')
    expect(result.metadata.description).toBe('Auto-develop ready issues')
    expect(result.metadata.trigger).toBe('issue.ready')
    expect(result.codeBlocks).toHaveLength(1)
    expect(result.source).toContain('on.issue.ready')
    expect(result.source).toContain('claude.do')
  })

  it('handles ts shorthand', () => {
    const content = `\`\`\`ts
on.issue.closed(async (issue) => {
  console.log('closed:', issue.id)
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.codeBlocks).toHaveLength(1)
    expect(result.codeBlocks[0].language).toBe('ts')
  })

  it('combines multiple code blocks', () => {
    const content = `
\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('ready')
})
\`\`\`

Some documentation...

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

    const result = parseWorkflowFile(content, '/workflows/auto-review.mdx')

    expect(result.name).toBe('auto-review')
  })

  it('ignores non-typescript code blocks', () => {
    const content = `
\`\`\`javascript
console.log('ignored')
\`\`\`

\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`

\`\`\`bash
echo "also ignored"
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.codeBlocks).toHaveLength(1)
    expect(result.codeBlocks[0].language).toBe('typescript')
  })

  it('parses schedule workflows', () => {
    const content = `---
name: standup
trigger: schedule
cron: "0 9 * * 1-5"
---

\`\`\`typescript
every.day('9am', async () => {
  const ready = await issues.ready()
  console.log(\`\${ready.length} issues ready\`)
})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/standup.mdx')

    expect(result.metadata.trigger).toBe('schedule')
    expect(result.metadata.cron).toBe('0 9 * * 1-5')
    expect(result.source).toContain('every.day')
  })

  it('handles enabled: false', () => {
    const content = `---
name: disabled
enabled: false
---

\`\`\`typescript
on.issue.ready(async () => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.metadata.enabled).toBe(false)
  })

  it('defaults enabled to true', () => {
    const content = `\`\`\`typescript
on.issue.ready(async () => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.metadata.enabled).toBe(true)
  })

  it('parses array tags', () => {
    const content = `---
tags: [automation, issues, daily]
---

\`\`\`typescript
every.day('9am', async () => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.metadata.tags).toEqual(['automation', 'issues', 'daily'])
  })

  it('preserves rawContent', () => {
    const content = `---
name: test
---

# Title

\`\`\`typescript
on.issue.ready(async () => {})
\`\`\`
`

    const result = parseWorkflowFile(content, '/path/to/test.mdx')

    expect(result.rawContent).toBe(content)
  })
})
