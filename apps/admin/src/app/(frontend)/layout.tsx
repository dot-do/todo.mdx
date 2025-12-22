import React from 'react'
import './styles.css'

export const metadata = {
  description: 'TODO.mdx Admin - Manage your TODO.mdx projects',
  title: 'TODO.mdx Admin',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
