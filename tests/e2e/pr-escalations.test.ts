/**
 * Tests for PRDO escalation parsing
 */

import { describe, it, expect } from 'vitest'

/**
 * Parse escalation markers from review comment body
 * (Copied from worker/src/do/pr.ts for testing without Cloudflare deps)
 */
function parseEscalations(body: string): string[] {
  if (!body) return []

  // Match all HTML comments with escalate: prefix
  const escalationRegex = /<!--\s*escalate:\s*([^-]+?)\s*-->/gi
  const matches = [...body.matchAll(escalationRegex)]

  if (matches.length === 0) return []

  // Extract agent names from all matches
  const agents: string[] = []
  for (const match of matches) {
    const agentList = match[1]
    // Split by comma, trim whitespace, filter empty strings
    const agentNames = agentList
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
    agents.push(...agentNames)
  }

  // Remove duplicates
  return [...new Set(agents)]
}

describe('parseEscalations', () => {
  it('returns empty array for empty string', () => {
    expect(parseEscalations('')).toEqual([])
  })

  it('returns empty array for text without escalation markers', () => {
    expect(parseEscalations('This is a regular comment')).toEqual([])
  })

  it('parses single escalation marker', () => {
    const body = 'This needs security review <!-- escalate: sam -->'
    expect(parseEscalations(body)).toEqual(['sam'])
  })

  it('parses multiple agents in single marker', () => {
    const body = 'This needs review <!-- escalate: sam, priya -->'
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('parses multiple escalation markers', () => {
    const body = `
      Security issues <!-- escalate: sam -->
      Product alignment <!-- escalate: priya -->
    `
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('handles whitespace variations', () => {
    const body = '<!-- escalate:sam,priya -->'
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('handles extra whitespace around agent names', () => {
    const body = '<!--  escalate:  sam  ,  priya  -->'
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('removes duplicate agent names', () => {
    const body = `
      <!-- escalate: sam -->
      <!-- escalate: sam, priya -->
    `
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('is case-insensitive for comment syntax but preserves agent names', () => {
    const body = '<!-- ESCALATE: Sam -->'
    expect(parseEscalations(body)).toEqual(['Sam'])
  })

  it('handles complex review body with mixed content', () => {
    const body = `
      ## Review Feedback

      1. The authentication logic looks good
      2. Security concern: password validation is weak <!-- escalate: sam -->
      3. Product alignment needed <!-- escalate: priya -->

      Overall, needs changes before approval.
    `
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('ignores empty agent names', () => {
    const body = '<!-- escalate: , sam, , priya, -->'
    expect(parseEscalations(body)).toEqual(['sam', 'priya'])
  })

  it('handles marker at beginning, middle, and end of comment', () => {
    const bodyStart = '<!-- escalate: sam --> This is a comment'
    const bodyMiddle = 'This is <!-- escalate: sam --> a comment'
    const bodyEnd = 'This is a comment <!-- escalate: sam -->'

    expect(parseEscalations(bodyStart)).toEqual(['sam'])
    expect(parseEscalations(bodyMiddle)).toEqual(['sam'])
    expect(parseEscalations(bodyEnd)).toEqual(['sam'])
  })
})
