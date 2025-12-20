'use client'

import * as React from 'react'
import { KanbanBoard } from '../../../components/kanban-board'
import { Issue } from '../../../components/issue-card'

// Sample data for demonstration
const sampleIssues: Issue[] = [
  {
    id: 'todo-4fh',
    title: 'Create cli.mdx package - MDX-based CLI framework',
    priority: 1,
    type: 'feature',
    status: 'open',
    labels: ['cli', 'mdx'],
    description: 'Build a CLI framework using Bun and React for MDX-based command-line tools',
  },
  {
    id: 'todo-8mg',
    title: 'Export Payload via Workers RPC',
    priority: 1,
    type: 'task',
    status: 'open',
    labels: ['payload', 'rpc'],
    description: 'Enable Worker to access Payload CMS via RPC binding',
  },
  {
    id: 'todo-3y0',
    title: 'Add shadcn dashboard to Payload app',
    priority: 1,
    type: 'feature',
    status: 'in_progress',
    labels: ['ui', 'dashboard'],
    description: 'Integrate shadcn/ui components for a better dashboard experience',
  },
  {
    id: 'todo-mf4',
    title: 'Integrate shadcn-kanban-board for issue management',
    priority: 2,
    type: 'feature',
    status: 'in_progress',
    labels: ['ui', 'kanban'],
    description: 'Create Kanban board visualization for issue tracking',
  },
  {
    id: 'todo-7kp',
    title: 'Fix authentication bug in WorkOS integration',
    priority: 1,
    type: 'bug',
    status: 'blocked',
    labels: ['auth', 'workos'],
    description: 'Users are getting logged out unexpectedly',
  },
  {
    id: 'todo-2xy',
    title: 'Update documentation for todo.mdx components',
    priority: 3,
    type: 'chore',
    status: 'open',
    labels: ['docs'],
  },
  {
    id: 'todo-9ab',
    title: 'Implement GitHub Issues sync',
    priority: 2,
    type: 'feature',
    status: 'closed',
    labels: ['github', 'sync'],
    description: 'Sync local beads issues with GitHub Issues',
  },
  {
    id: 'todo-5cd',
    title: 'Setup CI/CD pipeline',
    priority: 2,
    type: 'epic',
    status: 'blocked',
    labels: ['devops', 'ci'],
    description: 'Automated testing and deployment pipeline',
  },
]

export default function KanbanPage() {
  const [issues, setIssues] = React.useState<Issue[]>(sampleIssues)

  const handleStatusChange = (issueId: string, newStatus: Issue['status']) => {
    console.log(`Status change: ${issueId} -> ${newStatus}`)

    setIssues((prevIssues) =>
      prevIssues.map((issue) =>
        issue.id === issueId ? { ...issue, status: newStatus } : issue
      )
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Issue Kanban Board
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Drag and drop issues to update their status
        </p>
      </div>

      <KanbanBoard issues={issues} onStatusChange={handleStatusChange} />
    </div>
  )
}
