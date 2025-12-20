'use client'

import * as React from 'react'
import { clsx } from 'clsx'

export type IssueStatus = 'all' | 'open' | 'in_progress' | 'blocked' | 'closed'
export type IssuePriority = 'all' | '0' | '1' | '2' | '3' | '4'
export type IssueType = 'all' | 'bug' | 'feature' | 'task' | 'epic' | 'chore'

interface FilterState {
  status: IssueStatus
  priority: IssuePriority
  type: IssueType
  search: string
}

interface FilterBarProps {
  value: FilterState
  onChange: (value: FilterState) => void
  className?: string
}

const statusOptions: { value: IssueStatus; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'closed', label: 'Closed' },
]

const priorityOptions: { value: IssuePriority; label: string }[] = [
  { value: 'all', label: 'All Priority' },
  { value: '0', label: 'P0 - Critical' },
  { value: '1', label: 'P1 - High' },
  { value: '2', label: 'P2 - Medium' },
  { value: '3', label: 'P3 - Low' },
  { value: '4', label: 'P4 - Backlog' },
]

const typeOptions: { value: IssueType; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'task', label: 'Task' },
  { value: 'epic', label: 'Epic' },
  { value: 'chore', label: 'Chore' },
]

export function FilterBar({ value, onChange, className }: FilterBarProps) {
  const handleChange = (key: keyof FilterState, newValue: string) => {
    onChange({ ...value, [key]: newValue })
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-3', className)}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search issues..."
          value={value.search}
          onChange={(e) => handleChange('search', e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Status Filter */}
      <select
        value={value.status}
        onChange={(e) => handleChange('status', e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Priority Filter */}
      <select
        value={value.priority}
        onChange={(e) => handleChange('priority', e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
      >
        {priorityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Type Filter */}
      <select
        value={value.type}
        onChange={(e) => handleChange('type', e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
      >
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Clear Filters */}
      {(value.status !== 'all' || value.priority !== 'all' || value.type !== 'all' || value.search) && (
        <button
          type="button"
          onClick={() => onChange({ status: 'all', priority: 'all', type: 'all', search: '' })}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

export const defaultFilterState: FilterState = {
  status: 'all',
  priority: 'all',
  type: 'all',
  search: '',
}
