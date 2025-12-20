'use client'

import * as React from 'react'
import { ViewSwitcher, type ViewType } from '../view-switcher'
import { FilterBar, defaultFilterState, type IssueStatus, type IssuePriority, type IssueType } from '../filter-bar'
import { StatsCards } from '../stats-cards'
import { IssueList, type Issue } from '../issue-list'
import { BurndownChart } from '../analytics/BurndownChart'
import { VelocityChart } from '../analytics/VelocityChart'
import { CumulativeFlowDiagram } from '../analytics/CumulativeFlowDiagram'

// Re-export Issue type for consumers
export type { Issue } from '../issue-list'

interface ProjectsViewProps {
  issues: Issue[]
  onStatusChange?: (issueId: string, newStatus: Issue['status']) => void
  onIssueClick?: (issue: Issue) => void
  KanbanBoard?: React.ComponentType<{ issues: Issue[]; onStatusChange?: (id: string, status: Issue['status']) => void }>
  GanttChart?: React.ComponentType<{ issues: Issue[] }>
}

export function ProjectsView({
  issues,
  onStatusChange,
  onIssueClick,
  KanbanBoard,
  GanttChart,
}: ProjectsViewProps) {
  const [view, setView] = React.useState<ViewType>('list')
  const [filters, setFilters] = React.useState(defaultFilterState)

  // Filter issues based on current filters
  const filteredIssues = React.useMemo(() => {
    return issues.filter((issue) => {
      // Status filter
      if (filters.status !== 'all' && issue.status !== filters.status) {
        return false
      }

      // Priority filter
      if (filters.priority !== 'all' && issue.priority !== parseInt(filters.priority)) {
        return false
      }

      // Type filter
      if (filters.type !== 'all' && issue.type !== filters.type) {
        return false
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesTitle = issue.title.toLowerCase().includes(searchLower)
        const matchesId = issue.id.toLowerCase().includes(searchLower)
        const matchesDescription = issue.description?.toLowerCase().includes(searchLower)
        const matchesLabels = issue.labels?.some(l => l.toLowerCase().includes(searchLower))

        if (!matchesTitle && !matchesId && !matchesDescription && !matchesLabels) {
          return false
        }
      }

      return true
    })
  }, [issues, filters])

  // Calculate stats from all issues (not filtered)
  const stats = React.useMemo(() => ({
    total: issues.length,
    open: issues.filter(i => i.status === 'open').length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    blocked: issues.filter(i => i.status === 'blocked').length,
    closed: issues.filter(i => i.status === 'closed').length,
  }), [issues])

  return (
    <div className="space-y-6">
      {/* Header with View Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Issues
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {filteredIssues.length} of {issues.length} issues
          </p>
        </div>
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {/* Stats Cards */}
      <StatsCards data={stats} />

      {/* Filter Bar */}
      <FilterBar value={filters} onChange={setFilters} />

      {/* View Content */}
      <div className="min-h-[400px]">
        {view === 'list' && (
          <IssueList issues={filteredIssues} onIssueClick={onIssueClick} />
        )}

        {view === 'kanban' && KanbanBoard && (
          <KanbanBoard issues={filteredIssues} onStatusChange={onStatusChange} />
        )}

        {view === 'kanban' && !KanbanBoard && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-950">
            <p className="text-gray-500 dark:text-gray-400">
              Kanban board component not provided. Visit{' '}
              <a href="/dashboard/kanban" className="text-blue-500 hover:underline">
                /dashboard/kanban
              </a>{' '}
              for the full Kanban view.
            </p>
          </div>
        )}

        {view === 'gantt' && GanttChart && (
          <GanttChart issues={filteredIssues} />
        )}

        {view === 'gantt' && !GanttChart && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-950">
            <p className="text-gray-500 dark:text-gray-400">
              Gantt chart component not provided. Visit{' '}
              <a href="/dashboard/gantt" className="text-blue-500 hover:underline">
                /dashboard/gantt
              </a>{' '}
              for the full Gantt view.
            </p>
          </div>
        )}

        {view === 'analytics' && (
          <div className="grid gap-6">
            <BurndownChart />
            <VelocityChart />
            <CumulativeFlowDiagram />
          </div>
        )}
      </div>
    </div>
  )
}
