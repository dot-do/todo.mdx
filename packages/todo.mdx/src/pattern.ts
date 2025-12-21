/**
 * File pattern parser for .todo/[id]-[title].mdx naming
 */

import type { Issue, FilePattern } from './types.js'
import { ValidationError } from './errors.js'

/** Available variables for file patterns */
const VARIABLE_EXTRACTORS: Record<string, (issue: Issue) => string> = {
  id: (issue) => issue.id,
  title: (issue) => slugify(issue.title),
  type: (issue) => issue.type || 'task',
  state: (issue) => issue.state,
  priority: (issue) => issue.priority !== undefined ? `p${issue.priority}` : 'p2',
  number: (issue) => issue.githubNumber?.toString() || issue.id.split('-').pop() || '',
  prefix: (issue) => issue.id.split('-')[0] || '',
}

/** Slugify a string for use in filenames */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

/** Parse a file pattern template like [id]-[title].mdx */
export function parsePattern(template: string): FilePattern {
  const variables: string[] = []
  let regexStr = '^'
  let lastIndex = 0

  // Match [variable] patterns
  const variableRegex = /\[([a-z]+)\]/g
  let match

  while ((match = variableRegex.exec(template)) !== null) {
    // Add literal text before this variable
    const literal = template.slice(lastIndex, match.index)
    if (literal) {
      regexStr += escapeRegex(literal)
    }

    const varName = match[1]
    if (!VARIABLE_EXTRACTORS[varName]) {
      throw new ValidationError('Unknown variable in pattern', {
        field: 'pattern',
        context: {
          variable: varName,
          availableVariables: Object.keys(VARIABLE_EXTRACTORS),
          template,
        },
      })
    }

    variables.push(varName)

    // Add capture group for this variable
    // Use non-greedy match up to next separator or end
    regexStr += '([^/]+?)'

    lastIndex = match.index + match[0].length
  }

  // Add remaining literal text
  const remaining = template.slice(lastIndex)
  if (remaining) {
    regexStr += escapeRegex(remaining)
  }

  regexStr += '$'

  // Detect separator (character between first two variables)
  let separator = '-'
  if (variables.length >= 2) {
    const firstVarEnd = template.indexOf(']') + 1
    const secondVarStart = template.indexOf('[', firstVarEnd)
    if (secondVarStart > firstVarEnd) {
      separator = template.slice(firstVarEnd, secondVarStart)
    }
  }

  return {
    variables,
    separator,
    regex: new RegExp(regexStr),
    format: (issue: Issue) => {
      let result = template
      for (const varName of variables) {
        const value = VARIABLE_EXTRACTORS[varName](issue)
        result = result.replace(`[${varName}]`, value)
      }
      return result.replace(/\.mdx$/, '.md')
    },
  }
}

/** Extract issue data from a filename using a pattern */
export function extractFromFilename(
  filename: string,
  pattern: FilePattern
): Partial<Issue> | null {
  const match = filename.match(pattern.regex)
  if (!match) return null

  const result: Partial<Issue> = {}

  for (let i = 0; i < pattern.variables.length; i++) {
    const varName = pattern.variables[i]
    const value = match[i + 1]

    switch (varName) {
      case 'id':
        result.id = value
        break
      case 'title':
        // Reverse slugify (best effort)
        result.title = value.replace(/-/g, ' ')
        break
      case 'type':
        result.type = value as Issue['type']
        break
      case 'state':
        result.state = value as Issue['state']
        break
      case 'priority':
        result.priority = parseInt(value.replace(/^p/i, ''), 10)
        break
      case 'number':
        result.githubNumber = parseInt(value, 10)
        break
      case 'prefix':
        // Part of ID, ignore
        break
    }
  }

  return result
}

/** Escape special regex characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Default pattern: [id]-[title].mdx */
export const DEFAULT_PATTERN = '[id]-[title].mdx'
