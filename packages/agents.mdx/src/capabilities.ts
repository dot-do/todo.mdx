/**
 * Capability matching for issue → agent selection
 * Parses issue labels, type, and description to extract required capabilities
 */

import type { Issue } from './types'

/**
 * Agent capabilities
 */
export type Capability = 'code' | 'test' | 'review' | 'docs' | 'security'

/**
 * Mapping from labels to capabilities
 */
const LABEL_TO_CAPABILITY: Record<string, Capability[]> = {
  bug: ['code'],
  feature: ['code'],
  docs: ['docs'],
  documentation: ['docs'],
  security: ['security'],
  test: ['test'],
  testing: ['test'],
}

/**
 * Mapping from issue type to capabilities
 */
const TYPE_TO_CAPABILITY: Record<string, Capability[]> = {
  bug: ['code'],
  feature: ['code'],
}

/**
 * Keywords in title/description that signal required capabilities
 */
const DESCRIPTION_KEYWORDS: Array<{ pattern: RegExp; capability: Capability }> = [
  // Test keywords
  { pattern: /\bwrite tests?\b/i, capability: 'test' },
  { pattern: /\badd tests?\b/i, capability: 'test' },
  { pattern: /\btest coverage\b/i, capability: 'test' },
  { pattern: /\btesting\b/i, capability: 'test' },
  { pattern: /\bunit tests?\b/i, capability: 'test' },
  { pattern: /\bintegration tests?\b/i, capability: 'test' },
  { pattern: /\bupdate tests?\b/i, capability: 'test' },

  // Review keywords
  { pattern: /\bcode review\b/i, capability: 'review' },
  { pattern: /\breview code\b/i, capability: 'review' },
  { pattern: /\breview pr\b/i, capability: 'review' },

  // Docs keywords
  { pattern: /\bdocument\b/i, capability: 'docs' },
  { pattern: /\bdocumentation\b/i, capability: 'docs' },
  { pattern: /\bupdate docs?\b/i, capability: 'docs' },

  // Code keywords
  { pattern: /\bfix\b/i, capability: 'code' },
  { pattern: /\bimplement\b/i, capability: 'code' },
  { pattern: /\brefactor\b/i, capability: 'code' },
  { pattern: /\bdevelop\b/i, capability: 'code' },
]

/**
 * Parse required capabilities from an issue
 *
 * Extracts capabilities from:
 * - Issue labels (bug, feature, docs, security, test)
 * - Issue type (bug, feature)
 * - Title and description keywords (test, review, document, fix, implement)
 *
 * @param issue - The issue to analyze
 * @returns Array of required capabilities (deduplicated)
 */
export function parseRequiredCapabilities(issue: Issue): Capability[] {
  const capabilities = new Set<Capability>()

  // Extract from labels
  if (issue.labels) {
    for (const label of issue.labels) {
      const labelCaps = LABEL_TO_CAPABILITY[label.toLowerCase()]
      if (labelCaps) {
        labelCaps.forEach(cap => capabilities.add(cap))
      }
    }
  }

  // Extract from issue type
  const typeCaps = TYPE_TO_CAPABILITY[issue.type]
  if (typeCaps) {
    typeCaps.forEach(cap => capabilities.add(cap))
  }

  // Extract from title and description
  const text = [issue.title, issue.description].filter(Boolean).join(' ')

  for (const { pattern, capability } of DESCRIPTION_KEYWORDS) {
    if (pattern.test(text)) {
      capabilities.add(capability)
    }
  }

  return Array.from(capabilities)
}
