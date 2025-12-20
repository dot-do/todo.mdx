'use client'

import * as React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Issue, IssueCard } from './issue-card'
import { clsx } from 'clsx'

type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed'

interface KanbanColumn {
  id: IssueStatus
  title: string
  description: string
}

const columns: KanbanColumn[] = [
  {
    id: 'open',
    title: 'Open',
    description: 'Ready to start',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    description: 'Currently working on',
  },
  {
    id: 'blocked',
    title: 'Blocked',
    description: 'Waiting on dependencies',
  },
  {
    id: 'closed',
    title: 'Closed',
    description: 'Completed',
  },
]

interface KanbanBoardProps {
  issues: Issue[]
  onStatusChange?: (issueId: string, newStatus: IssueStatus) => void
}

export function KanbanBoard({ issues, onStatusChange }: KanbanBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const groupedIssues = React.useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.id] = issues.filter((issue) => issue.status === column.id)
      return acc
    }, {} as Record<IssueStatus, Issue[]>)
  }, [issues])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeIssue = issues.find((issue) => issue.id === active.id)
    if (!activeIssue) return

    const overId = over.id as string

    // Check if dropped on a column
    const targetColumn = columns.find((col) => col.id === overId)
    if (targetColumn && targetColumn.id !== activeIssue.status) {
      console.log(`Moving issue ${activeIssue.id} from ${activeIssue.status} to ${targetColumn.id}`)
      onStatusChange?.(activeIssue.id, targetColumn.id)
      return
    }

    // Check if dropped on another issue (same column)
    const targetIssue = issues.find((issue) => issue.id === overId)
    if (targetIssue && targetIssue.status !== activeIssue.status) {
      console.log(`Moving issue ${activeIssue.id} from ${activeIssue.status} to ${targetIssue.status}`)
      onStatusChange?.(activeIssue.id, targetIssue.status)
    }
  }

  const activeIssue = activeId ? issues.find((issue) => issue.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            issues={groupedIssues[column.id]}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? <IssueCard issue={activeIssue} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

interface KanbanColumnProps {
  column: KanbanColumn
  issues: Issue[]
}

function KanbanColumn({ column, issues }: KanbanColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {column.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {column.description}
            </p>
          </div>
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
            {issues.length}
          </div>
        </div>
      </div>

      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          className={clsx(
            'flex flex-col gap-3 min-h-[200px] rounded-lg border-2 border-dashed p-3',
            'border-gray-200 dark:border-gray-800',
            'bg-gray-50 dark:bg-gray-900/50'
          )}
        >
          {issues.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400 dark:text-gray-600">
              No issues
            </div>
          ) : (
            issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}
