'use client'

import * as React from 'react'
import { clsx } from 'clsx'

interface StatsData {
  total: number
  open: number
  inProgress: number
  blocked: number
  closed: number
  velocity?: number // Issues closed per week
}

interface StatsCardsProps {
  data: StatsData
  className?: string
}

export function StatsCards({ data, className }: StatsCardsProps) {
  const completionRate = data.total > 0 ? Math.round((data.closed / data.total) * 100) : 0

  return (
    <div className={clsx('grid gap-4 sm:grid-cols-2 lg:grid-cols-5', className)}>
      <StatCard
        label="Total Issues"
        value={data.total}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
        color="gray"
      />

      <StatCard
        label="Open"
        value={data.open}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        color="blue"
      />

      <StatCard
        label="In Progress"
        value={data.inProgress}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
        color="yellow"
      />

      <StatCard
        label="Blocked"
        value={data.blocked}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        }
        color="red"
      />

      <StatCard
        label="Completed"
        value={`${data.closed} (${completionRate}%)`}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        color="green"
      />
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: 'gray' | 'blue' | 'yellow' | 'red' | 'green'
}

const colorClasses = {
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    icon: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-800',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    icon: 'text-blue-500 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    icon: 'text-yellow-500 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950',
    icon: 'text-red-500 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950',
    icon: 'text-green-500 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colors = colorClasses[color]

  return (
    <div className={clsx('rounded-lg border p-4', colors.bg, colors.border)}>
      <div className="flex items-center gap-3">
        <div className={clsx('flex-shrink-0', colors.icon)}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  )
}
