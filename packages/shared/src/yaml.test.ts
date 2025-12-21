import { describe, it, expect } from 'vitest'
import {
  parseYaml,
  extractFrontmatter,
  serializeYaml,
  createFrontmatter,
  frontmatterHelpers,
  FRONTMATTER_REGEX,
} from './yaml.js'

describe('parseYaml', () => {
  it('should parse scalar values', () => {
    const yaml = `
title: Test Title
count: 42
active: true
disabled: false
empty:
    `.trim()

    const result = parseYaml(yaml)

    expect(result.title).toBe('Test Title')
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
    expect(result.disabled).toBe(false)
    expect(result.empty).toEqual([])
  })

  it('should parse quoted strings', () => {
    const yaml = `
title: "Quoted Title"
desc: 'Single Quoted'
    `.trim()

    const result = parseYaml(yaml)

    expect(result.title).toBe('Quoted Title')
    expect(result.desc).toBe('Single Quoted')
  })

  it('should parse numbers', () => {
    const yaml = `
integer: 123
float: 45.67
    `.trim()

    const result = parseYaml(yaml)

    expect(result.integer).toBe(123)
    expect(result.float).toBe(45.67)
  })

  it('should parse inline arrays', () => {
    const yaml = `
labels: [bug, feature, urgent]
numbers: [1, 2, 3]
    `.trim()

    const result = parseYaml(yaml)

    expect(result.labels).toEqual(['bug', 'feature', 'urgent'])
    expect(result.numbers).toEqual(['1', '2', '3'])
  })

  it('should parse multiline arrays', () => {
    const yaml = `
labels:
  - bug
  - feature
  - urgent
    `.trim()

    const result = parseYaml(yaml)

    expect(result.labels).toEqual(['bug', 'feature', 'urgent'])
  })

  it('should parse empty arrays', () => {
    const yaml = `
labels: []
tags:
    `.trim()

    const result = parseYaml(yaml)

    expect(result.labels).toEqual([])
    expect(result.tags).toEqual([])
  })

  it('should skip comments and empty lines', () => {
    const yaml = `
# This is a comment
title: Test

# Another comment
count: 5
    `.trim()

    const result = parseYaml(yaml)

    expect(result.title).toBe('Test')
    expect(result.count).toBe(5)
    expect(Object.keys(result)).toHaveLength(2)
  })

  it('should handle complex real-world example', () => {
    const yaml = `
id: todo-123
title: "Fix bug in parser"
state: open
priority: 1
type: bug
labels: [bug, critical, p1]
assignees:
  - alice
  - bob
    `.trim()

    const result = parseYaml(yaml)

    expect(result.id).toBe('todo-123')
    expect(result.title).toBe('Fix bug in parser')
    expect(result.state).toBe('open')
    expect(result.priority).toBe(1)
    expect(result.type).toBe('bug')
    expect(result.labels).toEqual(['bug', 'critical', 'p1'])
    expect(result.assignees).toEqual(['alice', 'bob'])
  })
})

describe('extractFrontmatter', () => {
  it('should extract frontmatter and content', () => {
    const content = `---
title: Test
count: 42
---

# Heading

Content here
    `.trim()

    const result = extractFrontmatter(content)

    expect(result.frontmatter.title).toBe('Test')
    expect(result.frontmatter.count).toBe(42)
    expect(result.content.trim()).toBe('# Heading\n\nContent here')
    expect(result.raw).toContain('title: Test')
  })

  it('should handle content without frontmatter', () => {
    const content = `# Heading

Content here
    `.trim()

    const result = extractFrontmatter(content)

    expect(result.frontmatter).toEqual({})
    expect(result.content).toBe(content)
    expect(result.raw).toBe(null)
  })

  it('should handle Windows line endings', () => {
    const content = `---\r\ntitle: Test\r\n---\r\n\r\nContent`

    const result = extractFrontmatter(content)

    expect(result.frontmatter.title).toBe('Test')
    expect(result.content.trim()).toBe('Content')
  })
})

describe('serializeYaml', () => {
  it('should serialize scalar values', () => {
    const data = {
      title: 'Test',
      count: 42,
      active: true,
      disabled: false,
    }

    const result = serializeYaml(data)

    expect(result).toContain('title: Test')
    expect(result).toContain('count: 42')
    expect(result).toContain('active: true')
    expect(result).toContain('disabled: false')
  })

  it('should serialize arrays', () => {
    const data = {
      labels: ['bug', 'feature'],
      empty: [],
    }

    const result = serializeYaml(data)

    expect(result).toContain('labels: [bug, feature]')
    expect(result).toContain('empty: []')
  })

  it('should quote strings with special characters', () => {
    const data = {
      title: 'Title: with colon',
      comment: 'Has # hash',
      quoted: 'Has "quotes"',
    }

    const result = serializeYaml(data)

    expect(result).toContain('title: "Title: with colon"')
    expect(result).toContain('comment: "Has # hash"')
    expect(result).toContain('quoted: "Has \\"quotes\\""')
  })

  it('should handle null and undefined', () => {
    const data = {
      nullValue: null,
      undefinedValue: undefined,
    }

    const result = serializeYaml(data)

    expect(result).toContain('nullValue:')
    expect(result).toContain('undefinedValue:')
  })
})

describe('createFrontmatter', () => {
  it('should create content with frontmatter', () => {
    const data = {
      title: 'Test',
      count: 42,
    }
    const content = '# Heading\n\nContent'

    const result = createFrontmatter(data, content)

    expect(result).toMatch(/^---\n/)
    expect(result).toContain('title: Test')
    expect(result).toContain('count: 42')
    expect(result).toContain('---\n\n# Heading')
  })
})

describe('frontmatterHelpers', () => {
  const fm = {
    title: 'Test',
    count: 42,
    countStr: '99',
    active: true,
    activeStr: 'true',
    labels: ['bug', 'feature'],
    empty: null,
  }

  describe('getString', () => {
    it('should get string values', () => {
      expect(frontmatterHelpers.getString(fm, 'title')).toBe('Test')
      expect(frontmatterHelpers.getString(fm, 'count')).toBe('42')
    })

    it('should return default for missing values', () => {
      expect(frontmatterHelpers.getString(fm, 'missing', 'default')).toBe('default')
      expect(frontmatterHelpers.getString(fm, 'empty', 'default')).toBe('default')
    })
  })

  describe('getNumber', () => {
    it('should get number values', () => {
      expect(frontmatterHelpers.getNumber(fm, 'count')).toBe(42)
      expect(frontmatterHelpers.getNumber(fm, 'countStr')).toBe(99)
    })

    it('should return default for missing or invalid values', () => {
      expect(frontmatterHelpers.getNumber(fm, 'missing', 10)).toBe(10)
      expect(frontmatterHelpers.getNumber(fm, 'title', 10)).toBe(10)
    })
  })

  describe('getBoolean', () => {
    it('should get boolean values', () => {
      expect(frontmatterHelpers.getBoolean(fm, 'active')).toBe(true)
      expect(frontmatterHelpers.getBoolean(fm, 'activeStr')).toBe(true)
    })

    it('should return default for missing values', () => {
      expect(frontmatterHelpers.getBoolean(fm, 'missing', false)).toBe(false)
    })
  })

  describe('getArray', () => {
    it('should get array values', () => {
      expect(frontmatterHelpers.getArray(fm, 'labels')).toEqual(['bug', 'feature'])
    })

    it('should return default for missing values', () => {
      expect(frontmatterHelpers.getArray(fm, 'missing', [])).toEqual([])
    })
  })

  describe('get', () => {
    it('should get raw values', () => {
      expect(frontmatterHelpers.get(fm, 'title')).toBe('Test')
      expect(frontmatterHelpers.get(fm, 'count')).toBe(42)
      expect(frontmatterHelpers.get(fm, 'labels')).toEqual(['bug', 'feature'])
    })

    it('should return default for missing values', () => {
      expect(frontmatterHelpers.get(fm, 'missing', 'default')).toBe('default')
    })
  })
})

describe('FRONTMATTER_REGEX', () => {
  it('should match frontmatter blocks', () => {
    const content = `---
title: Test
---

Content`

    const match = content.match(FRONTMATTER_REGEX)
    expect(match).toBeTruthy()
    expect(match![1]).toContain('title: Test')
  })

  it('should not match incomplete blocks', () => {
    const content = `---
title: Test

Content`

    const match = content.match(FRONTMATTER_REGEX)
    expect(match).toBeFalsy()
  })
})
