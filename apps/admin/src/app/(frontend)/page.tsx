import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  return (
    <div className="home">
      <div className="content">
        <h1>TODO.mdx Admin</h1>
        {user && <p className="welcome">Welcome back, {user.email}</p>}
        <div className="links">
          <a
            className="admin"
            href={payloadConfig.routes.admin}
          >
            Go to admin panel
          </a>
          <a
            className="docs"
            href="https://todo.mdx.do"
            rel="noopener noreferrer"
            target="_blank"
          >
            Documentation
          </a>
        </div>
      </div>
      <div className="footer">
        <p>MDX components that render live data to markdown</p>
      </div>
    </div>
  )
}
