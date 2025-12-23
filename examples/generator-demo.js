/**
 * Demo script for generator functionality
 * Run with: node examples/generator-demo.js
 */
import { generateTodoFile, writeTodoFiles } from '../dist/index.js'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Sample issues to generate
const issues = [
  {
    id: 'todo-001',
    title: 'Implement User Authentication',
    description: 'Add JWT-based authentication system with login, logout, and session management.',
    status: 'in_progress',
    priority: 1,
    type: 'feature',
    labels: ['auth', 'security'],
    assignee: 'john-doe',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T12:30:00Z',
    dependsOn: ['todo-002'],
  },
  {
    id: 'todo-002',
    title: 'Design Database Schema',
    description: 'Create database schema for users, sessions, and permissions tables.',
    status: 'closed',
    priority: 1,
    type: 'task',
    labels: ['database', 'planning'],
    assignee: 'jane-smith',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z',
    closedAt: '2024-01-10T09:00:00Z',
    blocks: ['todo-001'],
  },
  {
    id: 'todo-003',
    title: 'Fix Memory Leak in WebSocket Handler',
    description: 'WebSocket connections are not being properly cleaned up, causing memory to grow over time.',
    status: 'open',
    priority: 0,
    type: 'bug',
    labels: ['websocket', 'urgent', 'performance'],
    createdAt: '2024-01-20T14:22:00Z',
  },
  {
    id: 'todo-004',
    title: 'V2 API Development',
    description: 'Complete overhaul of API with GraphQL, improved error handling, and better documentation.',
    status: 'open',
    priority: 2,
    type: 'epic',
    labels: ['api', 'v2'],
    children: ['todo-005', 'todo-006', 'todo-007'],
    createdAt: '2024-01-05T00:00:00Z',
  },
  {
    id: 'todo-005',
    title: 'Implement GraphQL Schema',
    description: 'Define GraphQL schema for all API resources.',
    status: 'open',
    priority: 2,
    type: 'task',
    labels: ['api', 'graphql'],
    parent: 'todo-004',
    createdAt: '2024-01-05T00:00:00Z',
  },
];

console.log('=== Generator Demo ===\n')

// Demo 1: Generate single todo file
console.log('1. Generating markdown for a single issue:\n')
const singleIssue = issues[0]
const markdown = generateTodoFile(singleIssue)
console.log(markdown)
console.log('\n' + '='.repeat(80) + '\n')

// Demo 2: Write multiple todo files
console.log('2. Writing multiple issues to .todo-demo/ directory...\n')

const demoDir = join(process.cwd(), '.todo-demo')
try {
  mkdirSync(demoDir, { recursive: true })

  writeTodoFiles(issues, demoDir).then(paths => {
    console.log(`Successfully wrote ${paths.length} files:`)
    paths.forEach(path => console.log(`  - ${path}`))
    console.log('\nYou can inspect the generated files in the .todo-demo/ directory')
  }).catch(err => {
    console.error('Error writing files:', err)
  })
} catch (err) {
  console.error('Error creating directory:', err)
}
