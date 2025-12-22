'use client'

import * as React from 'react'
import { clsx } from 'clsx'
import {
  STATUS_COLORS,
  TYPE_ICONS,
  getPriorityColor,
  type IssueStatus,
  type IssueType,
} from '../lib/theme'

export interface Issue {
  id: string
  title: string
  description?: string
  status: IssueStatus
  priority: number
  type: IssueType
  labels?: string[]
  assignee?: string
  createdAt?: string
  updatedAt?: string
}

interface IssueListProps {
  issues: Issue[]
  onIssueClick?: (issue: Issue) => void
  className?: string
}

export function IssueList({ issues, onIssueClick, className }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className={clsx('rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-950', className)}>
        <p className="text-gray-500 dark:text-gray-400">No issues found</p>
      </div>
    )
  }

  return (
    <div className={clsx('overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950', className)}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Issue
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Priority
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Labels
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {issues.map((issue) => (
            <tr
              key={issue.id}
              onClick={() => onIssueClick?.(issue)}
              className={clsx(
                'transition-colors',
                onIssueClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900'
              )}
            >
              <td className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg" title={issue.type}>
                    {TYPE_ICONS[issue.type]}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{issue.id}</span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{issue.title}</p>
                    {issue.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {issue.description}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[issue.status])}>
                  {issue.status.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-4">
                <span className={clsx('font-medium', getPriorityColor(issue.priority))}>
                  P{issue.priority}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-1">
                  {issue.labels?.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    >
                      {label}
                    </span>
                  ))}
                  {issue.labels && issue.labels.length > 3 && (
                    <span className="text-xs text-gray-400">+{issue.labels.length - 3}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
