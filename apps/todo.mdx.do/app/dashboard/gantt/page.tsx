'use client'

import * as React from 'react'
import { Gantt, GanttTask } from '../../../components/ui/gantt'
import { addDays } from 'date-fns'

// Sample data - will be replaced with Payload API later
const sampleTasks: GanttTask[] = [
  // Epic 1: Core Infrastructure
  {
    id: 'todo-1',
    title: 'Setup Payload CMS with D1',
    group: 'Epic 1: Core Infrastructure',
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 0, 5),
    priority: 1,
    status: 'closed',
  },
  {
    id: 'todo-2',
    title: 'Configure Workers RPC binding',
    group: 'Epic 1: Core Infrastructure',
    startDate: new Date(2025, 0, 6),
    endDate: new Date(2025, 0, 10),
    priority: 1,
    status: 'closed',
  },
  {
    id: 'todo-3',
    title: 'Implement authentication with WorkOS',
    group: 'Epic 1: Core Infrastructure',
    startDate: new Date(2025, 0, 11),
    endDate: new Date(2025, 0, 15),
    priority: 1,
    status: 'in_progress',
  },

  // Epic 2: Dashboard Features
  {
    id: 'todo-4',
    title: 'Create dashboard layout',
    group: 'Epic 2: Dashboard Features',
    startDate: new Date(2025, 0, 8),
    endDate: new Date(2025, 0, 12),
    priority: 2,
    status: 'closed',
  },
  {
    id: 'todo-5',
    title: 'Build issues list view',
    group: 'Epic 2: Dashboard Features',
    startDate: new Date(2025, 0, 13),
    endDate: new Date(2025, 0, 17),
    priority: 2,
    status: 'in_progress',
  },
  {
    id: 'todo-6',
    title: 'Add Gantt chart visualization',
    group: 'Epic 2: Dashboard Features',
    startDate: new Date(2025, 0, 18),
    endDate: new Date(2025, 0, 22),
    priority: 1,
    status: 'in_progress',
  },
  {
    id: 'todo-7',
    title: 'Implement drag-drop timeline editing',
    group: 'Epic 2: Dashboard Features',
    startDate: new Date(2025, 0, 23),
    endDate: new Date(2025, 0, 27),
    priority: 2,
    status: 'open',
  },

  // Epic 3: MDX Components
  {
    id: 'todo-8',
    title: 'Create Issues.Ready component',
    group: 'Epic 3: MDX Components',
    startDate: new Date(2025, 0, 15),
    endDate: new Date(2025, 0, 19),
    priority: 2,
    status: 'closed',
  },
  {
    id: 'todo-9',
    title: 'Build Roadmap.Timeline component',
    group: 'Epic 3: MDX Components',
    startDate: new Date(2025, 0, 20),
    endDate: new Date(2025, 0, 24),
    priority: 2,
    status: 'open',
  },
  {
    id: 'todo-10',
    title: 'Add real-time data updates',
    group: 'Epic 3: MDX Components',
    startDate: new Date(2025, 0, 25),
    endDate: new Date(2025, 0, 29),
    priority: 3,
    status: 'open',
  },

  // Milestone: Q1 Launch
  {
    id: 'milestone-1',
    title: 'Q1 Launch - Public Beta',
    group: 'Milestones',
    startDate: new Date(2025, 0, 30),
    endDate: new Date(2025, 0, 31),
    priority: 1,
    status: 'open',
    color: 'bg-purple-500 dark:bg-purple-600',
  },

  // Epic 4: CLI Tools
  {
    id: 'todo-11',
    title: 'Build cli.mdx framework',
    group: 'Epic 4: CLI Tools',
    startDate: new Date(2025, 1, 1),
    endDate: new Date(2025, 1, 7),
    priority: 2,
    status: 'open',
  },
  {
    id: 'todo-12',
    title: 'Add interactive prompts',
    group: 'Epic 4: CLI Tools',
    startDate: new Date(2025, 1, 8),
    endDate: new Date(2025, 1, 14),
    priority: 3,
    status: 'open',
  },
]

export default function GanttPage() {
  const [tasks, setTasks] = React.useState<GanttTask[]>(sampleTasks)

  const handleTaskUpdate = React.useCallback((taskId: string, startDate: Date, endDate: Date) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, startDate, endDate }
          : task
      )
    )

    // TODO: Update via Payload API
    console.log('Would update task via API:', { taskId, startDate, endDate })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Project Timeline
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Drag tasks to adjust dates. Changes are logged to console (API integration pending).
        </p>
      </div>

      {/* Stats */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">Total Tasks:</span>{' '}
            <span className="text-gray-600 dark:text-gray-400">{tasks.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">In Progress:</span>{' '}
            <span className="text-blue-600 dark:text-blue-400">
              {tasks.filter(t => t.status === 'in_progress').length}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">Completed:</span>{' '}
            <span className="text-green-600 dark:text-green-400">
              {tasks.filter(t => t.status === 'closed').length}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-gray-100">Open:</span>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              {tasks.filter(t => t.status === 'open').length}
            </span>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <Gantt tasks={tasks} onTaskUpdate={handleTaskUpdate} />

      {/* Legend */}
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gray-400 dark:bg-gray-600" />
            <span className="text-gray-600 dark:text-gray-400">Open</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-500 dark:bg-blue-600" />
            <span className="text-gray-600 dark:text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500 dark:bg-green-600" />
            <span className="text-gray-600 dark:text-gray-400">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500 dark:bg-red-600" />
            <span className="text-gray-600 dark:text-gray-400">Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-purple-500 dark:bg-purple-600" />
            <span className="text-gray-600 dark:text-gray-400">Milestone</span>
          </div>
        </div>
      </div>
    </div>
  )
}
