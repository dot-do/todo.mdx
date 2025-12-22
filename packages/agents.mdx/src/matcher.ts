/**
 * Agent matcher - finds best-fit agent for an issue
 * Scores agents by capability coverage and focus area match
 */

import type { Issue, AgentConfig } from './types'
import { parseRequiredCapabilities, type Capability } from './capabilities'
import { minimatch } from 'minimatch'

/**
 * Agent match result with confidence score
 */
export interface AgentMatch {
  agent: AgentConfig
  confidence: number
  reason: string
}

/**
 * Extract file paths from issue title and description
 * Looks for patterns like:
 * - src/foo/bar.ts
 * - foo.js
 * - README.md
 */
function extractFilePaths(text: string): string[] {
  const paths: string[] = []

  // Match file paths (with or without directory)
  // Patterns: src/foo/bar.ts, foo.js, README.md, etc.
  // Also match paths with forward slashes and dashes
  const filePattern = /[\w\-./]+\.(ts|tsx|js|jsx|md|json|yaml|yml|css|scss|html|py|go|rs|java|c|cpp|h|hpp)\b/gi
  const matches = text.match(filePattern)

  if (matches) {
    paths.push(...matches)
  }

  return paths
}

/**
 * Check if any file paths match focus patterns
 */
function matchesFocusArea(filePaths: string[], focusPatterns: string[]): boolean {
  if (filePaths.length === 0 || focusPatterns.length === 0) {
    return false
  }

  return filePaths.some(path =>
    focusPatterns.some(pattern => minimatch(path, pattern))
  )
}

/**
 * Calculate focus area match score
 * Returns 0-1 based on how well file paths match focus patterns
 */
function calculateFocusScore(filePaths: string[], focusPatterns: string[]): number {
  if (filePaths.length === 0 || focusPatterns.length === 0) {
    return 0
  }

  const matchCount = filePaths.filter(path =>
    focusPatterns.some(pattern => minimatch(path, pattern))
  ).length

  return matchCount / filePaths.length
}

/**
 * Match an issue to the best-fit agent
 *
 * Scoring algorithm:
 * 1. Capability coverage (required ∩ agent): 0-1 score based on % coverage
 * 2. Focus area match (file paths ∩ focus patterns): 0-0.3 bonus
 *
 * @param issue - The issue to match
 * @param agents - Available agent configurations
 * @returns Best match with confidence score, or null if no match
 */
export function matchAgent(issue: Issue, agents: AgentConfig[]): AgentMatch | null {
  if (agents.length === 0) {
    return null
  }

  const requiredCapabilities = parseRequiredCapabilities(issue)

  // No capabilities required = no match
  if (requiredCapabilities.length === 0) {
    return null
  }

  // Extract file paths from issue
  const text = [issue.title, issue.description].filter(Boolean).join(' ')
  const filePaths = extractFilePaths(text)

  let bestMatch: AgentMatch | null = null
  let bestScore = 0

  for (const agent of agents) {
    // Get agent capabilities
    const agentCapabilities = new Set(
      (agent.capabilities || []).map(cap => cap.name as Capability)
    )

    // Agent with no capabilities can't match
    if (agentCapabilities.size === 0) {
      continue
    }

    // Calculate capability coverage
    const coveredCount = requiredCapabilities.filter(cap =>
      agentCapabilities.has(cap)
    ).length

    // If agent doesn't cover ANY required capabilities, skip
    if (coveredCount === 0) {
      continue
    }

    // Base score: percentage of required capabilities covered
    let score = coveredCount / requiredCapabilities.length

    // Focus area scoring (when file paths are mentioned in issue)
    if (filePaths.length > 0) {
      if (agent.focus && agent.focus.length > 0) {
        // Bonus for matching focus patterns (up to +0.5)
        const focusScore = calculateFocusScore(filePaths, agent.focus)
        score += focusScore * 0.5
      } else {
        // Small penalty for agents without focus when files are mentioned
        // This helps specialized agents win over generalists
        score -= 0.1
      }
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score)

    if (score > bestScore) {
      bestScore = score
      bestMatch = {
        agent,
        // Cap confidence at 1.0 for external API
        confidence: Math.min(score, 1.0),
        reason: `Covers ${coveredCount}/${requiredCapabilities.length} required capabilities${
          agent.focus && matchesFocusArea(filePaths, agent.focus)
            ? ' with focus area match'
            : ''
        }`,
      }
    }
  }

  return bestMatch
}
