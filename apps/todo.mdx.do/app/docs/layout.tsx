import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import type { ReactNode } from 'react'
import { pageTree } from '@/source'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={pageTree}
      nav={{
        title: 'todo.mdx',
        url: '/',
      }}
      links={[
        {
          text: 'Dashboard',
          url: '/dashboard',
        },
        {
          text: 'GitHub',
          url: 'https://github.com/dot-do/todo.mdx',
          external: true,
        },
      ]}
    >
      {children}
    </DocsLayout>
  )
}
