import './global.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { RootProvider } from 'fumadocs-ui/provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'cli.mdx - MDX-based CLI Framework',
    template: '%s | cli.mdx',
  },
  description: 'Build beautiful CLIs with MDX components powered by Bun and React',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
