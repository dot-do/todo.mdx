/**
 * Agent MDX Parser
 * Extracts agent configurations from .mdx files using <Agent> components
 */

import type { AgentConfig, AgentRegistryEntry } from './types'

/** Frontmatter regex */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Parse simple YAML frontmatter */
function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const line of yaml.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: unknown = line.slice(colonIndex + 1).trim()
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (value === 'null' || value === '') value = null
    else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      value = (value as string)
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else if ((value as string).startsWith('"') || (value as string).startsWith("'")) {
      value = (value as string).slice(1, -1)
    } else if (/^\d+$/.test(value as string)) {
      value = parseInt(value as string, 10)
    }
    // Note: Do NOT parse floats - keep them as strings to preserve "1.0" format
    result[key] = value
  }
  return result
}

/** Parsed agents MDX file */
export interface ParsedAgentsMdx {
  /** Original file path */
  path: string
  /** Frontmatter metadata */
  metadata: Record<string, unknown>
  /** Extracted agent configurations */
  agents: AgentRegistryEntry[]
  /** Raw MDX content (for documentation) */
  rawContent: string
}

/**
 * Convert JSX-style object/array to valid JSON
 * - Replaces single quotes with double quotes
 * - Adds quotes around unquoted property names
 */
function jsxToJson(jsxString: string): string {
  // Step 1: Convert single quotes to double quotes
  let result = ''
  let inDoubleQuotes = false

  for (let i = 0; i < jsxString.length; i++) {
    const char = jsxString[i]
    const prevChar = i > 0 ? jsxString[i - 1] : ''

    if (char === '"' && prevChar !== '\\') {
      inDoubleQuotes = !inDoubleQuotes
      result += char
    } else if (char === "'" && prevChar !== '\\') {
      if (!inDoubleQuotes) {
        result += '"'
      } else {
        result += char
      }
    } else {
      result += char
    }
  }

  // Step 2: Quote unquoted property names
  // Match patterns like: { name: "value" } and convert to { "name": "value" }
  result = result.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')

  return result
}

/**
 * Extract a JSON value from JSX prop syntax
 * Handles nested brackets/braces by counting depth
 */
function extractJsonProp(propsString: string, propName: string): any | null {
  const regex = new RegExp(`${propName}=\\{`, 'g')
  const match = regex.exec(propsString)
  if (!match) return null

  const startIndex = match.index + match[0].length
  let depth = 1
  let endIndex = startIndex

  // Find matching closing brace by tracking depth
  for (let i = startIndex; i < propsString.length; i++) {
    const char = propsString[i]
    if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') depth--

    if (depth === 0) {
      endIndex = i
      break
    }
  }

  if (depth !== 0) return null

  const jsxString = propsString.slice(startIndex, endIndex)
  const jsonString = jsxToJson(jsxString)

  try {
    return JSON.parse(jsonString)
  } catch {
    return null
  }
}

/**
 * Extract Agent component props from JSX string
 * Handles JSX prop syntax with JSON-like objects and arrays
 */
function extractAgentProps(jsxString: string): AgentConfig | null {
  // Extract the content between <Agent and />
  const match = jsxString.match(/<Agent\s+([\s\S]*?)\s*\/>/)
  if (!match) return null

  const propsString = match[1]
  const props: Partial<AgentConfig> = {}

  // Extract name (required)
  const nameMatch = propsString.match(/name=["']([^"']+)["']/)
  if (!nameMatch) return null
  props.name = nameMatch[1]

  // Extract string props
  const stringProps = ['autonomy', 'model', 'extends', 'description', 'instructions']
  for (const prop of stringProps) {
    const regex = new RegExp(`${prop}=["']([^"']+)["']`)
    const propMatch = propsString.match(regex)
    if (propMatch) {
      props[prop as keyof AgentConfig] = propMatch[1] as any
    }
  }

  // Extract array/object props using JSON parser
  const focus = extractJsonProp(propsString, 'focus')
  if (focus) props.focus = focus

  const capabilities = extractJsonProp(propsString, 'capabilities')
  if (capabilities) props.capabilities = capabilities

  const triggers = extractJsonProp(propsString, 'triggers')
  if (triggers) props.triggers = triggers

  return props as AgentConfig
}

/**
 * Parse an agents MDX file and extract agent configurations
 */
export function parseAgentsMdx(content: string, filePath: string): ParsedAgentsMdx {
  let metadata: Record<string, unknown> = {}
  let body = content

  // Extract frontmatter
  const frontmatterMatch = content.match(FRONTMATTER_REGEX)
  if (frontmatterMatch) {
    metadata = parseYaml(frontmatterMatch[1])
    body = content.slice(frontmatterMatch[0].length)
  }

  // Extract all <Agent ... /> components
  const agents: AgentRegistryEntry[] = []
  const agentRegex = /<Agent\s+[\s\S]*?\/>/g
  let match: RegExpExecArray | null

  // Reset regex state
  agentRegex.lastIndex = 0

  while ((match = agentRegex.exec(body)) !== null) {
    const agentProps = extractAgentProps(match[0])
    if (agentProps) {
      agents.push(agentProps)
    }
  }

  return {
    path: filePath,
    metadata,
    agents,
    rawContent: content,
  }
}

/** Validation result */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate that all agent capabilities exist in the known tools list
 */
export function validateCapabilities(
  agent: AgentRegistryEntry,
  knownTools: string[]
): ValidationResult {
  const errors: string[] = []

  if (!agent.capabilities || agent.capabilities.length === 0) {
    return { valid: true, errors: [] }
  }

  for (const capability of agent.capabilities) {
    if (!knownTools.includes(capability.name)) {
      errors.push(`Unknown capability: ${capability.name}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Compile agents to JSON format for cloud sync
 */
export function compileAgentsToJson(parsed: ParsedAgentsMdx): string {
  return JSON.stringify(
    {
      metadata: parsed.metadata,
      agents: parsed.agents,
    },
    null,
    2
  )
}
