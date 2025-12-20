import './global.css'
import { RootProvider } from 'fumadocs-ui/provider'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}

export const metadata = {
  title: {
    default: 'agents.mdx - AI Agent Framework in MDX',
    template: '%s | agents.mdx',
  },
  description: 'Build AI agents with MDX - define behavior, context, and workflows in markdown',
}
