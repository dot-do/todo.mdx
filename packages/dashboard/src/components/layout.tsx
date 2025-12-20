import * as React from 'react'
import { clsx } from 'clsx'
import { DashboardNav } from './nav'

export interface DashboardLayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  title?: string
  className?: string
}

export function DashboardLayout({ children, sidebar, title, className }: DashboardLayoutProps) {
  return (
    <div className={clsx('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
      <DashboardNav title={title} />
      <div className="flex">
        {sidebar}
        {children}
      </div>
    </div>
  )
}
