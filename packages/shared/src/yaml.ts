/**
 * Shared YAML parser utility for MDX frontmatter
 * Handles YAML frontmatter extraction and parsing with support for:
 * - Scalar values (string, number, boolean, null)
 * - Inline arrays: [item1, item2]
 * - Multiline arrays with - item syntax
 * - Proper TypeScript types
 */

/** YAML frontmatter regex */
export const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Parsed YAML result */
export interface ParsedYaml {
  [key: string]: unknown
}

/** Frontmatter extraction result */
export interface FrontmatterResult {
  /** Parsed frontmatter data */
  frontmatter: ParsedYaml
  /** Content after frontmatter */
  content: string
  /** Raw frontmatter string */
  raw: string | null
}

/**
 * Parse YAML string into key-value pairs
 * Supports:
 * - Scalar values: key: value
 * - Boolean: key: true/false
 * - Numbers: key: 123
 * - Null/empty: key: null or key:
 * - Inline arrays: key: [item1, item2]
 * - Multiline arrays:
 *     key:
 *       - item1
 *       - item2
 */
export function parseYaml(yaml: string): ParsedYaml {
  const result: ParsedYaml = {}
  const lines = yaml.split('\n')
  let currentKey: string | null = null
  let currentArray: string[] | null = null

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Check for array item (starts with -)
    if (line.trim().startsWith('- ') && currentKey && currentArray) {
      currentArray.push(line.trim().slice(2).trim())
      continue
    }

    // Save previous array if we're moving to a new key
    if (currentKey && currentArray) {
      result[currentKey] = currentArray
      currentKey = null
      currentArray = null
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()

    // Check if this starts an array (empty after colon, or explicit [])
    if (value === '' || value === '[]') {
      currentKey = key
      currentArray = []
      continue
    }

    // Inline array: [item1, item2]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
      result[key] = value
      continue
    }

    // Parse scalar values
    if (value === 'true') {
      value = true
    } else if (value === 'false') {
      value = false
    } else if (value === 'null') {
      value = null
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
      value = parseInt(value, 10)
    } else if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
      value = parseFloat(value)
    } else if (typeof value === 'string' && (value.startsWith('"') || value.startsWith("'"))) {
      // Remove quotes
      value = value.slice(1, -1)
    }

    result[key] = value
  }

  // Save final array if any
  if (currentKey && currentArray) {
    result[currentKey] = currentArray
  }

  return result
}

/**
 * Extract frontmatter from content
 * Returns parsed frontmatter and remaining content
 */
export function extractFrontmatter(content: string): FrontmatterResult {
  const match = content.match(FRONTMATTER_REGEX)

  if (!match) {
    return {
      frontmatter: {},
      content,
      raw: null,
    }
  }

  const raw = match[1]
  const frontmatter = parseYaml(raw)
  const remainingContent = content.slice(match[0].length)

  return {
    frontmatter,
    content: remainingContent,
    raw,
  }
}

/**
 * Serialize frontmatter back to YAML string
 * Useful for writing files with frontmatter
 */
export function serializeYaml(data: ParsedYaml): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      lines.push(`${key}:`)
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`)
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`)
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        // Use inline array format for simplicity
        const serialized = value.map(v => {
          if (typeof v === 'string' && (v.includes(',') || v.includes(' '))) {
            return `"${v}"`
          }
          return v
        }).join(', ')
        lines.push(`${key}: [${serialized}]`)
      }
    } else if (typeof value === 'string') {
      // Quote strings that contain special characters
      if (value.includes(':') || value.includes('#') || value.includes('"')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
      } else {
        lines.push(`${key}: ${value}`)
      }
    } else {
      lines.push(`${key}: ${value}`)
    }
  }

  return lines.join('\n')
}

/**
 * Create frontmatter block from data
 * Returns content with frontmatter prepended
 */
export function createFrontmatter(data: ParsedYaml, content: string): string {
  const yaml = serializeYaml(data)
  return `---\n${yaml}\n---\n\n${content}`
}

/**
 * Type-safe frontmatter field extraction helpers
 */
export const frontmatterHelpers = {
  /** Get string field */
  getString(fm: ParsedYaml, key: string, defaultValue?: string): string | undefined {
    const value = fm[key]
    if (value === undefined || value === null) return defaultValue
    return String(value)
  },

  /** Get number field */
  getNumber(fm: ParsedYaml, key: string, defaultValue?: number): number | undefined {
    const value = fm[key]
    if (value === undefined || value === null) return defaultValue
    if (typeof value === 'number') return value
    const parsed = Number(value)
    return isNaN(parsed) ? defaultValue : parsed
  },

  /** Get boolean field */
  getBoolean(fm: ParsedYaml, key: string, defaultValue?: boolean): boolean | undefined {
    const value = fm[key]
    if (value === undefined || value === null) return defaultValue
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    return defaultValue
  },

  /** Get array field */
  getArray(fm: ParsedYaml, key: string, defaultValue?: string[]): string[] | undefined {
    const value = fm[key]
    if (value === undefined || value === null) return defaultValue
    if (Array.isArray(value)) return value.map(String)
    return defaultValue
  },

  /** Get raw value */
  get(fm: ParsedYaml, key: string, defaultValue?: unknown): unknown {
    const value = fm[key]
    return value === undefined ? defaultValue : value
  },
}
