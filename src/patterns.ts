/**
 * Pattern parsing and filename matching for todo.mdx
 *
 * Supports patterns like:
 * - "[id]-[title].md"
 * - "[type]/[id].md"
 * - "[yyyy-mm-dd] [Title].md"
 */

import type { TodoIssue } from './types.js'

export interface PatternToken {
  type: 'literal' | 'variable'
  value: string
  transform: 'slugify' | 'preserve' | 'capitalize'
}

/**
 * Parse a filename pattern into tokens
 *
 * @param pattern - Pattern string like "[id]-[title].md"
 * @returns Array of pattern tokens
 */
export function parsePattern(pattern: string): PatternToken[] {
  const tokens: PatternToken[] = []
  let currentLiteral = ''
  let i = 0

  while (i < pattern.length) {
    if (pattern[i] === '[') {
      // Save any accumulated literal
      if (currentLiteral) {
        tokens.push({ type: 'literal', value: currentLiteral, transform: 'preserve' })
        currentLiteral = ''
      }

      // Find closing bracket
      const closeIndex = pattern.indexOf(']', i)
      if (closeIndex === -1) {
        throw new Error(`Unclosed bracket at position ${i} in pattern: ${pattern}`)
      }

      const tokenValue = pattern.slice(i + 1, closeIndex)

      // Determine transform based on:
      // 1. Capitalization of token name
      // 2. Delimiter character before token
      let transform: 'slugify' | 'preserve' | 'capitalize' = 'preserve'

      // Check if first character is uppercase (e.g., [Title])
      const isCapitalized = tokenValue.length > 0 && tokenValue[0] === tokenValue[0].toUpperCase() && tokenValue[0] !== tokenValue[0].toLowerCase()

      if (isCapitalized) {
        transform = 'capitalize'
      } else if (tokens.length > 0) {
        // Check delimiter context (last character of previous literal)
        const lastToken = tokens[tokens.length - 1]
        if (lastToken.type === 'literal' && lastToken.value) {
          const delimiter = lastToken.value[lastToken.value.length - 1]
          if (delimiter === '-') {
            transform = 'slugify'
          } else if (delimiter === ' ') {
            transform = 'preserve'
          }
        }
      }

      // Normalize token value to lowercase
      const normalizedValue = tokenValue.toLowerCase()

      tokens.push({ type: 'variable', value: normalizedValue, transform })
      i = closeIndex + 1
    } else {
      currentLiteral += pattern[i]
      i++
    }
  }

  // Save any remaining literal
  if (currentLiteral) {
    tokens.push({ type: 'literal', value: currentLiteral, transform: 'preserve' })
  }

  return tokens
}

/**
 * Extract issue ID from filename using a pattern
 *
 * @param filename - The filename to extract from
 * @param pattern - The pattern to match against
 * @returns The extracted ID or null if pattern doesn't match or no [id] token
 */
export function extractIdFromFilename(filename: string, pattern: string): string | null {
  // Parse the pattern into tokens
  const tokens = parsePattern(pattern)

  // Check if pattern contains [id] token
  const hasIdToken = tokens.some(token => token.type === 'variable' && token.value === 'id')
  if (!hasIdToken) {
    return null
  }

  // Build regex from pattern
  let regexPattern = ''
  let idCaptureIndex = 0
  let currentCapture = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'literal') {
      // Escape special regex characters in literals
      regexPattern += token.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    } else {
      // Variable - create appropriate regex pattern
      if (token.value === 'id') {
        // Capture the ID
        // Check if there's a title token later in the pattern
        const hasTitleAfter = tokens.slice(i + 1).some(t => t.type === 'variable' && t.value === 'title')

        idCaptureIndex = currentCapture

        if (hasTitleAfter) {
          // If there's a title after the ID, use strict format: prefix-suffix (3-4 chars)
          // This matches: todo-abc, todo-8txa (but not todo-abc-add when followed by title)
          regexPattern += '([\\w]+-[\\w]{3,4})'
        } else {
          // No title after ID, so match more liberally to handle multi-segment IDs
          // This matches: todo-bug-123, todo-feature-xyz, etc.
          regexPattern += '([\\w-]+)'
        }
        currentCapture++
      } else if (token.value === 'title') {
        // Title can contain dashes, spaces, etc but not slashes (path separators)
        // Use non-capturing group and match greedily to consume the title
        regexPattern += '(?:[^/]+)'
      } else if (token.value === 'yyyy-mm-dd') {
        // Date pattern
        regexPattern += '\\d{4}-\\d{2}-\\d{2}'
      } else {
        // Generic token (type, priority, assignee, etc.)
        // Match word characters, dashes, underscores
        regexPattern += '[\\w-]+'
      }
    }
  }

  // Anchor the regex to match the entire filename
  regexPattern = '^' + regexPattern + '$'

  try {
    const regex = new RegExp(regexPattern)
    const match = filename.match(regex)

    if (!match) {
      return null
    }

    // Extract the ID from the appropriate capture group
    // Note: match[0] is the full match, capture groups start at match[1]
    return match[idCaptureIndex + 1] || null
  } catch (error) {
    // Invalid regex pattern
    return null
  }
}

/**
 * Apply a pattern to an issue to generate a filename
 *
  let skipNextLiteral = false

 * @param pattern - The pattern to apply (e.g., "[id]-[title].md")
 * @param issue - The issue to generate filename for
 * @param existingFiles - Optional list of existing files to avoid collisions
 * @returns The generated filename
 */
export function applyPattern(pattern: string, issue: TodoIssue, existingFiles?: string[]): string {
  const tokens = parsePattern(pattern)
  let result = ''
  let previousToken: PatternToken | null = null
  let skipNextLiteral = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'literal') {
      // If previous variable token was empty, check if we should skip this literal
      if (skipNextLiteral) {
        // Check if this literal is just a delimiter
        const isDelimiter = token.value.length === 1 && ['-', ' ', '/'].includes(token.value)
        if (isDelimiter) {
          skipNextLiteral = false
          previousToken = token
          continue
        }
        skipNextLiteral = false
      }
      result += token.value
      previousToken = token
    } else {
      // Variable token - resolve from issue
      const value = resolveToken(token.value, issue)

      // Skip empty values and their preceding delimiter
      if (!value) {
        // Remove trailing delimiter if this token is empty
        if (previousToken?.type === 'literal' && result.length > 0) {
          const delimiter = previousToken.value[previousToken.value.length - 1]
          if (delimiter === '-' || delimiter === ' ' || delimiter === '/') {
            result = result.slice(0, -1)
          }
        }
        // Mark to skip next literal if it's a delimiter
        skipNextLiteral = true
        previousToken = token
        continue
      }

      // Apply transformation
      const transformed = applyTransform(value, token.transform)

      // Truncate if needed (only for title tokens)
      if (token.value === 'title') {
        result += truncateToWordBoundary(transformed, 100)
      } else {
        result += transformed
      }

      skipNextLiteral = false
      previousToken = token
    }
  }

  // Handle collisions if existingFiles provided
  if (existingFiles && existingFiles.length > 0) {
    result = handleCollision(result, existingFiles)
  }

  return result
}

/**
 * Resolve a token value from an issue
 */
function resolveToken(tokenName: string, issue: TodoIssue): string {
  switch (tokenName) {
    case 'id':
      return issue.id
    case 'title':
      return issue.title
    case 'type':
      return issue.type
    case 'priority':
      return String(issue.priority)
    case 'assignee':
      return issue.assignee ? extractUsername(issue.assignee) : ''
    case 'yyyy-mm-dd':
      return formatDate(issue.createdAt)
    default:
      return ''
  }
}

/**
 * Apply transformation to a value
 */
function applyTransform(value: string, transform: 'slugify' | 'preserve' | 'capitalize'): string {
  switch (transform) {
    case 'slugify':
      return slugify(value)
    case 'capitalize':
      return capitalize(value)
    case 'preserve':
      return cleanForFilename(value)
    default:
      return value
  }
}

/**
 * Slugify a string for use in filenames (dash-separated, lowercase)
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\//g, '-') // Replace slashes with dashes (must be before other replacements)
    .replace(/[^\w\s.-]/g, '') // Remove special chars except word chars, spaces, dots, dashes
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, '') // Remove leading/trailing dashes
}

/**
 * Capitalize the first letter of each word
 */
function capitalize(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s.-]/g, '') // Remove special chars
    .trim()
}

/**
 * Clean text for filename while preserving spaces
 */
function cleanForFilename(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s.-]/g, '') // Remove special chars except word chars, spaces, dots, dashes
    .replace(/\//g, '-') // Replace slashes with dashes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
}

/**
 * Truncate text to a maximum length, preferring word boundaries
 */
function truncateToWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  // Truncate to maxLength
  let truncated = text.slice(0, maxLength)

  // Try to find a word boundary (space or dash) to truncate at
  const lastSpace = truncated.lastIndexOf(' ')
  const lastDash = truncated.lastIndexOf('-')
  const lastBoundary = Math.max(lastSpace, lastDash)

  // If we found a word boundary and it's not too far back, use it
  if (lastBoundary > maxLength * 0.7) {
    truncated = truncated.slice(0, lastBoundary)
  }

  // Clean up any trailing delimiters
  return truncated.replace(/[-\s]+$/, '')
}

/**
 * Extract username from email address
 */
function extractUsername(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex > 0) {
    return email.slice(0, atIndex)
  }
  return email
}

/**
 * Format date as yyyy-mm-dd
 */
function formatDate(dateString?: string): string {
  const date = dateString ? new Date(dateString) : new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Handle filename collision by appending -1, -2, etc.
 */
function handleCollision(filename: string, existingFiles: string[]): string {
  if (!existingFiles.includes(filename)) {
    return filename
  }

  // Extract base name and extension
  const lastDotIndex = filename.lastIndexOf('.')
  const baseName = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename
  const extension = lastDotIndex > 0 ? filename.slice(lastDotIndex) : ''

  // Try adding -1, -2, -3, etc.
  let counter = 1
  let candidateFilename = `${baseName}-${counter}${extension}`

  while (existingFiles.includes(candidateFilename)) {
    counter++
    candidateFilename = `${baseName}-${counter}${extension}`
  }

  return candidateFilename
}
