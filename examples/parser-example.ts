#!/usr/bin/env node
/**
 * Example: Using the todo.mdx parser
 *
 * This example demonstrates how to:
 * 1. Parse individual .todo/*.md files
 * 2. Load all issues from a directory
 * 3. Access parsed frontmatter and content
 */

import { parseTodoFile, loadTodoFiles } from '../src/parser.js'
import { join } from 'path'

// Example 1: Parse a markdown string
console.log('Example 1: Parse a markdown string\n')

const exampleContent = `---
id: todo-example
title: "Example Issue"
state: in_progress
priority: 3
type: feature
labels: [example, demo]
assignee: alice@example.com
---

# Example Issue

This is an example issue demonstrating the parser.

## Requirements

- Parse YAML frontmatter
- Extract markdown body
- Handle various data types
`

const parsed = parseTodoFile(exampleContent)

console.log('Parsed issue:')
console.log('  ID:', parsed.issue.id)
console.log('  Title:', parsed.issue.title)
console.log('  Status:', parsed.issue.status)
console.log('  Priority:', parsed.issue.priority)
console.log('  Type:', parsed.issue.type)
console.log('  Labels:', parsed.issue.labels)
console.log('  Assignee:', parsed.issue.assignee)
console.log('  Source:', parsed.issue.source)
console.log('\nFrontmatter:', parsed.frontmatter)
console.log('\nContent length:', parsed.content.length, 'chars')

// Example 2: Load all issues from .todo directory
console.log('\n\nExample 2: Load all issues from .todo directory\n')

const todoDir = join(process.cwd(), '.todo')

loadTodoFiles(todoDir)
  .then(issues => {
    console.log(`Loaded ${issues.length} issues from ${todoDir}`)
    console.log('\nFirst 5 issues:')

    issues.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.id}: ${issue.title} [${issue.status}]`)
    })

    // Statistics
    const byStatus = issues.reduce((acc, issue) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\nStatistics:')
    console.log('  By Status:', byStatus)
    console.log('  By Type:', byType)
  })
  .catch(err => {
    console.error('Error loading issues:', err)
  })
