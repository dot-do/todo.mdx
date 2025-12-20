import './global.css'
import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'readme.mdx - MDX components for beautiful README files',
    template: '%s | readme.mdx',
  },
  description: 'Turn your README into a living document with MDX components',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
