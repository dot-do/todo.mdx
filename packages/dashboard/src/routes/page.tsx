'use client'

import * as React from 'react'
import { Dashboard } from '../components/dashboard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/card'
import { ProjectsView, type Issue } from '../components/projects'

interface DashboardPageProps {
  path: string
  basePath: string
}

const defaultNavItems = [
  { label: 'Overview', href: '/dashboard', active: true },
  { label: 'Projects', href: '/dashboard/projects' },
  { label: 'Issues', href: '/dashboard/issues' },
  { label: 'Kanban', href: '/dashboard/kanban' },
  { label: 'Gantt', href: '/dashboard/gantt' },
  { label: 'Analytics', href: '/dashboard/analytics' },
  { label: 'Repos', href: '/dashboard/repos' },
  { label: 'Settings', href: '/dashboard/settings' },
]

export function DashboardPage({ path, basePath }: DashboardPageProps) {
  const navItems = defaultNavItems.map(item => ({
    ...item,
    href: item.href.replace('/dashboard', basePath),
    active: item.href === `${basePath}${path ? `/${path}` : ''}`,
  }))

  return (
    <Dashboard nav={navItems} title="Dashboard">
      <DashboardContent path={path} />
    </Dashboard>
  )
}

function DashboardContent({ path }: { path: string }) {
  if (!path || path === '') {
    return <OverviewPage />
  }

  switch (path) {
    case 'projects':
      return <ProjectsPage />
    case 'issues':
      return <IssuesPage />
    case 'analytics':
      return <AnalyticsPage />
    case 'repos':
      return <ReposPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <NotFoundPage path={path} />
  }
}

// Sample issues for demonstration
const sampleIssues: Issue[] = [
  {
    id: 'todo-4fh',
    title: 'Create cli.mdx package - MDX-based CLI framework',
    description: 'Build a CLI framework using Bun and React for MDX-based command-line tools',
    priority: 1,
    type: 'feature',
    status: 'open',
    labels: ['cli', 'mdx'],
  },
  {
    id: 'todo-8mg',
    title: 'Export Payload via Workers RPC',
    description: 'Enable Worker to access Payload CMS via RPC binding',
    priority: 1,
    type: 'task',
    status: 'open',
    labels: ['payload', 'rpc'],
  },
  {
    id: 'todo-3y0',
    title: 'Add shadcn dashboard to Payload app',
    description: 'Integrate shadcn/ui components for a better dashboard experience',
    priority: 1,
    type: 'feature',
    status: 'in_progress',
    labels: ['ui', 'dashboard'],
  },
  {
    id: 'todo-mf4',
    title: 'Integrate shadcn-kanban-board for issue management',
    description: 'Create Kanban board visualization for issue tracking',
    priority: 2,
    type: 'feature',
    status: 'closed',
    labels: ['ui', 'kanban'],
  },
  {
    id: 'todo-7kp',
    title: 'Fix authentication bug in WorkOS integration',
    description: 'Users are getting logged out unexpectedly',
    priority: 1,
    type: 'bug',
    status: 'blocked',
    labels: ['auth', 'workos'],
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
    description: 'Sync local beads issues with GitHub Issues',
    priority: 2,
    type: 'feature',
    status: 'closed',
    labels: ['github', 'sync'],
  },
  {
    id: 'todo-5cd',
    title: 'Setup CI/CD pipeline',
    description: 'Automated testing and deployment pipeline',
    priority: 2,
    type: 'epic',
    status: 'in_progress',
    labels: ['devops', 'ci'],
  },
]

function ProjectsPage() {
  const [issues, setIssues] = React.useState<Issue[]>(sampleIssues)

  const handleStatusChange = (issueId: string, newStatus: Issue['status']) => {
    console.log(`Status change: ${issueId} -> ${newStatus}`)
    setIssues(prev => prev.map(issue =>
      issue.id === issueId ? { ...issue, status: newStatus } : issue
    ))
  }

  const handleIssueClick = (issue: Issue) => {
    console.log('Issue clicked:', issue)
  }

  return (
    <ProjectsView
      issues={issues}
      onStatusChange={handleStatusChange}
      onIssueClick={handleIssueClick}
    />
  )
}

function OverviewPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Overview</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Issues" value="—" description="Across all repos" />
        <StatCard title="Open Issues" value="—" description="Requiring attention" />
        <StatCard title="Repos" value="—" description="Connected repositories" />
        <StatCard title="Sync Status" value="—" description="Last synced" />
      </div>
    </div>
  )
}

function StatCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </CardContent>
    </Card>
  )
}

function IssuesPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Issues</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">
            Connect your todo.mdx API to view issues.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">
            Analytics charts coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ReposPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Repositories</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">
            Connect your todo.mdx API to view repositories.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">
            Dashboard settings will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function NotFoundPage({ path }: { path: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Not Found</h2>
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">
            The page &quot;{path}&quot; does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
