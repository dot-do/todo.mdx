import * as React from 'react'
import { Dashboard } from '../components/dashboard'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/card'

interface DashboardPageProps {
  path: string
  basePath: string
}

const defaultNavItems = [
  { label: 'Overview', href: '/dashboard', active: true },
  { label: 'Issues', href: '/dashboard/issues' },
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
    case 'issues':
      return <IssuesPage />
    case 'repos':
      return <ReposPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <NotFoundPage path={path} />
  }
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
