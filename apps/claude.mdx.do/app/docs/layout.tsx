import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { baseOptions } from '@/app/layout.config'
import { docs } from '@/source.config'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={docs.pageTree} {...baseOptions}>
      {children}
    </DocsLayout>
  )
}
