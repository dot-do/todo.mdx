import * as React from 'react'
import { clsx } from 'clsx'
import { Badge } from './ui/badge'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface Issue {
  id: string
  title: string
  priority: number
  type: 'bug' | 'feature' | 'task' | 'epic' | 'chore'
  labels?: string[]
  status: 'open' | 'in_progress' | 'blocked' | 'closed'
  description?: string
}

interface IssueCardProps {
  issue: Issue
  isDragging?: boolean
}

const priorityColors = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-blue-500',
  5: 'bg-gray-500',
}

const typeColors = {
  bug: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  feature: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  task: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  epic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  chore: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

export function IssueCard({ issue, isDragging }: IssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: issue.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        'rounded-lg border bg-white p-4 shadow-sm cursor-grab active:cursor-grabbing',
        'dark:bg-gray-950 dark:border-gray-800',
        'hover:shadow-md transition-shadow',
        isDragging && 'opacity-50'
      )}
    >
      <div className="space-y-3">
        {/* Header: ID and Priority */}
        <div className="flex items-center justify-between">
          <code className="text-xs font-mono text-gray-500 dark:text-gray-400">
            {issue.id}
          </code>
          <div className="flex items-center gap-1">
            <div
              className={clsx(
                'w-2 h-2 rounded-full',
                priorityColors[issue.priority as keyof typeof priorityColors] || priorityColors[3]
              )}
              title={`Priority ${issue.priority}`}
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
          {issue.title}
        </h3>

        {/* Type and Labels */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className={clsx(
              'text-xs',
              typeColors[issue.type]
            )}
          >
            {issue.type}
          </Badge>
          {issue.labels?.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>

        {/* Description Preview */}
        {issue.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {issue.description}
          </p>
        )}
      </div>
    </div>
  )
}
