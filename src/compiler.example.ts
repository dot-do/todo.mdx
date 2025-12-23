/**
 * Example usage of the compiler
 * Run with: npx tsx src/compiler.example.ts
 */

import { compileToString } from './compiler.js'
import type { TodoIssue } from './types.js'

// Sample issues
const issues: TodoIssue[] = [
  {
    id: 'todo-1',
    title: 'Implement user authentication',
    description: 'Add OAuth 2.0 authentication flow',
    status: 'in_progress',
    type: 'feature',
    priority: 0,
    assignee: 'alice',
    labels: ['security', 'backend'],
  },
  {
    id: 'todo-2',
    title: 'Fix login page styling',
    status: 'open',
    type: 'bug',
    priority: 1,
    labels: ['ui', 'urgent'],
  },
  {
    id: 'todo-3',
    title: 'Add dark mode support',
    status: 'open',
    type: 'feature',
    priority: 2,
  },
  {
    id: 'todo-4',
    title: 'Write API documentation',
    status: 'open',
    type: 'task',
    priority: 2,
    assignee: 'bob',
  },
  {
    id: 'todo-5',
    title: 'Setup CI/CD pipeline',
    status: 'closed',
    type: 'task',
    priority: 1,
    closedAt: '2025-12-22T10:00:00Z',
  },
  {
    id: 'todo-6',
    title: 'Initial project setup',
    status: 'closed',
    type: 'task',
    priority: 0,
    closedAt: '2025-12-20T08:00:00Z',
  },
]

// Compile to TODO.md format
const output = compileToString(issues, {
  includeCompleted: true,
  completedLimit: 5,
})

console.log(output)
