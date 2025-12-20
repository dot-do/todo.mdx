/**
 * Documentation path exports for agent access
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Path to the docs directory */
export const docsPath = join(__dirname, '..', 'docs')

/** Get path to a specific doc file */
export function getDocPath(name: string): string {
  const filename = name.endsWith('.mdx') ? name : `${name}.mdx`
  return join(docsPath, filename)
}

/** Available documentation files */
export const docFiles = [
  'index.mdx',
  'quick-start.mdx',
  'milestones.mdx',
  'projects.mdx',
  'epics.mdx',
  'sync.mdx',
]
