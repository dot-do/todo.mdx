import type { GitHubConventions } from './conventions'

/**
 * Parsed convention data from GitHub issue body
 */
export interface ParsedConventions {
  dependsOn: string[]   // Issue numbers extracted (e.g., ['123', '456'])
  blocks: string[]      // Issue numbers this blocks
  parent?: string       // Parent issue number
}

/**
 * Extract issue number from various formats:
 * - #123
 * - https://github.com/owner/repo/issues/123
 */
function extractIssueNumber(ref: string): string | null {
  // Try URL format first
  const urlMatch = ref.match(/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/)
  if (urlMatch) {
    return urlMatch[1]
  }

  // Try simple #123 format
  const hashMatch = ref.match(/#(\d+)/)
  if (hashMatch) {
    return hashMatch[1]
  }

  return null
}

/**
 * Extract all issue numbers from a matched string using separator
 * Also handles line breaks and continuation of the list on subsequent lines
 */
function extractIssueNumbers(matchedText: string, separator: string): string[] {
  const issueNumbers: string[] = []

  // Escape special regex characters in separator
  const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Split by separator or newlines
  const parts = matchedText.split(new RegExp(`${escapedSeparator}|\\n`))

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const issueNum = extractIssueNumber(trimmed)
    if (issueNum) {
      issueNumbers.push(issueNum)
    }
  }

  return issueNumbers
}

/**
 * Extract content after a pattern, including continuation on next lines
 * Captures content until we hit an empty line or new heading
 */
function extractMultilineContent(body: string, pattern: string): string[] {
  const results: string[] = []
  const regex = new RegExp(pattern, 'gmi')
  let match: RegExpExecArray | null

  while ((match = regex.exec(body)) !== null) {
    let content = match[1] || ''
    const startPos = match.index + match[0].length

    // Look for continuation on next lines
    const restOfBody = body.substring(startPos)
    const lines = restOfBody.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Skip empty lines at the start, but stop on empty lines later
      if (!trimmed) {
        if (i === 0) {
          continue  // Skip leading empty line
        } else {
          break  // Stop on empty line after content
        }
      }

      // Stop if we hit a new heading/section marker
      if (line.match(/^#{1,6}\s/) || line.match(/^[A-Z][a-z]+:/)) {
        break
      }

      // If this is a continuation line (starts with - or has issue refs), add it
      if (line.match(/^\s*[-*]\s*#?\d+/) || line.match(/#\d+/) || line.match(/github\.com/)) {
        content += '\n' + line
      } else {
        // Stop if line doesn't look like a continuation
        break
      }
    }

    results.push(content)
  }

  return results
}

/**
 * Parse GitHub issue body to extract dependency references, blocks references,
 * and parent/epic references using configurable patterns.
 */
export function parseIssueBody(
  body: string | null,
  conventions: GitHubConventions
): ParsedConventions {
  if (!body) {
    return {
      dependsOn: [],
      blocks: [],
      parent: undefined,
    }
  }

  const result: ParsedConventions = {
    dependsOn: [],
    blocks: [],
    parent: undefined,
  }

  // Parse dependencies
  if (conventions.dependencies.pattern) {
    const matches = extractMultilineContent(body, conventions.dependencies.pattern)
    for (const matchedText of matches) {
      const issueNumbers = extractIssueNumbers(
        matchedText,
        conventions.dependencies.separator
      )
      result.dependsOn.push(...issueNumbers)
    }
  }

  // Parse blocks
  if (conventions.dependencies.blocksPattern) {
    const matches = extractMultilineContent(body, conventions.dependencies.blocksPattern)
    for (const matchedText of matches) {
      const issueNumbers = extractIssueNumbers(
        matchedText,
        conventions.dependencies.separator
      )
      result.blocks.push(...issueNumbers)
    }
  }

  // Parse parent/epic
  if (conventions.epics.bodyPattern) {
    // First try to match with the pattern
    const epicPattern = new RegExp(conventions.epics.bodyPattern, 'm')
    const match = epicPattern.exec(body)

    if (match) {
      // Check if the pattern captured a group (e.g., #(\d+))
      if (match[1]) {
        result.parent = match[1]
      } else {
        // If no capture group, try to extract from the full match
        const issueNum = extractIssueNumber(match[0])
        if (issueNum) {
          result.parent = issueNum
        }
      }
    } else {
      // Try a more flexible pattern that handles URLs
      // Look for "Parent: <issue ref>" where ref can be #123 or URL
      const flexiblePattern = /Parent:\s*(.+?)(?:\n|$)/i
      const flexMatch = flexiblePattern.exec(body)
      if (flexMatch) {
        const issueNum = extractIssueNumber(flexMatch[1].trim())
        if (issueNum) {
          result.parent = issueNum
        }
      }
    }
  }

  // Deduplicate arrays
  result.dependsOn = [...new Set(result.dependsOn)]
  result.blocks = [...new Set(result.blocks)]

  return result
}
