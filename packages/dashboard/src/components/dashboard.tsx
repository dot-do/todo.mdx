import * as React from 'react'
import { clsx } from 'clsx'
import { DashboardLayout } from './layout'
import { DashboardSidebar, type NavItem } from './sidebar'

export interface DashboardProps {
  children: React.ReactNode
  nav?: NavItem[]
  title?: string
  className?: string
}

export function Dashboard({ children, nav, title, className }: DashboardProps) {
  return (
    <DashboardLayout
      sidebar={nav ? <DashboardSidebar items={nav} /> : undefined}
      title={title}
    >
      <main className={clsx('flex-1 p-6', className)}>
        {children}
      </main>
    </DashboardLayout>
  )
}
