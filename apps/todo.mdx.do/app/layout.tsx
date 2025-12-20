import './global.css'
import { RootProvider } from 'fumadocs-ui/provider'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | todo.mdx',
    default: 'todo.mdx',
  },
  description: 'MDX components that render live data to markdown',
  metadataBase: new URL('https://todo.mdx.do'),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
