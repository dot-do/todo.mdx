import * as React from 'react'
import { clsx } from 'clsx'

export interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  active?: boolean
}

export interface DashboardSidebarProps {
  items: NavItem[]
  className?: string
}

export function DashboardSidebar({ items, className }: DashboardSidebarProps) {
  return (
    <aside className={clsx(
      'hidden w-64 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:block',
      className
    )}>
      <nav className="flex flex-col gap-1 p-4">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              item.active
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            )}
          >
            {item.icon && <span className="h-4 w-4">{item.icon}</span>}
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  )
}
