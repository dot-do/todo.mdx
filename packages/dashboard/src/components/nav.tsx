import * as React from 'react'
import { clsx } from 'clsx'

export interface DashboardNavProps {
  title?: string
  className?: string
  children?: React.ReactNode
}

export function DashboardNav({ title = 'Dashboard', className, children }: DashboardNavProps) {
  return (
    <header className={clsx(
      'sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950',
      className
    )}>
      <div className="flex h-14 items-center px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-4">
          {children}
        </div>
      </div>
    </header>
  )
}
