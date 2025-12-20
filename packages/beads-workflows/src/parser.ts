/**
 * Workflow MDX Parser
 * Extracts TypeScript code from .workflows/*.mdx files
 * and compiles to executable workflow modules
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { existsSync } from 'node:fs'

/** Frontmatter regex */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Fenced code block regex - captures language and content */
const CODE_BLOCK_REGEX = /```(typescript|ts)\s*\n([\s\S]*?)```/g

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
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
    else if (/^\d+\.\d+$/.test(value as string)) value = parseFloat(value as string)
    else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      value = (value as string)
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else if ((value as string).startsWith('"') || (value as string).startsWith("'")) {
      value = (value as string).slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/** Parsed workflow file */
export interface ParsedWorkflow {
  /** Original file path */
  path: string
  /** Workflow name (from filename or frontmatter) */
  name: string
  /** Frontmatter metadata */
  metadata: WorkflowMetadata
  /** Extracted TypeScript code blocks */
  codeBlocks: CodeBlock[]
  /** Combined TypeScript source */
  source: string
  /** Raw MDX content (for documentation) */
  rawContent: string
}

/** Workflow metadata from frontmatter */
export interface WorkflowMetadata {
  /** Workflow name override */
  name?: string
  /** Description */
  description?: string
  /** Whether workflow is enabled */
  enabled?: boolean
  /** Tags for filtering */
  tags?: string[]
  /** Any additional frontmatter fields */
  [key: string]: unknown
}

/** Extracted code block */
export interface CodeBlock {
  /** Language (typescript or ts) */
  language: 'typescript' | 'ts'
  /** Code content */
  content: string
  /** Start position in source */
  startIndex: number
  /** End position in source */
  endIndex: number
}

/**
 * Parse a single workflow MDX file
 */
export function parseWorkflowFile(content: string, filePath: string): ParsedWorkflow {
  let metadata: WorkflowMetadata = { enabled: true }
  let body = content

  // Extract frontmatter
  const frontmatterMatch = content.match(FRONTMATTER_REGEX)
  if (frontmatterMatch) {
    metadata = { enabled: true, ...parseYaml(frontmatterMatch[1]) } as WorkflowMetadata
    body = content.slice(frontmatterMatch[0].length)
  }

  // Extract code blocks
  const codeBlocks: CodeBlock[] = []
  let match: RegExpExecArray | null

  // Reset regex state
  CODE_BLOCK_REGEX.lastIndex = 0

  while ((match = CODE_BLOCK_REGEX.exec(body)) !== null) {
    codeBlocks.push({
      language: match[1] as 'typescript' | 'ts',
      content: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  // Combine all code blocks into single source
  const source = codeBlocks.map(block => block.content).join('\n\n')

  // Derive name from filename or frontmatter
  const filename = basename(filePath, extname(filePath))
  const name = metadata.name || filename

  return {
    path: filePath,
    name,
    metadata,
    codeBlocks,
    source,
    rawContent: content,
  }
}

/**
 * Load and parse all workflow files from a directory
 */
export async function loadWorkflows(workflowsDir: string): Promise<ParsedWorkflow[]> {
  if (!existsSync(workflowsDir)) {
    return []
  }

  const files = await readdir(workflowsDir)
  const workflows: ParsedWorkflow[] = []

  for (const file of files) {
    if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue

    const filePath = join(workflowsDir, file)
    const content = await readFile(filePath, 'utf-8')
    const workflow = parseWorkflowFile(content, filePath)

    // Only include enabled workflows
    if (workflow.metadata.enabled !== false) {
      workflows.push(workflow)
    }
  }

  return workflows
}

/**
 * Find the workflows directory from a base path
 */
export async function findWorkflowsDir(basePath: string): Promise<string | null> {
  const candidates = [
    join(basePath, '.workflows'),
    join(basePath, 'workflows'),
  ]

  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir
    }
  }

  return null
}
