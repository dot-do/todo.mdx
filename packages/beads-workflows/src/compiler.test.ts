import { describe, it, expect } from 'vitest'
import { compileWorkflow, compileWorkflows, createHandlerRegistry, wrapWorkflowSource } from './compiler.js'
import { parseWorkflowFile } from './parser.js'

describe('compileWorkflow', () => {
  it('compiles a valid workflow with event handler', () => {
    const content = `---
name: develop
---

\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('Ready:', issue.id)
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/develop.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(true)
    expect(compiled.errors).toHaveLength(0)
    expect(compiled.name).toBe('develop')
    expect(compiled.source).toContain('on.issue.ready')
    expect(compiled.source).toContain('Compiled workflow: develop')
  })

  it('compiles a workflow with schedule', () => {
    const content = `---
name: standup
---

\`\`\`typescript
every.day('9am', async () => {
  console.log('Standup time')
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/standup.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(true)
    expect(compiled.errors).toHaveLength(0)
    expect(compiled.source).toContain('every.day')
  })

  it('fails for workflow with no handlers', () => {
    const content = `---
name: empty
---

\`\`\`typescript
const x = 1
console.log(x)
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/empty.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(false)
    expect(compiled.errors.length).toBeGreaterThan(0)
    expect(compiled.errors[0].message).toContain('event handler')
  })

  it('fails for workflow with no code blocks', () => {
    const content = `---
name: docs-only
---

# Just Documentation

This file has no code.
`
    const parsed = parseWorkflowFile(content, '/path/to/docs.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(false)
    expect(compiled.errors).toContainEqual({ message: 'No TypeScript code blocks found in workflow' })
  })

  it('detects unbalanced braces', () => {
    const content = `\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('missing close brace')

\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/broken.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(false)
    expect(compiled.errors.some(e => e.message.includes('braces'))).toBe(true)
  })

  it('detects unbalanced parentheses', () => {
    const content = `\`\`\`typescript
on.issue.ready(async (issue => {
  console.log('missing paren')
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/broken.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(false)
    expect(compiled.errors.some(e => e.message.includes('parentheses'))).toBe(true)
  })

  it('compiles multiple handlers in one workflow', () => {
    const content = `---
name: multi
---

\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('ready')
})
\`\`\`

\`\`\`typescript
on.issue.closed(async (issue) => {
  console.log('closed')
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/multi.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(true)
    expect(compiled.source).toContain('on.issue.ready')
    expect(compiled.source).toContain('on.issue.closed')
  })
})

describe('compileWorkflows', () => {
  it('compiles multiple workflows', () => {
    const content1 = `\`\`\`typescript
on.issue.ready(async (issue) => {})
\`\`\`
`
    const content2 = `\`\`\`typescript
every.day('9am', async () => {})
\`\`\`
`
    const parsed1 = parseWorkflowFile(content1, '/path/to/first.mdx')
    const parsed2 = parseWorkflowFile(content2, '/path/to/second.mdx')

    const compiled = compileWorkflows([parsed1, parsed2])

    expect(compiled).toHaveLength(2)
    expect(compiled[0].name).toBe('first')
    expect(compiled[1].name).toBe('second')
    expect(compiled.every(c => c.success)).toBe(true)
  })
})

describe('createHandlerRegistry', () => {
  it('creates empty registry with all handler types', () => {
    const registry = createHandlerRegistry()

    expect(registry.issue.ready).toEqual([])
    expect(registry.issue.created).toEqual([])
    expect(registry.issue.updated).toEqual([])
    expect(registry.issue.closed).toEqual([])
    expect(registry.issue.blocked).toEqual([])
    expect(registry.issue.reopened).toEqual([])
    expect(registry.epic.completed).toEqual([])
    expect(registry.epic.progress).toEqual([])
    expect(registry.schedule.day).toEqual([])
    expect(registry.schedule.hour).toEqual([])
    expect(registry.schedule.minute).toEqual([])
    expect(registry.schedule.week).toEqual([])
  })
})

describe('wrapWorkflowSource', () => {
  it('wraps source with handler registration code', () => {
    const source = `on.issue.ready(async (issue) => {})`
    const wrapped = wrapWorkflowSource(source, 'test-workflow')

    expect(wrapped).toContain('Compiled workflow: test-workflow')
    expect(wrapped).toContain('handlers.issue.ready.push(handler)')
    expect(wrapped).toContain('globalThis.on = on')
    expect(wrapped).toContain('globalThis.every = every')
    expect(wrapped).toContain(source)
  })
})
