import { describe, it, expect, vi } from 'vitest'
import { compileWorkflow, compileWorkflows, executeWorkflow, wrapWorkflowSource } from './compiler'
import { parseWorkflowFile } from './parser'
import type { WorkflowRuntime, Repo } from './types'

// Mock runtime for testing
function createMockRuntime(): WorkflowRuntime {
  const mockRepo: Repo = {
    owner: 'test',
    name: 'repo',
    defaultBranch: 'main',
    url: 'https://github.com/test/repo',
  }

  return {
    repo: mockRepo,
    issue: undefined,
    claude: {
      do: vi.fn(),
      research: vi.fn(),
      review: vi.fn(),
      ask: vi.fn(),
    } as any,
    pr: {} as any,
    issues: {} as any,
    epics: {} as any,
    git: {} as any,
    todo: {} as any,
    dag: {} as any,
  }
}

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
    expect(compiled.source).toContain("name: 'develop'")
  })

  it('compiles a workflow with schedule', () => {
    const content = `\`\`\`typescript
every.day('9am', async () => {
  console.log('Daily task')
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/daily.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(true)
    expect(compiled.source).toContain('every.day')
  })

  it('fails for workflow with no handlers', () => {
    const content = `\`\`\`typescript
const x = 1
console.log(x)
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/empty.mdx')
    const compiled = compileWorkflow(parsed)

    expect(compiled.success).toBe(false)
    expect(compiled.errors.some(e => e.message.includes('event handler'))).toBe(true)
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
})

describe('compileWorkflows', () => {
  it('compiles multiple workflows', () => {
    const workflows = [
      parseWorkflowFile(`\`\`\`typescript\non.issue.ready(async () => {})\n\`\`\``, '/first.mdx'),
      parseWorkflowFile(`\`\`\`typescript\nevery.day('9am', async () => {})\n\`\`\``, '/second.mdx'),
    ]

    const compiled = compileWorkflows(workflows)

    expect(compiled).toHaveLength(2)
    expect(compiled.every(c => c.success)).toBe(true)
  })
})

describe('executeWorkflow', () => {
  it('returns registration with handlers', () => {
    const content = `\`\`\`typescript
on.issue.ready(async (issue) => {
  console.log('Handler 1:', issue.id)
})

on.issue.ready(async (issue) => {
  console.log('Handler 2:', issue.id)
})

on.issue.closed(async (issue) => {
  console.log('Closed:', issue.id)
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/test.mdx')
    const compiled = compileWorkflow(parsed)
    const runtime = createMockRuntime()

    const registration = executeWorkflow(compiled, runtime)

    expect(registration).not.toBeNull()
    expect(registration!.name).toBe('test')
    expect(registration!.handlers['issue.ready']).toHaveLength(2)
    expect(registration!.handlers['issue.closed']).toHaveLength(1)
  })

  it('returns registration with schedules', () => {
    const content = `\`\`\`typescript
every.day('9am', async () => {
  console.log('Morning')
})

every.hour(async () => {
  console.log('Hourly')
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/scheduled.mdx')
    const compiled = compileWorkflow(parsed)
    const runtime = createMockRuntime()

    const registration = executeWorkflow(compiled, runtime)

    expect(registration).not.toBeNull()
    expect(registration!.schedules).toHaveLength(2)
    expect(registration!.schedules[0].cron).toBe('0 9 * * *')
    expect(registration!.schedules[1].cron).toBe('0 * * * *')
  })

  it('returns null for failed compilation', () => {
    const content = `# No code blocks here`
    const parsed = parseWorkflowFile(content, '/path/to/empty.mdx')
    const compiled = compileWorkflow(parsed)
    const runtime = createMockRuntime()

    const registration = executeWorkflow(compiled, runtime)

    expect(registration).toBeNull()
  })

  it('makes runtime available to handler code', () => {
    const content = `\`\`\`typescript
on.issue.ready(async (issue) => {
  // repo should be available from runtime
  console.log('Repo:', repo.owner, repo.name)
})
\`\`\`
`
    const parsed = parseWorkflowFile(content, '/path/to/test.mdx')
    const compiled = compileWorkflow(parsed)
    const runtime = createMockRuntime()

    // Should not throw - runtime globals should be available
    const registration = executeWorkflow(compiled, runtime)

    expect(registration).not.toBeNull()
    expect(registration!.handlers['issue.ready']).toHaveLength(1)
  })
})

describe('wrapWorkflowSource', () => {
  it('creates a registrar function', () => {
    const source = `on.issue.ready(async (issue) => {})`
    const wrapped = wrapWorkflowSource(source, 'test-workflow')

    expect(wrapped).toContain("name: 'test-workflow'")
    expect(wrapped).toContain('return function registerWorkflow(runtime)')
    expect(wrapped).toContain('return registration')
    expect(wrapped).toContain(source)
  })

  it('includes handler registration code', () => {
    const source = `on.issue.ready(async () => {})`
    const wrapped = wrapWorkflowSource(source, 'test')

    expect(wrapped).toContain("registration.handlers['issue.ready'].push(handler)")
    expect(wrapped).toContain("registration.handlers['issue.closed'].push(handler)")
    expect(wrapped).toContain('registration.schedules.push')
  })
})
